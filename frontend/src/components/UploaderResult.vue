<template>
  <div class="result-card">
    <div class="preview-panel">
      <div class="preview-frame">
        <img v-if="isVisualFile" :src="result.previewUrl" :alt="result.fileName" />
        <div v-else class="file-fallback">
          <span>文件已上传</span>
          <strong>{{ result.fileName }}</strong>
        </div>
      </div>
      <div class="preview-meta">
        <strong>{{ result.fileName }}</strong>
        <span>已经上传完成，可以直接复制。</span>
      </div>
    </div>

    <div class="result-main">
      <div class="result-copy">
        <h3>{{ activeLabel }} 已就绪</h3>
        <p>默认先给你 {{ activeLabel }}，需要别的格式时再切换。</p>
      </div>

      <div class="format-toolbar">
        <div class="format-segment">
          <button
            v-for="option in formatOptions"
            :key="option.value"
            type="button"
            class="format-btn"
            :class="{ active: activeFormat === option.value }"
            @click="$emit('change-format', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <textarea :value="formattedText" readonly rows="5"></textarea>

      <div class="result-actions">
        <button class="btn result-primary" type="button" @click="$emit('copy-primary')">复制{{ activeLabel }}</button>
        <button class="link-btn" type="button" @click="$emit('open-preview')">查看原图</button>
        <button class="link-btn" type="button" @click="$emit('next-upload')">继续上传</button>
      </div>

      <div class="recent-strip" v-if="recentResults.length > 1">
        <span class="recent-label">最近上传</span>
        <button
          v-for="item in recentResults.slice(1, 5)"
          :key="item.id"
          type="button"
          class="recent-chip"
          @click="$emit('copy-item', item)"
        >
          {{ item.fileName }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
  recentResults: {
    type: Array,
    default: () => [],
  },
  activeFormat: {
    type: String,
    default: 'markdown',
  },
  formattedText: {
    type: String,
    required: true,
  },
});

defineEmits(['change-format', 'copy-primary', 'copy-item', 'open-preview', 'next-upload']);

const formatOptions = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'url', label: '直链' },
  { value: 'html', label: 'HTML' },
];

const activeLabel = computed(() => formatOptions.find((item) => item.value === props.activeFormat)?.label || 'Markdown');
const isVisualFile = computed(() => /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(`${props.result?.fileName || ''} ${props.result?.previewUrl || ''}`));
</script>

<style scoped>
.result-card {
  display: grid;
  grid-template-columns: minmax(260px, 0.4fr) minmax(0, 0.6fr);
  gap: 34px;
  padding: 10px 0 0;
}

.preview-panel {
  display: grid;
  gap: 14px;
  align-content: start;
}

.preview-frame {
  min-height: 440px;
  overflow: hidden;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(29, 32, 37, 0.96), rgba(17, 19, 24, 0.96));
  box-shadow:
    inset 0 0 0 1px rgba(186, 158, 255, 0.08),
    0 22px 48px rgba(0, 0, 0, 0.24);
}

.preview-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.file-fallback {
  display: grid;
  place-content: center;
  gap: 10px;
  min-height: 440px;
  padding: 28px;
  text-align: center;
}

.file-fallback span {
  color: var(--text-soft);
  font-size: 13px;
}

.file-fallback strong {
  font-family: var(--headline-font);
  font-size: 24px;
  letter-spacing: -0.04em;
}

.preview-meta {
  display: grid;
  gap: 4px;
  padding: 0 4px;
}

.preview-meta span {
  color: var(--text-soft);
  font-size: 13px;
}

.result-main {
  display: grid;
  gap: 18px;
  align-content: start;
  padding: 26px;
  border-radius: 28px;
  border: 1px solid var(--line);
  background:
    radial-gradient(16rem 12rem at 90% 0%, rgba(105, 156, 255, 0.12), transparent 60%),
    linear-gradient(180deg, rgba(23, 26, 31, 0.92), rgba(17, 19, 24, 0.96));
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(18px);
}

.result-copy {
  display: grid;
  gap: 8px;
}

.result-copy h3 {
  margin: 0;
  font-size: clamp(28px, 2.8vw, 38px);
  letter-spacing: -0.05em;
  font-family: var(--headline-font);
  background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.result-copy p {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.7;
}

.format-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.format-segment {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.format-btn {
  border: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: transparent;
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 150ms ease-in-out,
    background 150ms ease-in-out;
}

.format-btn.active {
  color: var(--text);
  background: rgba(186, 158, 255, 0.16);
}

textarea {
  min-height: 148px;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid var(--line);
  background: rgba(12, 14, 18, 0.62);
}

.result-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.result-primary {
  box-shadow: 0 14px 32px rgba(186, 158, 255, 0.22);
}

.link-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-soft);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.link-btn:hover {
  color: var(--text);
}

.recent-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.recent-label {
  color: var(--text-soft);
  font-size: 13px;
}

.recent-chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  cursor: pointer;
}

@media (max-width: 860px) {
  .result-card {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .preview-frame {
    min-height: 300px;
  }

  .result-main {
    padding-top: 0;
  }
}
</style>
