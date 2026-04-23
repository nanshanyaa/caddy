const { buildPublicFileId, normalizeStorageType } = require('../storage/common');
const { normalizeFolderPath } = require('../repos/file-repo');
const { assertSafeHttpUrl } = require('../utils/url-safety');

const MAX_UPLOAD_FROM_URL_REDIRECTS = 5;

function decodeUrlFileName(pathname) {
  const rawName = String(pathname || '').split('/').pop() || '';
  try {
    return decodeURIComponent(rawName).trim();
  } catch {
    return rawName.trim();
  }
}

async function readResponseBody(response, maxBytes) {
  const contentLength = Number.parseInt(response.headers.get('content-length') || '', 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Remote file exceeds size limit (${Math.floor(maxBytes / 1024 / 1024)}MB).`);
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error(`Remote file exceeds size limit (${Math.floor(maxBytes / 1024 / 1024)}MB).`);
    }
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(`Remote file exceeds size limit (${Math.floor(maxBytes / 1024 / 1024)}MB).`);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, totalBytes);
}

class UploadService {
  constructor({ storageRepo, fileRepo, storageFactory }) {
    this.storageRepo = storageRepo;
    this.fileRepo = fileRepo;
    this.storageFactory = storageFactory;
  }

  resolveStorage({ storageId, storageMode }) {
    const storageConfig = this.storageRepo.resolveStorageSelection({ storageId, storageMode });
    if (!storageConfig) {
      throw new Error('No available storage configuration.');
    }
    return storageConfig;
  }

  async uploadFile({
    fileName,
    mimeType,
    fileSize,
    buffer,
    storageId,
    storageMode,
    folderPath,
  }) {
    const storageConfig = this.resolveStorage({ storageId, storageMode });
    const adapter = this.storageFactory.createAdapter(storageConfig);
    const storageType = normalizeStorageType(storageConfig.type);
    const normalizedFolderPath = normalizeFolderPath(folderPath);

    const publicId = buildPublicFileId(storageType, fileName, mimeType);

    let adapterStorageKey = normalizedFolderPath ? `${normalizedFolderPath}/${publicId}` : publicId;
    if (storageType === 'huggingface') {
      adapterStorageKey = normalizedFolderPath
        ? `uploads/${normalizedFolderPath}/${publicId}`
        : `uploads/${publicId}`;
    }

    const uploadResult = await adapter.upload({
      storageKey: adapterStorageKey,
      fileName,
      mimeType,
      fileSize,
      buffer,
    });

    const storageKey = uploadResult.storageKey || adapterStorageKey;

    const fileRecord = this.fileRepo.create({
      id: publicId,
      storageConfigId: storageConfig.id,
      storageType,
      storageKey,
      fileName,
      fileSize,
      mimeType,
      folderPath: normalizedFolderPath,
      extra: uploadResult.metadata || {},
    });

    return {
      file: fileRecord,
      src: `/file/${encodeURIComponent(publicId)}`,
      storage: {
        id: storageConfig.id,
        name: storageConfig.name,
        type: storageType,
      },
    };
  }

  async uploadFromUrl({
    url,
    storageId,
    storageMode,
    folderPath,
    maxBytes = 20 * 1024 * 1024,
    allowPrivateNetwork = false,
  }) {
    let parsedUrl = await assertSafeHttpUrl(url, { allowPrivateNetwork });
    let response = null;

    for (let redirectCount = 0; redirectCount <= MAX_UPLOAD_FROM_URL_REDIRECTS; redirectCount += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        response = await fetch(parsedUrl.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'K-Vault/2.0 (+https://github.com/katelya77/K-Vault)',
            Accept: '*/*',
          },
        });
      } finally {
        clearTimeout(timeout);
      }

      if (![301, 302, 303, 307, 308].includes(response.status)) {
        break;
      }

      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`Target URL redirected with ${response.status} but did not provide a location.`);
      }
      parsedUrl = await assertSafeHttpUrl(new URL(location, parsedUrl).toString(), { allowPrivateNetwork });

      if (redirectCount === MAX_UPLOAD_FROM_URL_REDIRECTS) {
        throw new Error('Target URL redirected too many times.');
      }
    }

    if (!response.ok) {
      throw new Error(`Target URL responded with ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const fileBuffer = await readResponseBody(response, maxBytes);

    if (fileBuffer.byteLength === 0) {
      throw new Error('Target URL returned empty body.');
    }

    let fileName = decodeUrlFileName(parsedUrl.pathname);
    if (!fileName) {
      fileName = `url_${Date.now()}`;
    }

    if (!fileName.includes('.')) {
      const ext = String(contentType).split('/')[1]?.split(';')[0] || 'bin';
      fileName = `${fileName}.${ext}`;
    }

    return this.uploadFile({
      fileName,
      mimeType: contentType,
      fileSize: fileBuffer.byteLength,
      buffer: fileBuffer,
      storageId,
      storageMode,
      folderPath,
    });
  }

  async getFileResponse(fileId, rangeHeader) {
    const file = this.fileRepo.getById(fileId);
    if (!file) return null;

    const storageConfig = this.storageRepo.getById(file.storage_config_id, true);
    if (!storageConfig) {
      throw new Error('Storage config referenced by file not found.');
    }

    const adapter = this.storageFactory.createAdapter(storageConfig);
    const response = await adapter.download({
      storageKey: file.storage_key,
      metadata: file.metadata,
      range: rangeHeader,
    });

    if (!response) return null;

    return {
      file,
      response,
    };
  }

  async deleteFile(fileId, { metadataOnly = false } = {}) {
    const file = this.fileRepo.getById(fileId);
    if (!file) return { deleted: false, reason: 'not-found' };

    const storageConfig = this.storageRepo.getById(file.storage_config_id, true);
    if (storageConfig && !metadataOnly) {
      const adapter = this.storageFactory.createAdapter(storageConfig);
      try {
        const remoteDeleted = await adapter.delete({ storageKey: file.storage_key, metadata: file.metadata });
        if (remoteDeleted === false) {
          return {
            deleted: false,
            reason: 'remote-delete-failed',
            error: 'Storage adapter could not confirm remote deletion.',
          };
        }
      } catch (error) {
        return {
          deleted: false,
          reason: 'remote-delete-failed',
          error: error?.message || 'Remote storage deletion failed.',
        };
      }
    }

    const localDeleted = this.fileRepo.delete(fileId);
    if (!localDeleted) return { deleted: false, reason: 'not-found' };

    return {
      deleted: true,
      metadataOnly: Boolean(metadataOnly || !storageConfig),
    };
  }
}

module.exports = {
  UploadService,
};
