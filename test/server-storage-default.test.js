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
    process.env.HF_TOKEN = '';
    process.env.HF_REPO = '';
    process.env.HUGGINGFACE_TOKEN = '';
    process.env.HUGGINGFACE_REPO = '';
    process.env.HF_API_TOKEN = '';
    process.env.HF_DATASET_REPO = '';
    process.env.GITHUB_TOKEN = '';
    process.env.GITHUB_REPO = '';
    process.env.GH_TOKEN = '';
    process.env.GITHUB_PAT = '';
    process.env.GH_REPO = '';
    process.env.GITHUB_REPOSITORY = '';
    process.env.SETTINGS_STORE = 'sqlite';
    process.env.SETTINGS_REDIS_URL = '';
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

  it('rejects unsupported storage types instead of coercing them to telegram', async function () {
    const app = createApp();

    const createResponse = await app.fetch(new Request('http://localhost/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bogus storage',
        type: 'bogus',
        enabled: true,
        isDefault: true,
        config: {},
      }),
    }));
    assert.strictEqual(createResponse.status, 400);
    const createPayload = await createResponse.json();
    assert.strictEqual(createPayload.errorCode, 'INVALID_STORAGE_CONFIG');
    assert.match(createPayload.errorDetail, /Unsupported storage type/i);

    const testResponse = await app.fetch(new Request('http://localhost/api/storage/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bogus', config: {} }),
    }));
    assert.strictEqual(testResponse.status, 400);
    const testPayload = await testResponse.json();
    assert.strictEqual(testPayload.errorCode, 'INVALID_STORAGE_TYPE');

    const listResponse = await app.fetch(new Request('http://localhost/api/storage/list'));
    const list = await listResponse.json();
    assert.deepStrictEqual(list.items, []);
  });

  it('does not allow a disabled storage profile to become or remain default', async function () {
    const app = createApp();

    const createDisabledDefault = await app.fetch(new Request('http://localhost/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Disabled default',
        type: 'telegram',
        enabled: false,
        isDefault: true,
        config: {
          botToken: 'test-token',
          chatId: 'test-chat',
        },
      }),
    }));
    assert.strictEqual(createDisabledDefault.status, 400);

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

    const disableResponse = await app.fetch(new Request(`http://localhost/api/storage/${created.item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    }));
    assert.strictEqual(disableResponse.status, 400);
    const disablePayload = await disableResponse.json();
    assert.strictEqual(disablePayload.errorCode, 'INVALID_STORAGE_CONFIG');

    const listResponse = await app.fetch(new Request('http://localhost/api/storage/list'));
    const list = await listResponse.json();
    const item = list.items.find((entry) => entry.id === created.item.id);
    assert.strictEqual(item.enabled, true);
    assert.strictEqual(item.isDefault, true);
  });
});
