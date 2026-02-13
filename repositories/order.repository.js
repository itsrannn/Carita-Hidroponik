const orders = new Map();

function create(order) {
  orders.set(order.orderId, order);
  return order;
}

function findByOrderId(orderId) {
  return orders.get(orderId) || null;
}

function updateByOrderId(orderId, patch) {
  const existingOrder = findByOrderId(orderId);
  if (!existingOrder) return null;

  const updatedOrder = {
    ...existingOrder,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  orders.set(orderId, updatedOrder);
  return updatedOrder;
}

function listPaidForAdmin() {
  return [...orders.values()].filter((order) => order.status === 'paid');
}

module.exports = {
  create,
  findByOrderId,
  updateByOrderId,
  listPaidForAdmin,
};
