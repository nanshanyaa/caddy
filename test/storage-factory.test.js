const assert = require('assert');
const { StorageFactory } = require('../server/lib/storage/factory');

describe('StorageFactory adapter cache', function () {
  it('caches persistent storage adapters by id and updatedAt', function () {
    const factory = new StorageFactory();
    const config = {
      id: 'storage_1',
      updatedAt: 123,
      type: 'github',
      config: { repo: 'owner/repo', token: 'token' },
    };

    const first = factory.createAdapter(config);
    const second = factory.createAdapter(config);

    assert.strictEqual(first, second);
    assert.strictEqual(factory.adapterCache.size, 1);
  });

  it('does not cache temporary adapters used by storage tests', function () {
    const factory = new StorageFactory();

    const first = factory.createTemporaryAdapter('github', { repo: 'owner/repo', token: 'token' });
    const second = factory.createTemporaryAdapter('github', { repo: 'owner/repo', token: 'token' });

    assert.notStrictEqual(first, second);
    assert.strictEqual(factory.adapterCache.size, 0);
  });
});
