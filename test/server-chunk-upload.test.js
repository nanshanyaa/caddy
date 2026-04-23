const assert = require('assert');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server/app');

describe('Server chunk upload limits', function () {
  const originalEnv = { ...process.env };
  let tmpDir;

  beforeEach(function () {
    tmpDir = path.join(__dirname, '..', 'data', `tmp-chunks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    process.env.CONFIG_ENCRYPTION_KEY = 'chunk_test_key_123456';
    process.env.SESSION_SECRET = 'chunk_test_secret_123456';
    process.env.DATA_DIR = tmpDir;
    process.env.DB_PATH = path.join(tmpDir, 'chunk-test.db');
    process.env.CHUNK_DIR = path.join(tmpDir, 'chunks');
    process.env.CHUNK_SIZE = '4';
    process.env.UPLOAD_MAX_SIZE = '20';
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

  async function initUpload(app, fileSize = 8) {
    const response = await app.fetch(new Request('http://localhost/api/chunked-upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'sample.bin',
        fileSize,
        fileType: 'application/octet-stream',
        totalChunks: Math.ceil(fileSize / 4),
      }),
    }));
    assert.strictEqual(response.status, 200);
    return response.json();
  }

  it('returns server-side chunk metadata during init', async function () {
    const app = createApp();
    const init = await initUpload(app, 8);

    assert.strictEqual(init.chunkSize, 4);
    assert.strictEqual(init.totalChunks, 2);
  });

  it('rejects out-of-range chunk indexes', async function () {
    const app = createApp();
    const init = await initUpload(app, 8);
    const body = new FormData();
    body.append('uploadId', init.uploadId);
    body.append('chunkIndex', '2');
    body.append('chunk', new File([Buffer.from('abcd')], '2.part'));

    const response = await app.fetch(new Request('http://localhost/api/chunked-upload/chunk', {
      method: 'POST',
      body,
    }));

    assert.strictEqual(response.status, 400);
  });

  it('rejects chunks larger than the configured chunk size', async function () {
    const app = createApp();
    const init = await initUpload(app, 8);
    const body = new FormData();
    body.append('uploadId', init.uploadId);
    body.append('chunkIndex', '0');
    body.append('chunk', new File([Buffer.from('abcde')], '0.part'));

    const response = await app.fetch(new Request('http://localhost/api/chunked-upload/chunk', {
      method: 'POST',
      body,
    }));

    assert.strictEqual(response.status, 413);
  });
});
