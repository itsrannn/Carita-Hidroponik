const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { updateProfile } = require('../controllers/profile.controller');

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('updateProfile sends email and postal_code to Supabase PATCH', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('/auth/v1/user')) {
      return {
        ok: true,
        json: async () => ({ id: 'user-123', email: 'google@example.com' })
      };
    }

    if (String(url).includes('/rest/v1/profiles')) {
      const body = JSON.parse(options.body);
      assert.equal(body.email, 'google@example.com');
      assert.equal(body.postal_code, '12345');
      assert.equal(body.full_name, 'Google User');
      assert.equal(body.phone_number, '08123456789');

      return {
        ok: true,
        json: async () => ([{ id: 'user-123', ...body }])
      };
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const req = {
      headers: { authorization: 'Bearer user-access-token' },
      body: {
        data: {
          user_id: 'user-123',
          email: 'google@example.com',
          full_name: 'Google User',
          phone_number: '08123456789',
          address: 'Jl. Contoh No. 1',
          postal_code: '12345'
        }
      }
    };
    const res = createResponse();

    await updateProfile(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.profile.email, 'google@example.com');
    assert.equal(res.body.profile.postal_code, '12345');
    assert.equal(calls.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
