<template>
  <section class="uploader-shell">
    <div v-if="statusText" class="surface-head">
      <span class="surface-meta">{{ statusText }}</span>
    </div>

    <input ref="picker" type="file" multiple hidden @change="handleFilePick" />

    <Transition name="surface" mode="out-in">
      <UploaderDropzone
        v-if="uploadStore.currentState === 'idle'"
        key="idle"
        :drag-active="dragActive"
        :show-url-input="showUrlInput"
        :url-value="urlValue"
        :helper-text="helperText"
        @choose="openPicker"
        @paste="pasteFromClipboard"
        @toggle-url="showUrlInput = !showUrlInput"
        @submit-url="submitUrl"
        @update:url-value="urlValue = $event"
        @dragover="dragActive = true"
        @dragleave="dragActive = false"
        @drop="handleDrop"
      />

      <UploaderProgress
        v-else-if="uploadStore.currentState === 'uploading'"
        key="uploading"
        :item="uploadStore.currentItem"
        :pending-count="uploadStore.pendingCount"
        :completed-count="uploadStore.completedCount"
        :format-bytes="uploadStore.formatBytes"
        @cancel="uploadStore.cancelCurrentUpload"
      />

      <UploaderResult
        v-else
        key="success"
        :result="uploadStore.latestResult"
        :recent-results="uploadStore.recentResults"
        :active-format="uploadStore.prefs.linkFormat"
        :formatted-text="uploadStore.formatResult(uploadStore.latestResult)"
        @change-format="uploadStore.updatePrefs({ linkFormat: $event })"
        @copy-primary="uploadStore.copyFormattedResult(uploadStore.latestResult)"
        @copy-item="uploadStore.copyFormattedResult($event)"
        @open-preview="openPreview"
        @next-upload="nextUpload"
      />
    </Transition>

    <div class="surface-foot" v-if="uploadStore.error">
      <p class="error">{{ uploadStore.error }}</p>
      <button
        v-if="uploadStore.failedCount > 0 && uploadStore.queue.find((item) => item.status === 'error')"
        class="btn btn-ghost"
        type="button"
        @click="retryFirstFailed"
      >
        重试失败项
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useUploadStore } from '../stores/upload';
import UploaderDropzone from './UploaderDropzone.vue';
import UploaderProgress from './UploaderProgress.vue';
import UploaderResult from './UploaderResult.vue';

const uploadStore = useUploadStore();

const picker = ref(null);
const dragActive = ref(false);
const showUrlInput = ref(false);
const urlValue = ref('');

const helperText = computed(() => uploadStore.isUploadAvailable ? '单文件最大 100MB' : '当前上传不可用，请先检查状态页');
const statusText = computed(() => {
  if (uploadStore.currentState === 'uploading') return '上传中';
  if (uploadStore.currentState === 'success') return '链接已就绪';
  return '';
});

onMounted(() => {
  void uploadStore.initialize();
  window.addEventListener('paste', onPaste);
});

onUnmounted(() => {
  window.removeEventListener('paste', onPaste);
});

function openPicker() {
  picker.value?.click();
}

function handleFilePick(event) {
  const files = Array.from(event.target.files || []);
  uploadStore.enqueueFiles(files);
  event.target.value = '';
}

function handleDrop(event) {
  dragActive.value = false;
  const files = Array.from(event.dataTransfer?.files || []);
  uploadStore.enqueueFiles(files);
}

async function pasteFromClipboard() {
  try {
    const items = await navigator.clipboard.read();
    const files = [];
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const ext = type.split('/')[1];
          files.push(new File([blob], `clipboard_${Date.now()}.${ext}`, { type }));
        }
      }
    }
    if (files.length) {
      uploadStore.enqueueFiles(files);
    }
  } catch {
    // The global error surface is enough here; keep clipboard failures silent.
  }
}

function onPaste(event) {
  const files = Array.from(event.clipboardData?.files || []);
  if (files.length) {
    uploadStore.enqueueFiles(files);
  }
}

async function submitUrl() {
  if (!urlValue.value) return;
  await uploadStore.uploadFromUrl(urlValue.value);
  urlValue.value = '';
  showUrlInput.value = false;
}

function nextUpload() {
  uploadStore.resetSurface();
  showUrlInput.value = false;
}

function openPreview() {
  if (!uploadStore.latestResult?.previewUrl) return;
  window.open(uploadStore.latestResult.previewUrl, '_blank', 'noopener');
}

function retryFirstFailed() {
  const firstFailed = uploadStore.queue.find((item) => item.status === 'error');
  if (firstFailed) {
    uploadStore.retryItem(firstFailed.id);
  }
}
</script>

<style scoped>
.uploader-shell {
  display: grid;
  gap: 8px;
  width: 100%;
  margin: 0;
}

.surface-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 18px;
}

.surface-meta {
  color: var(--text-soft);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.surface-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.surface-enter-active,
.surface-leave-active {
  transition:
    opacity 240ms ease,
    transform 240ms var(--motion-spring);
}

.surface-enter-from,
.surface-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.985);
}

@media (max-width: 720px) {
  .uploader-shell {
    width: 100%;
  }

  .surface-head {
    justify-content: flex-start;
  }
}
</style>
