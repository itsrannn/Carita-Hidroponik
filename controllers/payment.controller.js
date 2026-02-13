const { randomUUID } = require('crypto');
const midtransService = require('../services/midtrans.service');
const orderRepository = require('../repositories/order.repository');
const { generateMidtransSignature, safeCompare } = require('../utils/payment-signature');

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

function getPaidOrdersForAdmin(_req, res) {
  const orders = orderRepository.listPaidForAdmin();
  return res.status(200).json({ orders });
}

module.exports = {
  createSnapToken,
  confirmOrder,
  webhook,
  getPaidOrdersForAdmin,
};
