<template>
  <section class="card panel history-page">
    <div class="panel-head history-head">
      <div>
        <h2>上传记录</h2>
        <p class="muted">在这里查看、筛选、复制和管理你最近上传的文件。</p>
      </div>

      <div class="history-head-actions">
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
    </div>

    <div class="history-toolbar">
      <input
        :value="historyStore.search"
        placeholder="搜索文件名"
        @input="historyStore.setSearch($event.target.value)"
        @keyup.enter="historyStore.loadHistory({ reset: true })"
      />
      <select v-model="historyStore.viewMode">
        <option value="grid">卡片</option>
        <option value="list">列表</option>
      </select>
      <button class="btn btn-ghost" type="button" @click="historyStore.loadHistory({ reset: true })">搜索</button>
    </div>

    <div v-if="authStore.authRequired && !authStore.authenticated" class="history-empty">
      <h3>登录后才能查看完整历史</h3>
      <p>访客模式下仍可上传，但完整历史、批量复制和删除都需要管理员登录。</p>
      <button class="btn" type="button" @click="router.push('/login')">前往登录</button>
    </div>

    <template v-else>
      <div v-if="historyStore.viewMode === 'grid'" class="history-grid">
        <article v-for="item in historyStore.items" :key="item.id" class="history-tile">
          <label class="history-check">
            <input
              type="checkbox"
              :checked="historyStore.selectedSet.has(item.id)"
              @change="historyStore.toggleSelect(item.id)"
            />
          </label>

          <a :href="item.previewUrl" target="_blank" rel="noopener" class="tile-preview">
            <img v-if="isVisualFile(item)" :src="item.previewUrl" :alt="item.fileName" loading="lazy" />
            <div v-else class="file-fallback">
              <span>文件</span>
            </div>
          </a>

          <div class="tile-copy">
            <strong>{{ item.fileName }}</strong>
            <span>{{ formatRelativeTime(item.createdAt) }}</span>
          </div>

          <div class="tile-actions">
            <button class="btn btn-ghost" type="button" @click="historyStore.copyItems([item])">复制</button>
            <button class="btn btn-danger" type="button" @click="historyStore.deleteOne(item.id)">删除</button>
          </div>
        </article>
      </div>

      <div v-else class="history-list">
        <article v-for="item in historyStore.items" :key="item.id" class="history-row">
          <label>
            <input
              type="checkbox"
              :checked="historyStore.selectedSet.has(item.id)"
              @change="historyStore.toggleSelect(item.id)"
            />
          </label>
          <a :href="item.previewUrl" target="_blank" rel="noopener" class="row-preview">
            <img v-if="isVisualFile(item)" :src="item.previewUrl" :alt="item.fileName" loading="lazy" />
            <div v-else class="file-fallback row-file-fallback">
              <span>文件</span>
            </div>
          </a>
          <div class="row-copy">
            <strong>{{ item.fileName }}</strong>
            <span>{{ formatRelativeTime(item.createdAt) }}</span>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost" type="button" @click="historyStore.copyItems([item])">复制</button>
            <button class="btn btn-danger" type="button" @click="historyStore.deleteOne(item.id)">删除</button>
          </div>
        </article>
      </div>

      <div v-if="!historyStore.loading && !historyStore.items.length" class="history-empty">
        <h3>还没有上传记录</h3>
        <p>先上传几张图片，之后就能在这里继续复制、预览和删除。</p>
      </div>

      <div class="history-foot">
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
  </section>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useHistoryStore } from '../stores/history';

const authStore = useAuthStore();
const historyStore = useHistoryStore();
const router = useRouter();

onMounted(() => {
  if (!historyStore.hydrated) {
    void historyStore.loadHistory({ reset: true });
  }
});

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

function isVisualFile(item) {
  const target = `${item?.fileName || ''} ${item?.previewUrl || ''}`.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(target);
}
</script>

<style scoped>
.history-page {
  display: grid;
  gap: 18px;
  background:
    radial-gradient(20rem 16rem at 0% 0%, rgba(186, 158, 255, 0.1), transparent 60%),
    linear-gradient(180deg, rgba(23, 26, 31, 0.92), rgba(17, 19, 24, 0.96));
}

.history-head-actions,
.history-toolbar,
.history-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.history-toolbar input {
  flex: 1 1 280px;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.history-tile,
.history-row {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.16);
  min-width: 0;
}

.tile-preview,
.row-preview {
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 16px;
  background: var(--surface-muted);
}

.tile-preview img,
.row-preview img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
  opacity: 0.92;
  transition:
    opacity 180ms ease,
    transform 240ms var(--motion-spring);
}

.file-fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 180px;
  border-radius: 16px;
  background:
    radial-gradient(10rem 7rem at 50% 25%, rgba(186, 158, 255, 0.12), transparent 56%),
    rgba(15, 19, 28, 0.94);
  color: var(--text-soft);
  font-size: 14px;
  font-weight: 700;
}

.history-tile:hover .tile-preview img,
.history-row:hover .row-preview img {
  opacity: 1;
  transform: scale(1.02);
}

.tile-copy,
.row-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.tile-copy strong,
.row-copy strong {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.4;
  word-break: break-word;
}

.tile-copy span,
.row-copy span {
  color: var(--text-soft);
  font-size: 12px;
}

.tile-actions,
.row-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.history-list {
  display: grid;
  gap: 10px;
}

.history-row {
  grid-template-columns: auto 92px minmax(0, 1fr) auto;
  align-items: center;
}

.row-preview {
  width: 92px;
}

.row-preview img {
  width: 92px;
  height: 92px;
}

.row-file-fallback {
  width: 92px;
  height: 92px;
}

.history-empty {
  display: grid;
  gap: 10px;
  place-items: start;
  padding: 24px 0;
}

.history-empty h3,
.history-empty p {
  margin: 0;
}

.history-empty p {
  color: var(--text-soft);
  line-height: 1.7;
}

@media (max-width: 720px) {
  .history-row {
    grid-template-columns: 1fr;
  }

  .row-preview {
    width: 100%;
  }

  .row-preview img {
    width: 100%;
    height: 180px;
  }

  .row-file-fallback {
    width: 100%;
    height: 180px;
  }
}
</style>
