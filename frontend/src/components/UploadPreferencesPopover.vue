<template>
  <div class="preferences-shell">
    <button class="preferences-trigger" type="button" @click="open = !open">
      <span>链接格式</span>
      <strong>{{ activeLabel }}</strong>
    </button>

    <Transition name="popover">
      <div v-if="open" class="preferences-popover">
        <div class="field-block">
          <span class="field-label">默认链接格式</span>
          <div class="segment">
            <button
              v-for="option in options"
              :key="option.value"
              class="segment-btn"
              :class="{ active: modelValue.linkFormat === option.value }"
              type="button"
              @click="update({ linkFormat: option.value })"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <label class="toggle-line">
          <input
            :checked="modelValue.autoCopy"
            type="checkbox"
            @change="update({ autoCopy: $event.target.checked })"
          />
          上传成功后自动复制 Markdown
        </label>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue']);

const options = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'url', label: '直链' },
  { value: 'html', label: 'HTML' },
];

const open = ref(false);
const activeLabel = computed(() => options.find((item) => item.value === props.modelValue.linkFormat)?.label || 'Markdown');

function update(partial) {
  emit('update:modelValue', { ...props.modelValue, ...partial });
}
</script>

<style scoped>
.preferences-shell {
  position: relative;
}

.preferences-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 150ms ease-in-out,
    opacity 150ms ease-in-out;
}

.preferences-trigger strong {
  color: var(--text);
}

.preferences-trigger:hover {
  color: var(--text);
}

.preferences-popover {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  min-width: 272px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 28px 50px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(12px);
  z-index: 10;
}

.field-block {
  display: grid;
  gap: 10px;
}

.field-label {
  font-size: 12px;
  color: var(--text-soft);
}

.segment {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 6px;
  border-radius: 14px;
  background: var(--surface-muted);
}

.segment-btn {
  border: 0;
  border-radius: 10px;
  padding: 9px 10px;
  background: transparent;
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease-in-out;
}

.segment-btn.active {
  background: rgba(61, 108, 255, 0.12);
  color: var(--accent);
}

.toggle-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  color: var(--text);
  font-size: 13px;
}

.popover-enter-active,
.popover-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms var(--motion-spring);
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
