import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { absoluteFileUrl, apiFetch, getApiBase } from '../api/client';
import { useUiStore } from './ui';
import { resolveCurrentUploadState } from './upload-state';

const PREFS_STORAGE_KEY = 'kvault:upload-prefs';
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const SMALL_FILE_THRESHOLD = 20 * 1024 * 1024;
const V2_ACCEPT = 'application/vnd.kvault.v2+json, application/json;q=0.9, text/plain;q=0.5, */*;q=0.1';
const STORAGE_STATUS_TYPES = ['telegram', 'r2', 's3', 'discord', 'huggingface', 'github', 'webdav'];

function readPrefs() {
  if (typeof window === 'undefined') {
    return { linkFormat: 'markdown', autoCopy: true };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { linkFormat: 'markdown', autoCopy: true };
    const parsed = JSON.parse(raw);
    return {
      linkFormat: parsed.linkFormat || 'markdown',
      autoCopy: parsed.autoCopy !== false,
    };
  } catch {
    return { linkFormat: 'markdown', autoCopy: true };
  }
}

function persistPrefs(prefs) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function truncate(text, maxLength = 220) {
  const value = String(text || '');
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      return true;
    } catch {
      return false;
    }
  }
}

export const useUploadStore = defineStore('upload', () => {
  const uiStore = useUiStore();
  const initialized = ref(false);
  const availability = ref(null);
  const queue = ref([]);
  const results = ref([]);
  const processing = ref(false);
  const currentItemId = ref('');
  const phase = ref('idle');
  const error = ref('');
  const prefs = ref(readPrefs());

  const currentItem = computed(() => queue.value.find((item) => item.id === currentItemId.value) || null);
  const latestResult = computed(() => results.value[0] || null);
  const recentResults = computed(() => results.value.slice(0, 6));
  const pendingCount = computed(() => queue.value.filter((item) => item.status === 'pending').length);
  const uploadingCount = computed(() => queue.value.filter((item) => item.status === 'uploading').length);
  const failedCount = computed(() => queue.value.filter((item) => item.status === 'error').length);
  const completedCount = computed(() => queue.value.filter((item) => item.status === 'success').length);
  const isUploadAvailable = computed(() => {
    if (!availability.value) return true;
    return STORAGE_STATUS_TYPES.some((type) => {
      const item = availability.value[type] || {};
      return item.configured && item.enabled !== false;
    });
  });
  const isTelegramAvailable = isUploadAvailable;
  const currentState = computed(() => {
    return resolveCurrentUploadState({
      processing: processing.value,
      phase: phase.value,
      hasLatestResult: Boolean(latestResult.value),
    });
  });

  async function initialize(force = false) {
    if (initialized.value && !force) return;
    try {
      availability.value = await apiFetch('/api/status');
      initialized.value = true;
    } catch (err) {
      initialized.value = true;
      error.value = err.message || '加载上传状态失败。';
      phase.value = results.value.length ? 'success' : 'error';
    }
  }

  function updatePrefs(partial) {
    prefs.value = { ...prefs.value, ...partial };
    persistPrefs(prefs.value);
  }

  function apiUrl(path) {
    return `${getApiBase()}${path}`;
  }

  function toAbsoluteUrl(path) {
    return new URL(path, window.location.origin).toString();
  }

  function resolveUploadErrorMessage(payload, statusCode, rawText = '') {
    if (payload && typeof payload === 'object') {
      const nestedMessage = typeof payload?.error?.message === 'string' ? payload.error.message : '';
      const message = nestedMessage
        || payload?.error
        || payload?.message
        || payload?.errorDetail
        || payload?.detail;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }

    if (rawText) {
      return `后端返回了非 JSON 响应（${statusCode}）：${truncate(rawText)}`;
    }
    return `上传失败（${statusCode}）`;
  }

  function humanizeError(message) {
    const text = String(message || '');
    const normalized = text.toLowerCase();

    if (normalized.includes('auth_failed') || normalized.includes('unauthorized') || normalized.includes('forbidden')) {
      return `鉴权失败：${text}`;
    }
    if (normalized.includes('rate') || normalized.includes('too many requests') || normalized.includes('flood')) {
      return `触发频率限制：${text}`;
    }
    if (
      normalized.includes('quota')
      || normalized.includes('limit exceeded')
      || normalized.includes('too large')
      || normalized.includes('413')
    ) {
      return `文件大小或配额超限：${text}`;
    }
    if (normalized.includes('network') || normalized.includes('timeout') || normalized.includes('fetch failed')) {
      return `网络或上游连接异常：${text}`;
    }
    if (normalized.includes('not configured')) {
      return `存储尚未配置：${text}`;
    }
    return text || '上传失败';
  }

  function buildResult({ id, fileName, fileUrl, size = 0, createdAt = Date.now() }) {
    const markdown = `![${fileName}](${fileUrl})`;
    return {
      id,
      fileName,
      fileUrl,
      previewUrl: fileUrl,
      size,
      createdAt,
      markdown,
      html: `<img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(fileName)}" />`,
      status: 'success',
    };
  }

  function formatResult(result, format = prefs.value.linkFormat) {
    if (!result) return '';
    if (format === 'html') return result.html;
    if (format === 'url') return result.fileUrl;
    return result.markdown;
  }

  async function copyFormattedResult(result, format = prefs.value.linkFormat) {
    if (!result) return false;
    const copied = await copyText(formatResult(result, format));
    if (copied) {
      uiStore.pushToast(
        format === 'markdown' ? '已复制 Markdown 链接' : '已复制链接',
        'success',
      );
    } else {
      uiStore.pushToast('复制失败，请手动复制', 'error');
    }
    return copied;
  }

  function clearFinishedQueue() {
    queue.value = queue.value.filter((item) => item.status === 'pending' || item.status === 'uploading' || item.status === 'error');
  }

  function resetSurface() {
    phase.value = 'idle';
    error.value = '';
    clearFinishedQueue();
  }

  function enqueueFiles(files) {
    const normalized = files
      .filter(Boolean)
      .map((file) => ({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        file,
        progress: 0,
        status: 'pending',
        error: '',
        createdAt: Date.now(),
      }));

    if (!normalized.length) return;
    queue.value.unshift(...normalized);
    phase.value = 'uploading';
    error.value = '';
    void processQueue();
  }

  async function directUpload(item) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', item.file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', apiUrl('/upload'));
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept', V2_ACCEPT);
      xhr.setRequestHeader('X-KVault-Client', 'app-v2');
      item.xhr = xhr;

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        item.progress = Math.max(1, Math.floor((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        item.xhr = null;
        const rawText = String(xhr.responseText || '');
        const body = parseJsonSafe(rawText);

        if (xhr.status < 200 || xhr.status >= 300) {
          const message = resolveUploadErrorMessage(body, xhr.status, rawText);
          reject(new Error(humanizeError(message)));
          return;
        }

        const src = Array.isArray(body)
          ? body[0]?.src
          : (body?.src || body?.data?.src || body?.data?.items?.[0]?.src || body?.items?.[0]?.src);

        if (!src) {
          if (!body) {
            reject(new Error(`后端返回了非 JSON 响应：${truncate(rawText) || '<empty body>'}`));
            return;
          }
          reject(new Error('上传响应里缺少 src 字段'));
          return;
        }
        resolve(toAbsoluteUrl(src));
      };

      xhr.onerror = () => reject(new Error('网络异常'));
      xhr.send(formData);
    });
  }

  async function chunkUpload(item) {
    const requestedTotalChunks = Math.ceil(item.file.size / DEFAULT_CHUNK_SIZE);

    const init = await apiFetch('/api/chunked-upload/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: V2_ACCEPT,
        'X-KVault-Client': 'app-v2',
      },
      body: JSON.stringify({
        fileName: item.file.name,
        fileSize: item.file.size,
        fileType: item.file.type,
        totalChunks: requestedTotalChunks,
      }),
    });

    const uploadId = init.uploadId;
    const chunkSize = Number(init.chunkSize || DEFAULT_CHUNK_SIZE);
    const totalChunks = Number(init.totalChunks || Math.ceil(item.file.size / chunkSize));

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(item.file.size, start + chunkSize);
      const chunk = item.file.slice(start, end);

      const chunkBody = new FormData();
      chunkBody.append('uploadId', uploadId);
      chunkBody.append('chunkIndex', String(index));
      chunkBody.append('chunk', chunk);

      await apiFetch('/api/chunked-upload/chunk', {
        method: 'POST',
        headers: {
          Accept: V2_ACCEPT,
          'X-KVault-Client': 'app-v2',
        },
        body: chunkBody,
      });

      item.progress = Math.min(95, Math.floor(((index + 1) / totalChunks) * 95));
    }

    const done = await apiFetch('/api/chunked-upload/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: V2_ACCEPT,
        'X-KVault-Client': 'app-v2',
      },
      body: JSON.stringify({ uploadId }),
    });

    if (!done?.src) {
      throw new Error('分片上传完成响应里缺少 src 字段');
    }

    return toAbsoluteUrl(done.src);
  }

  async function uploadFile(item) {
    return item.file.size > SMALL_FILE_THRESHOLD ? chunkUpload(item) : directUpload(item);
  }

  async function processQueue() {
    if (processing.value) return;
    processing.value = true;
    error.value = '';

    try {
      for (const item of queue.value) {
        if (item.status !== 'pending') continue;
        currentItemId.value = item.id;
        item.status = 'uploading';
        item.error = '';
        phase.value = 'uploading';

        try {
          const fileUrl = await uploadFile(item);
          item.status = 'success';
          item.progress = 100;
          const result = buildResult({
            id: item.id,
            fileName: item.file.name,
            fileUrl,
            size: item.file.size,
            createdAt: item.createdAt,
          });
          results.value.unshift(result);
          results.value = results.value.slice(0, 40);
          phase.value = 'success';

          if (prefs.value.autoCopy) {
            await copyFormattedResult(result, 'markdown');
          }
        } catch (err) {
          item.status = 'error';
          item.error = humanizeError(err.message || '上传失败');
          error.value = item.error;
          phase.value = results.value.length ? 'success' : 'error';
        }
      }
    } finally {
      processing.value = false;
      currentItemId.value = '';
    }
  }

  async function uploadFromUrl(url) {
    if (!url) return null;
    phase.value = 'uploading';
    error.value = '';
    try {
      const body = await apiFetch('/api/upload-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: V2_ACCEPT,
          'X-KVault-Client': 'app-v2',
        },
        body: JSON.stringify({
          url,
        }),
      });

      const src = Array.isArray(body) ? body[0]?.src : body?.src;
      if (!src) {
        throw new Error('上传响应里缺少 src 字段');
      }
      const fileUrl = toAbsoluteUrl(src);
      const result = buildResult({
        id: `url_${Date.now()}`,
        fileName: url.split('/').pop() || 'remote-file',
        fileUrl,
      });
      results.value.unshift(result);
      results.value = results.value.slice(0, 40);
      phase.value = 'success';
      if (prefs.value.autoCopy) {
        await copyFormattedResult(result, 'markdown');
      }
      return result;
    } catch (err) {
      error.value = humanizeError(err.message || '链接上传失败');
      phase.value = results.value.length ? 'success' : 'error';
      throw err;
    }
  }

  function retryItem(itemId) {
    const item = queue.value.find((entry) => entry.id === itemId);
    if (!item) return;
    item.status = 'pending';
    item.error = '';
    item.progress = 0;
    phase.value = 'uploading';
    void processQueue();
  }

  function cancelCurrentUpload() {
    const item = currentItem.value;
    if (!item?.xhr) return;
    item.xhr.abort();
    item.status = 'error';
    item.error = 'Upload canceled.';
    error.value = item.error;
    phase.value = results.value.length ? 'success' : 'error';
  }

  return {
    availability,
    queue,
    results,
    prefs,
    phase,
    error,
    currentItem,
    currentState,
    recentResults,
    latestResult,
    pendingCount,
    uploadingCount,
    failedCount,
    completedCount,
    isTelegramAvailable,
    isUploadAvailable,
    initialize,
    updatePrefs,
    enqueueFiles,
    uploadFromUrl,
    formatResult,
    copyFormattedResult,
    retryItem,
    cancelCurrentUpload,
    resetSurface,
    clearFinishedQueue,
    formatBytes,
  };
});
