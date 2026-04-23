const assert = require('assert');
const { UploadService } = require('../server/lib/services/upload-service');

function makeUploadService() {
  return new UploadService({
    storageRepo: {
      resolveStorageSelection() {
        return {
          id: 'storage_1',
          name: 'Storage',
          type: 'telegram',
          config: {},
        };
      },
    },
    fileRepo: {
      create(payload) {
        return {
          id: payload.id,
          file_name: payload.fileName,
          file_size: payload.fileSize,
          metadata: payload.extra || {},
        };
      },
    },
    storageFactory: {
      createAdapter() {
        return {
          async upload({ storageKey }) {
            return { storageKey, metadata: {} };
          },
        };
      },
    },
  });
}

describe('UploadService upload-from-url safety', function () {
  const originalFetch = global.fetch;

  afterEach(function () {
    global.fetch = originalFetch;
  });

  it('rejects private IP URLs before fetching them', async function () {
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      return new Response('not reached');
    };

    await assert.rejects(
      () => makeUploadService().uploadFromUrl({ url: 'http://127.0.0.1/private.png' }),
      /private|local/i
    );
    assert.strictEqual(fetchCalled, false);
  });

  it('rejects loopback IPv6 URLs before fetching them', async function () {
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      return new Response('not reached');
    };

    await assert.rejects(
      () => makeUploadService().uploadFromUrl({ url: 'http://[::1]/private.png' }),
      /private|local/i
    );
    assert.strictEqual(fetchCalled, false);
  });

  it('rejects redirects into private addresses', async function () {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private.png' },
      });
    };

    await assert.rejects(
      () => makeUploadService().uploadFromUrl({ url: 'http://93.184.216.34/start.png' }),
      /private|local/i
    );
    assert.strictEqual(fetchCalls, 1);
  });

  it('stops reading remote responses after the configured byte limit', async function () {
    global.fetch = async () => new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4, 5, 6]));
          controller.close();
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }
    );

    await assert.rejects(
      () => makeUploadService().uploadFromUrl({
        url: 'https://example.com/file.png',
        maxBytes: 5,
        allowPrivateNetwork: true,
      }),
      /size limit/i
    );
  });
});
