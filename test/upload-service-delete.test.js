const assert = require('assert');
const { UploadService } = require('../server/lib/services/upload-service');

describe('UploadService delete safety', function () {
  function createService({ adapterDelete }) {
    const file = {
      id: 'file_1.png',
      storage_config_id: 'storage_1',
      storage_key: 'uploads/file_1.png',
      metadata: { fileName: 'file_1.png' },
    };
    let localDeleted = false;

    const service = new UploadService({
      fileRepo: {
        getById(id) {
          return id === file.id && !localDeleted ? file : null;
        },
        delete(id) {
          if (id !== file.id || localDeleted) return false;
          localDeleted = true;
          return true;
        },
      },
      storageRepo: {
        getById(id) {
          return id === file.storage_config_id ? { id, type: 'github', config: {} } : null;
        },
      },
      storageFactory: {
        createAdapter() {
          return { delete: adapterDelete };
        },
      },
    });

    return {
      service,
      wasLocalDeleted: () => localDeleted,
    };
  }

  it('keeps the local record when remote storage deletion throws', async function () {
    const { service, wasLocalDeleted } = createService({
      adapterDelete: async () => {
        throw new Error('remote delete failed');
      },
    });

    const result = await service.deleteFile('file_1.png');

    assert.strictEqual(result.deleted, false);
    assert.strictEqual(result.reason, 'remote-delete-failed');
    assert.match(result.error, /remote delete failed/i);
    assert.strictEqual(wasLocalDeleted(), false);
  });

  it('keeps the local record when remote storage deletion is not confirmed', async function () {
    const { service, wasLocalDeleted } = createService({
      adapterDelete: async () => false,
    });

    const result = await service.deleteFile('file_1.png');

    assert.strictEqual(result.deleted, false);
    assert.strictEqual(result.reason, 'remote-delete-failed');
    assert.strictEqual(wasLocalDeleted(), false);
  });

  it('deletes the local record only after remote storage deletion succeeds', async function () {
    const { service, wasLocalDeleted } = createService({
      adapterDelete: async () => true,
    });

    const result = await service.deleteFile('file_1.png');

    assert.strictEqual(result.deleted, true);
    assert.strictEqual(wasLocalDeleted(), true);
  });
});
