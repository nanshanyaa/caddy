const assert = require('assert');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server/app');

describe('Server CORS policy', function () {
  const originalEnv = { ...process.env };
  let tmpDir;

  beforeEach(function () {
    tmpDir = path.join(__dirname, '..', 'data', `tmp-cors-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    process.env.CONFIG_ENCRYPTION_KEY = 'cors_test_key_123456';
    process.env.SESSION_SECRET = 'cors_test_secret_123456';
    process.env.DATA_DIR = tmpDir;
    process.env.DB_PATH = path.join(tmpDir, 'cors-test.db');
    process.env.BASIC_USER = '';
    process.env.BASIC_PASS = '';
    process.env.TG_BOT_TOKEN = '';
    process.env.TG_CHAT_ID = '';
  });

  afterEach(function () {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
  });

  it('does not allow credentialed cross-origin API reads', async function () {
    const app = createApp();
    const response = await app.fetch(new Request('http://localhost/api/status', {
      headers: {
        Origin: 'https://example.invalid',
      },
    }));

    assert.strictEqual(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.strictEqual(response.headers.get('Access-Control-Allow-Credentials'), null);
  });
});
