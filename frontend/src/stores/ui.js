import { defineStore } from 'pinia';
import { ref } from 'vue';

const THEME_STORAGE_KEY = 'kvault:theme';

function readThemePreference() {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
}

function syncTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

let toastSeed = 0;

export const useUiStore = defineStore('ui', () => {
  const theme = ref(readThemePreference());
  const historyDrawerOpen = ref(false);
  const toasts = ref([]);

  function init() {
    syncTheme(theme.value);
  }

  function setTheme(nextTheme) {
    theme.value = nextTheme;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
    syncTheme(nextTheme);
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark');
  }

  function openHistoryDrawer() {
    historyDrawerOpen.value = true;
  }

  function closeHistoryDrawer() {
    historyDrawerOpen.value = false;
  }

  function pushToast(message, type = 'success', duration = 2600) {
    const id = `toast_${Date.now()}_${toastSeed += 1}`;
    toasts.value.push({ id, message, type });
    if (typeof window !== 'undefined' && duration > 0) {
      window.setTimeout(() => removeToast(id), duration);
    }
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter((item) => item.id !== id);
  }

  return {
    theme,
    historyDrawerOpen,
    toasts,
    init,
    setTheme,
    toggleTheme,
    openHistoryDrawer,
    closeHistoryDrawer,
    pushToast,
    removeToast,
  };
});
