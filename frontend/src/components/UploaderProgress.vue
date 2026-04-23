<template>
  <div class="state-card">
    <div class="progress-ring" :style="{ '--progress': progress }">
      <span>{{ progress }}%</span>
    </div>

    <div class="progress-copy">
      <h3>{{ item?.file?.name || '正在上传' }}</h3>
      <p>{{ metaLine }}</p>
    </div>

    <div class="progress-bar">
      <span :style="{ width: `${progress}%` }"></span>
    </div>

    <div class="progress-footer">
      <span>{{ footerText }}</span>
      <button class="btn btn-ghost" type="button" @click="$emit('cancel')">取消当前上传</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  item: {
    type: Object,
    default: null,
  },
  pendingCount: {
    type: Number,
    default: 0,
  },
  completedCount: {
    type: Number,
    default: 0,
  },
  formatBytes: {
    type: Function,
    required: true,
  },
});

defineEmits(['cancel']);

const progress = computed(() => props.item?.progress || 0);
const metaLine = computed(() => {
  if (!props.item?.file) return '请稍候，正在处理上传。';
  return `${props.formatBytes(props.item.file.size)} · 默认输出 Markdown`;
});
const footerText = computed(() => {
  if (props.pendingCount > 0) {
    return `后面还有 ${props.pendingCount} 个文件排队中`;
  }
  if (props.completedCount > 0) {
    return `已完成 ${props.completedCount} 个文件`;
  }
  return '上传完成后会自动显示结果';
});
</script>

<style scoped>
.state-card {
  display: grid;
  gap: 18px;
  padding: 28px;
  border-radius: 28px;
  background:
    radial-gradient(22rem 14rem at 50% -10%, rgba(186, 158, 255, 0.16), transparent 56%),
    linear-gradient(180deg, rgba(23, 26, 31, 0.92), rgba(17, 19, 24, 0.96));
  border: 1px solid var(--line);
  box-shadow: 0 28px 50px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(20px);
}

.progress-ring {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  margin: 0 auto;
  border-radius: 999px;
  background:
    radial-gradient(circle at center, rgba(12, 14, 18, 0.9) 42%, transparent 43%),
    conic-gradient(var(--accent) calc(var(--progress, 0) * 1%), rgba(105, 156, 255, 0.12) 0);
  color: var(--accent);
  font-size: 24px;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(186, 158, 255, 0.08);
}

.progress-copy {
  text-align: center;
  display: grid;
  gap: 8px;
}

.progress-copy h3 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.03em;
  font-family: var(--headline-font);
}

.progress-copy p {
  margin: 0;
  color: var(--text-soft);
}

.progress-bar {
  overflow: hidden;
  height: 12px;
  border-radius: 999px;
  background: var(--surface-muted);
}

.progress-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
  transition: width 220ms ease;
}

.progress-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-soft);
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .state-card {
    padding: 22px;
  }

  .progress-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
