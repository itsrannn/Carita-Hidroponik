const crypto = require('crypto');

function generateMidtransSignature({ orderId, statusCode, grossAmount, serverKey }) {
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return crypto.createHash('sha512').update(payload).digest('hex');
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left || '', 'utf8');
  const rightBuffer = Buffer.from(right || '', 'utf8');

  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  generateMidtransSignature,
  safeCompare,
};
