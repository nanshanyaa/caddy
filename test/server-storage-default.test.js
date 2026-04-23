const assert = require('assert');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server/app');

describe('Storage default selection', function () {
  const originalEnv = { ...process.env };
  let tmpDir;

  beforeEach(function () {
    tmpDir = path.join(__dirname, '..', 'data', `tmp-storage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    process.env.CONFIG_ENCRYPTION_KEY = 'storage_test_key_123456';
    process.env.SESSION_SECRET = 'storage_test_secret_123456';
    process.env.DATA_DIR = tmpDir;
    process.env.DB_PATH = path.join(tmpDir, 'storage-test.db');
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

  it('does not clear the existing default when the requested default does not exist', async function () {
    const app = createApp();

    const createResponse = await app.fetch(new Request('http://localhost/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Telegram test',
        type: 'telegram',
        enabled: true,
        isDefault: true,
        config: {
          botToken: 'test-token',
          chatId: 'test-chat',
          apiBase: 'https://api.telegram.org',
        },
      }),
    }));
    assert.strictEqual(createResponse.status, 200);
    const created = await createResponse.json();
    assert.ok(created.item.id);

    const missingResponse = await app.fetch(new Request('http://localhost/api/storage/default/missing-id', {
      method: 'POST',
    }));
    assert.strictEqual(missingResponse.status, 404);

    const listResponse = await app.fetch(new Request('http://localhost/api/storage/list'));
    assert.strictEqual(listResponse.status, 200);
    const list = await listResponse.json();
    const original = list.items.find((item) => item.id === created.item.id);
    assert.strictEqual(original.isDefault, true);
  });
});
