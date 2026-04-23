<template>
  <div class="app-bg">
    <header v-if="!isUploadRoute" class="shell-topbar card">
      <div class="brand-block">
        <router-link class="brand-link" to="/">
          <span class="brand-dot"></span>
          <div class="brand-copy">
            <h1>K-Vault</h1>
            <span>图床档案馆</span>
          </div>
        </router-link>
      </div>

      <div class="shell-actions">
        <button class="icon-btn shell-chip shell-chip-strong" type="button" @click="uiStore.openHistoryDrawer()">
          记录
        </button>
        <details ref="menuRef" class="shell-menu">
          <summary class="icon-btn shell-chip shell-menu-trigger">更多</summary>
          <div class="shell-menu-popover">
            <button class="menu-item" type="button" @click="toggleTheme">
              {{ uiStore.theme === 'dark' ? '切到浅色' : '切到深色' }}
            </button>
            <router-link class="menu-item" to="/status" @click="closeMenu">系统状态</router-link>
            <router-link v-if="authStore.authenticated" class="menu-item" to="/admin" @click="closeMenu">
              文件后台
            </router-link>
            <router-link v-if="authStore.authenticated" class="menu-item" to="/storage" @click="closeMenu">
              存储配置
            </router-link>
            <router-link
              v-if="authStore.authRequired && !authStore.authenticated"
              class="menu-item"
              to="/login"
              @click="closeMenu"
            >
              登录
            </router-link>
            <button v-if="authStore.authenticated" class="menu-item danger" type="button" @click="handleLogout">
              退出登录
            </button>
          </div>
        </details>
      </div>
    </header>

    <section v-if="authStore.guestMode && !isUploadRoute" class="guest-note card">
      <strong>访客模式已开启。</strong>
      <span>
        单文件最大 {{ formatSize(authStore.guestUpload.maxFileSize) }}，每日最多 {{ authStore.guestUpload.dailyLimit }} 次上传。
      </span>
    </section>

    <main class="page-wrap">
      <router-view />
    </main>

    <HistoryDrawer />
    <ToastProvider />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useUiStore } from '../stores/ui';
import HistoryDrawer from './HistoryDrawer.vue';
import ToastProvider from './ToastProvider.vue';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const uiStore = useUiStore();
const menuRef = ref(null);
const isUploadRoute = computed(() => route.name === 'upload');

onMounted(() => {
  uiStore.init();
  document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});

function formatSize(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

async function handleLogout() {
  closeMenu();
  try {
    await authStore.logout();
  } finally {
    router.push('/login');
  }
}

function closeMenu() {
  if (menuRef.value) {
    menuRef.value.open = false;
  }
}

function toggleTheme() {
  closeMenu();
  uiStore.toggleTheme();
}

function onDocumentClick(event) {
  if (!(event.target instanceof Node)) return;
  if (menuRef.value?.open && !menuRef.value.contains(event.target)) {
    closeMenu();
  }
}
</script>

<style scoped>
.shell-topbar {
  position: sticky;
  top: 14px;
  z-index: 20;
  width: min(100%, 1040px);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(12, 14, 18, 0.56);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(24px);
}

.brand-block {
  min-width: 0;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
}

.brand-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  box-shadow: 0 0 0 6px rgba(186, 158, 255, 0.08);
}

.brand-copy {
  display: grid;
  gap: 2px;
}

.brand-link h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  font-family: var(--headline-font);
  letter-spacing: -0.04em;
}

.brand-copy span {
  font-size: 11px;
  color: var(--text-soft);
}

.shell-actions {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 10px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity 150ms ease-in-out,
    color 150ms ease-in-out;
}

.shell-chip {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-soft);
}

.shell-chip:hover,
.shell-chip.router-link-active,
.shell-menu[open] .shell-menu-trigger {
  border-color: rgba(186, 158, 255, 0.24);
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.shell-chip-strong {
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent), #ae8dff);
  color: #19001e;
  box-shadow: 0 10px 24px rgba(186, 158, 255, 0.2);
}

.shell-chip-strong:hover {
  color: #19001e;
}

.shell-menu {
  position: relative;
}

.shell-menu summary {
  list-style: none;
}

.shell-menu summary::-webkit-details-marker {
  display: none;
}

.shell-menu-popover {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  min-width: 184px;
  display: grid;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(23, 26, 31, 0.92);
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(18px);
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  border: 0;
  border-radius: 12px;
  padding: 10px 12px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.menu-item.danger {
  color: #b42318;
}

@media (max-width: 860px) {
  .shell-topbar {
    align-items: start;
    flex-direction: column;
    width: 100%;
    border-radius: 24px;
  }

  .shell-actions {
    justify-content: start;
    gap: 10px;
  }
}
</style>
