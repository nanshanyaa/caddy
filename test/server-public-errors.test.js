const assert = require('assert');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server/app');
const { initDatabase, run } = require('../server/db');

describe('Server public error handling', function () {
  this.timeout(10000);

  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  let tmpDir;

  beforeEach(function () {
    tmpDir = path.join(__dirname, '..', 'data', `tmp-public-errors-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    process.env.CONFIG_ENCRYPTION_KEY = 'public_error_key_123456';
    process.env.SESSION_SECRET = 'public_error_secret_123456';
    process.env.DATA_DIR = tmpDir;
    process.env.DB_PATH = path.join(tmpDir, 'public-errors.db');
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

    global.fetch = async () => new Response(
      JSON.stringify({ message: 'upstream secret detail' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    console.error = () => {};
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

    global.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  async function createStoredGitHubFile(app) {
    const createResponse = await app.fetch(new Request('http://localhost/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'GitHub test',
        type: 'github',
        enabled: true,
        isDefault: true,
        config: {
          repo: 'owner/repo',
          token: 'test_token',
          mode: 'contents',
        },
      }),
    }));
    assert.strictEqual(createResponse.status, 200);

    const created = await createResponse.json();
    const fileId = 'github_error_file.png';
    const now = Date.now();
    const db = initDatabase(process.env.DB_PATH);
    try {
      run(
        db,
        `INSERT INTO files(
          id, storage_config_id, storage_type, storage_key, file_name,
          file_size, mime_type, list_type, label, liked, extra_json, folder_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fileId,
          created.item.id,
          'github',
          'uploads/github_error_file.png',
          'github_error_file.png',
          12,
          'image/png',
          'None',
          'None',
          0,
          '{}',
          '',
          now,
          now,
        ]
      );
    } finally {
      if (typeof db.close === 'function') db.close();
    }

    return fileId;
  }

  it('returns 400 instead of 500 for malformed storage JSON', async function () {
    const app = createApp();
    const response = await app.fetch(new Request('http://localhost/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":',
    }));

    assert.strictEqual(response.status, 400);
    const payload = await response.json();
    assert.strictEqual(payload.errorCode, 'INVALID_JSON');
  });

  it('does not expose upstream file proxy errors to public responses', async function () {
    const app = createApp();
    const fileId = await createStoredGitHubFile(app);

    const getResponse = await app.fetch(new Request(`http://localhost/file/${fileId}`));
    assert.strictEqual(getResponse.status, 502);
    const getText = await getResponse.text();
    assert.strictEqual(getText, 'File proxy error.');
    assert.ok(!getText.includes('upstream secret detail'));

    const headResponse = await app.fetch(new Request(`http://localhost/file/${fileId}`, { method: 'HEAD' }));
    assert.strictEqual(headResponse.status, 502);
    assert.strictEqual(headResponse.headers.get('X-File-Proxy-Error'), 'upstream_fetch_failed');
    assert.ok(!String(headResponse.headers.get('X-File-Proxy-Error')).includes('upstream secret detail'));
  });

  it('does not expose upstream share proxy errors to public responses', async function () {
    const app = createApp();
    const fileId = await createStoredGitHubFile(app);

    const signResponse = await app.fetch(new Request('http://localhost/api/share/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    }));
    assert.strictEqual(signResponse.status, 200);

    const signed = await signResponse.json();
    const shareResponse = await app.fetch(new Request(`http://localhost${signed.sharePath}`));
    assert.strictEqual(shareResponse.status, 502);
    const shareText = await shareResponse.text();
    assert.strictEqual(shareText, 'Share proxy error.');
    assert.ok(!shareText.includes('upstream secret detail'));
  });
});
