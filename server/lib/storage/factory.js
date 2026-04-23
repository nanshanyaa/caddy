const { TelegramStorageAdapter } = require('./adapters/telegram');
const { S3CompatAdapter } = require('./adapters/s3');
const { DiscordStorageAdapter } = require('./adapters/discord');
const { HuggingFaceStorageAdapter } = require('./adapters/huggingface');
const { WebDAVStorageAdapter } = require('./adapters/webdav');
const { GitHubStorageAdapter } = require('./adapters/github');
const { requireStorageType } = require('./common');

class StorageFactory {
  constructor() {
    this.adapterCache = new Map();
  }

  createAdapter(storageConfig, { cache = true } = {}) {
    if (!storageConfig) {
      throw new Error('Storage config not found.');
    }

    const cacheKey = `${storageConfig.id}:${storageConfig.updatedAt}`;
    if (cache && this.adapterCache.has(cacheKey)) {
      return this.adapterCache.get(cacheKey);
    }

    const type = requireStorageType(storageConfig.type);
    const config = storageConfig.config || {};

    let adapter;
    if (type === 'telegram') {
      adapter = new TelegramStorageAdapter(config);
    } else if (type === 'r2') {
      adapter = new S3CompatAdapter(config, 'r2');
    } else if (type === 's3') {
      adapter = new S3CompatAdapter(config, 's3');
    } else if (type === 'discord') {
      adapter = new DiscordStorageAdapter(config);
    } else if (type === 'huggingface') {
      adapter = new HuggingFaceStorageAdapter(config);
    } else if (type === 'webdav') {
      adapter = new WebDAVStorageAdapter(config);
    } else if (type === 'github') {
      adapter = new GitHubStorageAdapter(config);
    } else {
      throw new Error(`Unsupported storage type: ${type}`);
    }

    if (cache) {
      this.adapterCache.set(cacheKey, adapter);
    }
    return adapter;
  }

  createTemporaryAdapter(type, config) {
    const normalized = requireStorageType(type);
    const fakeConfig = {
      id: `temp-${Date.now()}`,
      updatedAt: Date.now(),
      type: normalized,
      config,
    };
    return this.createAdapter(fakeConfig, { cache: false });
  }
}

module.exports = {
  StorageFactory,
};
