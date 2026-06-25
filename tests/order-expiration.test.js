const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const orderRepository = require('../repositories/order.repository');

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function apiUrl(server, path) {
  return `http://127.0.0.1:${server.address().port}${path}`;
}

test('GET /api/orders/:id cancels expired pending_payment orders before returning details', async () => {
  const orderId = `EXPIRED-${Date.now()}`;
  orderRepository.create({
    orderId,
    order_code: orderId,
    status: 'pending_payment',
    createdAt: new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString(),
    totalAmount: 10000,
    orderDetails: [{ id: 'item-1', name: 'Item 1', quantity: 1, price: 10000 }]
  });

  const server = await listen(app);
  try {
    const response = await fetch(apiUrl(server, `/api/orders/${encodeURIComponent(orderId)}`));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.order.status, 'cancelled');
    assert.equal(body.order.cancel_reason, 'Payment timeout');
    assert.equal(body.order.paid_at, null);
    assert.equal(orderRepository.findByOrderId(orderId).status, 'cancelled');
  } finally {
    server.close();
  }
});

test('POST /api/orders/:id/retry-payment rejects expired orders after saving cancellation', async () => {
  const orderId = `RETRY-EXPIRED-${Date.now()}`;
  orderRepository.create({
    orderId,
    order_code: orderId,
    status: 'pending_payment',
    createdAt: new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString(),
    totalAmount: 10000,
    orderDetails: [{ id: 'item-1', name: 'Item 1', quantity: 1, price: 10000 }]
  });

  const server = await listen(app);
  try {
    const response = await fetch(apiUrl(server, `/api/orders/${encodeURIComponent(orderId)}/retry-payment`), { method: 'POST' });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.order.status, 'cancelled');
    assert.equal(orderRepository.findByOrderId(orderId).status, 'cancelled');
  } finally {
    server.close();
  }
});
