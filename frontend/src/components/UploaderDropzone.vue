<template>
  <div
    class="dropzone-card"
    :class="{ active: dragActive }"
    @dragover.prevent="$emit('dragover')"
    @dragleave.prevent="$emit('dragleave')"
    @drop.prevent="$emit('drop', $event)"
    @click="$emit('choose')"
  >
    <div class="dropzone-main">
      <span class="dropzone-icon">↑</span>
      <div class="dropzone-copy">
        <span class="dropzone-eyebrow">上传后默认给你 Markdown 链接</span>
        <h2>拖入即可上传</h2>
        <p>把资源拖进流场里，或者点一下按钮，从本地、剪贴板和链接导入都可以。</p>
      </div>
    </div>

    <div class="dropzone-actions">
      <button type="button" class="primary-btn" @click.stop="$emit('choose')">选择文件</button>
      <button type="button" class="secondary-btn" @click.stop="$emit('paste')">粘贴截图</button>
      <button type="button" class="secondary-btn" @click.stop="$emit('toggle-url')">导入链接</button>
    </div>

    <Transition name="url-sheet">
      <form v-if="showUrlInput" class="url-sheet" @submit.prevent="$emit('submit-url')">
        <input
          :value="urlValue"
          placeholder="粘贴图片链接或文件直链"
          @input="$emit('update:urlValue', $event.target.value)"
          @click.stop
        />
        <button class="btn" type="submit">导入</button>
      </form>
    </Transition>

    <div class="dropzone-foot">
      <span class="foot-pill">支持 RAW、PNG、JPG、动图和常见文件</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  dragActive: Boolean,
  showUrlInput: Boolean,
  urlValue: {
    type: String,
    default: '',
  },
  helperText: {
    type: String,
    default: '单文件最大 100MB',
  },
});

defineEmits([
  'choose',
  'paste',
  'toggle-url',
  'submit-url',
  'update:urlValue',
  'dragover',
  'dragleave',
  'drop',
]);
</script>

<style scoped>
.dropzone-card {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 20px;
  min-height: 420px;
  padding: 42px 42px 28px;
  border-radius: 42px;
  border: 1px solid var(--line);
  background:
    radial-gradient(28rem 20rem at 50% 18%, rgba(186, 158, 255, 0.14), transparent 56%),
    radial-gradient(24rem 18rem at 72% 28%, rgba(105, 156, 255, 0.1), transparent 54%),
    linear-gradient(180deg, rgba(23, 26, 31, 0.9), rgba(17, 19, 24, 0.94));
  cursor: pointer;
  box-shadow: 0 26px 60px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(24px);
  transition:
    transform var(--motion-medium) var(--motion-spring),
    background var(--motion-fast) ease-in-out;
}

.dropzone-card::before {
  content: '';
  position: absolute;
  inset: 16px;
  border: 1px dashed rgba(170, 171, 176, 0.18);
  border-radius: 32px;
  pointer-events: none;
}

.dropzone-card::after {
  content: '';
  position: absolute;
  inset: auto auto 38px 50%;
  width: 16rem;
  height: 16rem;
  transform: translateX(-50%);
  border-radius: 999px;
  border: 1px solid rgba(186, 158, 255, 0.08);
  box-shadow:
    0 0 0 56px rgba(186, 158, 255, 0.025),
    0 0 0 116px rgba(105, 156, 255, 0.02);
  pointer-events: none;
  opacity: 0.7;
}

.dropzone-card:hover,
.dropzone-card.active {
  transform: translateY(-1px);
  background:
    radial-gradient(28rem 20rem at 50% 18%, rgba(186, 158, 255, 0.18), transparent 56%),
    radial-gradient(24rem 18rem at 72% 28%, rgba(105, 156, 255, 0.14), transparent 54%),
    linear-gradient(180deg, rgba(29, 32, 37, 0.92), rgba(17, 19, 24, 0.98));
}

.dropzone-main {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 16px;
  align-content: center;
  justify-items: center;
  text-align: center;
  min-height: 0;
  padding-top: 18px;
}

.dropzone-icon {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
  border: 1px solid rgba(186, 158, 255, 0.14);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.22);
  color: var(--accent);
  font-size: 34px;
  font-weight: 700;
}

.dropzone-copy {
  display: grid;
  gap: 12px;
  max-width: 640px;
}

.dropzone-eyebrow {
  justify-self: center;
  padding: 8px 14px;
  border: 1px solid rgba(186, 158, 255, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: #d7c6ff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.dropzone-copy h2 {
  margin: 0;
  font-size: clamp(34px, 4vw, 48px);
  line-height: 1;
  letter-spacing: -0.055em;
  font-family: var(--headline-font);
}

.dropzone-copy p {
  margin: 0;
  font-size: 14px;
  color: var(--text-soft);
  line-height: 1.7;
}

.dropzone-actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.primary-btn {
  min-width: 176px;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 14px 22px;
  background: linear-gradient(135deg, var(--accent), #ae8dff);
  color: #19001e;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 150ms ease-in-out,
    box-shadow 150ms ease-in-out;
}

.primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 38px rgba(186, 158, 255, 0.24);
}

.secondary-btn {
  min-width: 150px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 150ms ease-in-out,
    border-color 150ms ease-in-out,
    background 150ms ease-in-out;
}

.secondary-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(186, 158, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.url-sheet {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.url-sheet input {
  min-width: 0;
}

.dropzone-foot {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  text-align: center;
}

.foot-pill {
  padding: 10px 16px;
  border: 1px solid rgba(105, 249, 236, 0.12);
  border-radius: 999px;
  background: rgba(15, 29, 48, 0.9);
  color: var(--text-soft);
  font-size: 12px;
}

@media (max-width: 720px) {
  .dropzone-card {
    min-height: 380px;
    padding: 32px 20px 22px;
    border-radius: 28px;
  }

  .dropzone-card::before {
    inset: 16px;
    border-radius: 22px;
  }

  .dropzone-copy h2 {
    font-size: clamp(38px, 12vw, 52px);
  }

  .dropzone-foot {
    justify-content: flex-start;
  }
}

.url-sheet-enter-active,
.url-sheet-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms var(--motion-spring);
}

.url-sheet-enter-from,
.url-sheet-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 720px) {
  .dropzone-card {
    min-height: 336px;
    padding: 24px;
    border-radius: 26px;
  }

  .dropzone-card::before {
    inset: 14px;
  }

  .url-sheet {
    grid-template-columns: 1fr;
  }

  .dropzone-actions {
    justify-content: stretch;
  }

  .primary-btn,
  .secondary-btn {
    width: 100%;
  }

  .dropzone-foot {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
