<template>
  <Teleport to="body">
    <TransitionGroup name="toast">
      <div
        v-for="toast in uiStore.toasts"
        :key="toast.id"
        class="toast-item"
        :class="`toast-${toast.type}`"
      >
        <span class="toast-dot"></span>
        <span>{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { useUiStore } from '../stores/ui';

const uiStore = useUiStore();
</script>

<style scoped>
.toast-item {
  position: fixed;
  top: 22px;
  right: 22px;
  z-index: 80;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 220px;
  max-width: min(420px, calc(100vw - 32px));
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(12px);
  color: var(--text);
}

.toast-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  flex: 0 0 auto;
  background: var(--accent);
}

.toast-success .toast-dot {
  background: var(--ok);
}

.toast-error .toast-dot {
  background: var(--danger);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms var(--motion-spring);
}

.toast-leave-active {
  transition-duration: 140ms;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

@media (max-width: 640px) {
  .toast-item {
    left: 16px;
    right: 16px;
    min-width: 0;
  }
}
</style>
