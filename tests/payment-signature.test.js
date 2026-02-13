const test = require('node:test');
const assert = require('node:assert/strict');
const { generateMidtransSignature, safeCompare } = require('../utils/payment-signature');

test('generateMidtransSignature creates deterministic SHA512 signature', () => {
  const signature = generateMidtransSignature({
    orderId: 'ORDER-123',
    statusCode: '200',
    grossAmount: '150000',
    serverKey: 'SB-Mid-server-xxxx',
  });

  assert.equal(signature.length, 128);
  assert.match(signature, /^[a-f0-9]+$/);
});

test('safeCompare returns false when lengths differ', () => {
  assert.equal(safeCompare('abc', 'abcd'), false);
});
