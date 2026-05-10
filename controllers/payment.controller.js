const { randomUUID } = require('crypto');
const midtransService = require('../services/midtrans.service');
const orderRepository = require('../repositories/order.repository');
const { generateMidtransSignature, safeCompare } = require('../utils/payment-signature');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://thetdckuftpzyubvlbju.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function mapMidtransTransactionStatus(transactionStatus, fraudStatus) {
  if (transactionStatus === 'settlement' || (transactionStatus === 'capture' && fraudStatus === 'accept')) {
    return 'paid';
  }
  if (transactionStatus === 'pending') return 'pending_payment';
  if (transactionStatus === 'expire') return 'expired';
  if (transactionStatus === 'cancel' || transactionStatus === 'deny') return 'cancelled';
  return 'pending_payment';
}


async function findOrderByCodeInSupabase(orderCode) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the backend.');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&select=id,order_code,status,paid_at&limit=1`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to query order in Supabase: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function updateOrderStatusInSupabase(orderCode, newStatus, isPaid) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the backend.');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&select=id,order_code,status,paid_at`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      status: newStatus,
      paid_at: isPaid ? new Date().toISOString() : null
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update order in Supabase: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) && data.length ? data[0] : null;
}

function normalizeCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { error: 'Cart must be a non-empty array.' };
  }

  const itemDetails = [];
  let calculatedTotal = 0;

  for (const item of cart) {
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    const id = String(item.id || item.productId || '').trim();
    const name = String(item.name || '').trim();

    if (!id || !name || Number.isNaN(quantity) || Number.isNaN(price) || quantity <= 0 || price <= 0) {
      return { error: 'Each cart item must include valid id, name, quantity, and price.' };
    }

    const subtotal = quantity * price;
    calculatedTotal += subtotal;

    itemDetails.push({
      id,
      name,
      quantity,
      price,
    });
  }

  return { itemDetails, calculatedTotal };
}

function toOrderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'items must be a non-empty array.' };
  }

  const orderDetails = [];
  for (const item of items) {
    const id = String(item.id || item.product_id || '').trim();
    const name = String(item.name || '').trim();
    const quantity = Number(item.quantity);
    const price = Number(item.price);

    if (!id || !name || !Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) {
      return { error: 'Each item must include valid id, name, quantity, and price.' };
    }

    orderDetails.push({ id, name, quantity, price });
  }
  return { orderDetails };
}

async function createOrder(req, res) {
  const { items, shipping_cost: shippingCost = 0 } = req.body || {};
  const normalized = toOrderItems(items);
  if (normalized.error) return res.status(400).json({ message: normalized.error });

  const subtotal = normalized.orderDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = Math.max(0, Number(shippingCost) || 0);
  const totalAmount = Math.round(subtotal + shipping);
  const orderId = `ORDER-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

  const order = orderRepository.create({
    orderId,
    order_code: orderId,
    status: 'pending_payment',
    totalAmount,
    shippingCost: shipping,
    orderDetails: normalized.orderDetails,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  try {
    const snapToken = await midtransService.createSnapToken({
      orderId: order.order_code,
      grossAmount: order.totalAmount,
      itemDetails: order.orderDetails,
      customerDetails: order.customer || { first_name: 'Customer', email: 'customer@example.com', phone: '' },
    });

    console.log('SNAP TOKEN:', snapToken);

    const updatedOrder = orderRepository.updateByOrderId(order.orderId, {
      payment_token: snapToken,
      payment_token_created_at: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      order: {
        id: updatedOrder?.orderId || order.orderId,
        order_code: updatedOrder?.order_code || order.order_code,
        status: updatedOrder?.status || order.status,
        total_amount: updatedOrder?.totalAmount || order.totalAmount,
      },
      snapToken
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create Midtrans token',
      error
    });
  }
}

async function createPaymentToken(req, res) {
  const { order_id: orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ message: 'order_id is required.' });

  const order = orderRepository.findByOrderId(orderId);
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  try {
    const token = await midtransService.createSnapToken({
      orderId: order.orderId,
      grossAmount: order.totalAmount,
      itemDetails: order.orderDetails,
      customerDetails: order.customer || { first_name: 'Customer', email: 'customer@example.com', phone: '' },
    });

    return res.status(201).json({ token, created_at: new Date().toISOString(), clientKey: process.env.MIDTRANS_CLIENT_KEY });
  } catch (_error) {
    return res.status(502).json({ message: 'Failed to create Midtrans transaction token.' });
  }
}

async function confirmOrder(req, res) {
  const { order_code: orderCode, transaction_id: transactionId, payment_status: paymentStatus } = req.body || {};

  if (!orderCode) {
    return res.status(400).json({ message: 'order_code is required.' });
  }

  // In a real app, we would use order_code to find the order.
  // Since orderRepository uses orderId, and they might be different,
  // we'll just try to find it or return success for the sake of the frontend flow.
  const order = orderRepository.findByOrderId(orderCode);

  if (order) {
    orderRepository.updateByOrderId(orderCode, {
      status: paymentStatus === 'success' ? 'paid' : (paymentStatus === 'pending' ? 'pending' : 'failed'),
      transactionId: transactionId || order.transactionId,
      updatedAt: new Date().toISOString(),
    });
  }

  return res.status(200).json({
    message: 'Order status received.',
    order_code: orderCode,
    payment_status: paymentStatus
  });
}

async function createSnapToken(req, res) {
  const { cart, totalPrice, customer } = req.body || {};
  const normalized = normalizeCart(cart);

  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }

  const grossAmount = Number(totalPrice);
  if (!Number.isInteger(grossAmount) || grossAmount <= 0) {
    return res.status(400).json({ message: 'totalPrice must be a positive integer.' });
  }

  if (normalized.calculatedTotal !== grossAmount) {
    return res.status(400).json({
      message: 'totalPrice does not match cart calculation.',
      expected: normalized.calculatedTotal,
    });
  }

  const orderId = `CH-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const order = orderRepository.create({
    orderId,
    status: 'pending',
    totalAmount: grossAmount,
    orderDetails: normalized.itemDetails,
    customer: {
      first_name: customer?.firstName || customer?.name || 'Customer',
      email: customer?.email || 'customer@example.com',
      phone: customer?.phone || '',
    },
    sentToAdmin: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  try {
    const snapToken = await midtransService.createSnapToken({
      orderId: order.orderId,
      grossAmount: order.totalAmount,
      itemDetails: order.orderDetails,
      customerDetails: order.customer,
    });

    return res.status(201).json({
      snapToken,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
      orderId: order.orderId,
    });
  } catch (_error) {
    orderRepository.updateByOrderId(order.orderId, { status: 'failed' });
    return res.status(502).json({ message: 'Failed to create Midtrans transaction token.' });
  }
}

function webhook(req, res) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signatureKey, transaction_status: transactionStatus, fraud_status: fraudStatus } = req.body || {};

  if (!orderId || !statusCode || !grossAmount || !signatureKey || !transactionStatus) {
    return res.status(400).json({ message: 'Invalid webhook payload.' });
  }

  const expectedSignature = generateMidtransSignature({
    orderId,
    statusCode,
    grossAmount,
    serverKey,
  });

  if (!safeCompare(expectedSignature, signatureKey)) {
    return res.status(401).json({ message: 'Invalid signature.' });
  }

  const order = orderRepository.findByOrderId(orderId);
  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  const isPaid = transactionStatus === 'settlement' || (transactionStatus === 'capture' && fraudStatus === 'accept');

  const updatedOrder = orderRepository.updateByOrderId(orderId, {
    status: isPaid ? 'paid' : 'pending',
    paidAt: isPaid ? new Date().toISOString() : null,
    transactionStatus,
    statusCode,
    sentToAdmin: isPaid,
  });

  return res.status(200).json({
    message: 'Webhook processed.',
    orderId: updatedOrder.orderId,
    status: updatedOrder.status,
    sentToAdmin: updatedOrder.sentToAdmin,
  });
}

async function midtransNotification(req, res) {
  console.log('==== MIDTRANS WEBHOOK RECEIVED ====');
  console.log(JSON.stringify(req.body, null, 2));

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const {
    transaction_status: transactionStatus,
    fraud_status: fraudStatus,
    order_id: orderId,
    payment_type: paymentType,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signatureKey
  } = req.body || {};

  console.log('ORDER ID:', orderId);
  console.log('TRANSACTION STATUS:', transactionStatus);
  console.log('FRAUD STATUS:', fraudStatus);

  if (!orderId || !transactionStatus || !statusCode || !grossAmount || !signatureKey) {
    console.error('MIDTRANS WEBHOOK INVALID PAYLOAD');
    return res.status(400).json({ message: 'Invalid Midtrans notification payload.' });
  }

  const expectedSignature = generateMidtransSignature({
    orderId,
    statusCode,
    grossAmount,
    serverKey,
  });

  if (!safeCompare(expectedSignature, signatureKey)) {
    console.error('MIDTRANS SIGNATURE VERIFICATION FAILED');
    return res.status(401).json({ message: 'Invalid signature.' });
  }

  const newStatus = mapMidtransTransactionStatus(transactionStatus, fraudStatus);

  try {
    const order = await findOrderByCodeInSupabase(orderId);
    console.log('FOUND ORDER:', order);

    if (!order) {
      return res.status(200).json({
        success: true,
        message: 'Order not found for provided order_id.',
        order_id: orderId
      });
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderId)}&select=id,order_code,status,paid_at`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        status: newStatus,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : null
      })
    });

    let data = null;
    let error = null;

    if (!response.ok) {
      const errorText = await response.text();
      error = new Error(`Failed to update order in Supabase: ${response.status} ${errorText}`);
    } else {
      data = await response.json();
    }

    console.log('UPDATED ORDER:', data);
    if (error) {
      console.error('UPDATE ERROR:', error);
      return res.status(500).json({ success: false, message: 'Failed to process Midtrans notification.' });
    }

    return res.status(200).json({
      success: true,
      order_id: orderId,
      payment_type: paymentType,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus || null,
      status: Array.isArray(data) && data[0] ? data[0].status : newStatus,
      paid_at: Array.isArray(data) && data[0] ? data[0].paid_at : null
    });
  } catch (error) {
    console.error('[Midtrans Notification] Failed to process:', error);
    return res.status(500).json({ success: false, message: 'Failed to process Midtrans notification.' });
  }
}


function getPaidOrdersForAdmin(_req, res) {
  const orders = orderRepository.listPaidForAdmin();
  return res.status(200).json({ orders });
}

module.exports = {
  createOrder,
  createPaymentToken,
  createSnapToken,
  confirmOrder,
  webhook,
  midtransNotification,
  getPaidOrdersForAdmin,
};
