<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="uiStore.historyDrawerOpen" class="drawer-backdrop" @click="uiStore.closeHistoryDrawer()"></div>
    </Transition>

    <Transition name="drawer-panel">
      <aside v-if="uiStore.historyDrawerOpen" class="drawer-panel">
        <header class="drawer-header">
          <div>
            <span class="drawer-eyebrow">记录</span>
            <h2>最近上传</h2>
          </div>
          <div class="drawer-head-actions">
            <button class="btn btn-ghost" type="button" @click="goHistoryPage">全部记录</button>
            <button class="icon-btn" type="button" @click="uiStore.closeHistoryDrawer()">×</button>
          </div>
        </header>

        <template v-if="authStore.authRequired && !authStore.authenticated">
          <div class="drawer-empty">
            <h3>登录后可查看完整历史</h3>
            <p>访客模式依然能上传，但历史和删除等管理能力只保留给管理员。</p>
            <button class="btn" type="button" @click="router.push('/login')">前往登录</button>
          </div>
        </template>

        <template v-else>
          <div class="drawer-toolbar">
            <input
              :value="historyStore.search"
              placeholder="搜索文件名"
              @input="historyStore.setSearch($event.target.value)"
              @keyup.enter="historyStore.loadHistory({ reset: true })"
            />
            <button class="btn btn-ghost" type="button" @click="historyStore.loadHistory({ reset: true })">
              搜索
            </button>
          </div>

          <div class="drawer-actions">
            <button class="btn btn-ghost" type="button" @click="historyStore.toggleSelectAll()">
              {{ historyStore.selectedIds.length === historyStore.items.length && historyStore.items.length ? '取消全选' : '全选' }}
            </button>
            <button class="btn btn-ghost" type="button" :disabled="!historyStore.selectedIds.length" @click="historyStore.copyItems()">
              复制选中
            </button>
            <button class="btn btn-danger" type="button" :disabled="!historyStore.selectedIds.length" @click="historyStore.deleteSelected()">
              删除
            </button>
          </div>

          <div class="drawer-list">
            <article v-for="item in historyStore.items" :key="item.id" class="history-card">
              <label class="history-check">
                <input
                  type="checkbox"
                  :checked="historyStore.selectedSet.has(item.id)"
                  @change="historyStore.toggleSelect(item.id)"
                />
              </label>

              <a :href="item.previewUrl" target="_blank" rel="noopener" class="history-thumb">
                <img :src="item.previewUrl" :alt="item.fileName" loading="lazy" />
              </a>

              <div class="history-main">
                <strong>{{ item.fileName }}</strong>
                <span>{{ formatRelativeTime(item.createdAt) }}</span>
              </div>

              <div class="history-actions">
                <button class="icon-btn" type="button" @click="historyStore.copyItems([item])">复制</button>
                <button class="icon-btn icon-danger" type="button" @click="historyStore.deleteOne(item.id)">删</button>
              </div>
            </article>

            <div v-if="!historyStore.loading && !historyStore.items.length" class="drawer-empty">
              <h3>还没有上传记录</h3>
              <p>上传后的内容会出现在这里，便于稍后复制和管理。</p>
            </div>
          </div>

          <div class="drawer-footer">
            <button
              v-if="historyStore.nextCursor"
              class="btn btn-ghost"
              type="button"
              :disabled="historyStore.loading"
              @click="historyStore.loadHistory({ reset: false })"
            >
              {{ historyStore.loading ? '加载中...' : '加载更多' }}
            </button>
            <p v-if="historyStore.error" class="error">{{ historyStore.error }}</p>
          </div>
        </template>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useHistoryStore } from '../stores/history';
import { useUiStore } from '../stores/ui';

const authStore = useAuthStore();
const historyStore = useHistoryStore();
const uiStore = useUiStore();
const router = useRouter();

watch(
  () => uiStore.historyDrawerOpen,
  (open) => {
    if (open && (!historyStore.hydrated || !historyStore.items.length)) {
      void historyStore.loadHistory({ reset: true });
    }
  },
);

function goHistoryPage() {
  uiStore.closeHistoryDrawer();
  router.push('/history');
}

function formatRelativeTime(value) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  return `${Math.floor(diff / day)} 天前`;
}
</script>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(8px);
  z-index: 60;
}

.drawer-panel {
  position: fixed;
  top: 14px;
  right: 14px;
  bottom: 14px;
  width: min(460px, calc(100vw - 28px));
  display: grid;
  grid-template-rows: auto auto auto 1fr auto;
  gap: 14px;
  padding: 20px;
  border-radius: 28px;
  border: 1px solid var(--line);
  background:
    radial-gradient(18rem 12rem at 100% 0%, rgba(186, 158, 255, 0.12), transparent 58%),
    linear-gradient(180deg, rgba(23, 26, 31, 0.94), rgba(17, 19, 24, 0.98));
  box-shadow: 0 32px 70px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(24px);
  z-index: 70;
}

.drawer-header,
.drawer-toolbar,
.drawer-actions,
.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.drawer-eyebrow {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.drawer-header h2 {
  margin: 4px 0 0;
  font-size: 28px;
  letter-spacing: -0.04em;
  font-family: var(--headline-font);
}

.drawer-head-actions {
  display: flex;
  gap: 10px;
}

.icon-btn {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 9px 10px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  cursor: pointer;
}

.icon-danger {
  color: var(--danger);
}

.drawer-toolbar input {
  flex: 1 1 200px;
}

.drawer-list {
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 10px;
  padding-right: 4px;
}

.history-card {
  display: grid;
  grid-template-columns: auto 74px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
}

.history-thumb {
  overflow: hidden;
  width: 74px;
  height: 74px;
  border-radius: 16px;
  background: var(--surface-muted);
  box-shadow: inset 0 0 0 1px rgba(186, 158, 255, 0.06);
}

.history-thumb img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.history-main {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.history-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-main span {
  color: var(--text-soft);
  font-size: 12px;
}

.history-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 150ms ease-in-out;
}

.history-card:hover .history-actions {
  opacity: 1;
}

.drawer-empty {
  display: grid;
  gap: 10px;
  place-items: start;
  padding: 22px 0;
}

.drawer-empty h3,
.drawer-empty p {
  margin: 0;
}

.drawer-empty p {
  color: var(--text-soft);
  line-height: 1.7;
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 180ms ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-panel-enter-active,
.drawer-panel-leave-active {
  transition:
    transform 300ms var(--motion-spring),
    opacity 220ms ease;
}

.drawer-panel-enter-from,
.drawer-panel-leave-to {
  opacity: 0;
  transform: translateX(22px);
}

@media (max-width: 640px) {
  .drawer-panel {
    top: 10px;
    right: 10px;
    bottom: 10px;
    left: 10px;
    width: auto;
  }

  .history-card {
    grid-template-columns: auto 64px minmax(0, 1fr);
  }

  .history-actions {
    opacity: 1;
    grid-column: 2 / span 2;
    justify-content: end;
  }
}
</style>
