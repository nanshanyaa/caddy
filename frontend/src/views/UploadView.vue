<template>
  <section class="upload-page">
    <div class="dashboard-shell card">
      <aside class="dashboard-side">
        <div class="side-brand">
          <strong>Lumina</strong>
          <span>创意空间</span>
        </div>

        <button class="upload-cta" type="button" @click="scrollToUploader">上传文件</button>

        <nav class="side-nav">
          <router-link class="side-link active" to="/">
            <span class="side-icon"></span>
            画廊
          </router-link>
          <router-link class="side-link" to="/history">
            <span class="side-icon"></span>
            最近文件
          </router-link>
          <router-link class="side-link" to="/status">
            <span class="side-icon"></span>
            系统状态
          </router-link>
          <router-link v-if="authStore.authenticated" class="side-link" to="/admin">
            <span class="side-icon"></span>
            文件后台
          </router-link>
          <router-link v-if="authStore.authenticated" class="side-link" to="/storage">
            <span class="side-icon"></span>
            存储配置
          </router-link>
        </nav>

        <div class="side-foot">
          <span>默认走 Telegram 存储</span>
          <span>{{ authStore.guestMode ? '当前是访客上传模式' : '上传后默认复制 Markdown' }}</span>
        </div>
      </aside>

      <div class="dashboard-main">
        <header class="stage-toolbar">
          <div class="toolbar-search">
            <span></span>
            搜索工作区...
          </div>
          <div class="toolbar-actions">
            <button class="toolbar-btn" type="button" @click="uiStore.openHistoryDrawer()">记录</button>
            <button class="toolbar-btn" type="button" @click="uiStore.toggleTheme()">
              {{ uiStore.theme === 'dark' ? '浅色' : '深色' }}
            </button>
            <router-link v-if="authStore.authRequired && !authStore.authenticated" class="toolbar-avatar" to="/login">登</router-link>
            <router-link v-else-if="authStore.authenticated" class="toolbar-avatar" to="/admin">管</router-link>
            <button v-else class="toolbar-avatar" type="button">图</button>
          </div>
        </header>

        <header class="stage-head">
          <div>
            <span class="stage-kicker">沉积你的高光文件，在这里完成上传与分发</span>
            <h2>升流画布</h2>
            <p>{{ stageIntro }}</p>
          </div>
          <router-link class="stage-link" to="/history">查看全部记录</router-link>
        </header>

        <div ref="uploaderAnchor" class="uploader-stage">
          <UploaderSurface />
        </div>

        <section class="recent-panel">
          <div class="recent-head">
            <h3>最近上传</h3>
            <router-link class="stage-link" to="/history">管理文件</router-link>
          </div>

          <div class="recent-grid">
            <article
              v-for="item in recentItems"
              :key="item.id"
              class="recent-card"
            >
              <img
                v-if="isVisualFile(item)"
                :src="item.previewUrl"
                :alt="item.fileName"
                loading="lazy"
              />
              <div v-else class="recent-file-fallback">
                <span>文件</span>
              </div>
              <div class="recent-copy">
                <strong>{{ item.fileName }}</strong>
                <span>{{ formatRelativeTime(item.createdAt) }}</span>
              </div>
            </article>

            <article class="recent-card recent-card-status">
              <div class="status-copy">
                <strong>处理节点</strong>
                <span>{{ stageStatusTitle }}</span>
                <p>{{ stageStatusBody }}</p>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import UploaderSurface from '../components/UploaderSurface.vue';
import { useAuthStore } from '../stores/auth';
import { useHistoryStore } from '../stores/history';
import { useUiStore } from '../stores/ui';
import { useUploadStore } from '../stores/upload';

const authStore = useAuthStore();
const historyStore = useHistoryStore();
const uiStore = useUiStore();
const uploadStore = useUploadStore();
const uploaderAnchor = ref(null);
const recentItems = computed(() => {
  const merged = [];
  const seen = new Set();

  for (const item of [...uploadStore.recentResults, ...historyStore.items]) {
    if (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged.slice(0, 5);
});
const stageIntro = computed(() => {
  if (authStore.guestMode) {
    return `当前是访客上传模式，单文件最大 ${formatSize(authStore.guestUpload.maxFileSize)}，上传后直接拿到外链和 Markdown。`;
  }
  return '把截图、图片和常见文件投进流场里，上传后直接拿到外链和 Markdown，不再来回切面板。';
});
const stageStatusTitle = computed(() => {
  if (uploadStore.currentState === 'uploading') return '当前正在上传文件';
  if (uploadStore.currentState === 'success') return '最新链接已经生成';
  return '等待新的资源进入队列';
});
const stageStatusBody = computed(() => {
  if (uploadStore.currentState === 'uploading') {
    return uploadStore.currentItem?.file?.name || '上传进度会在这里同步。';
  }
  if (uploadStore.currentState === 'success') {
    return uploadStore.latestResult?.fileName || '可以直接复制刚生成的链接。';
  }
  return '拖入文件后，这里会显示当前处理状态和最近一次结果。';
});

onMounted(() => {
  if (!authStore.authRequired || authStore.authenticated) {
    void historyStore.loadHistory({ reset: true });
  }
});

function scrollToUploader() {
  uploaderAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function formatSize(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function isVisualFile(item) {
  const target = `${item?.fileName || ''} ${item?.previewUrl || ''}`.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(target);
}
</script>

<style scoped>
.upload-page {
  display: grid;
  gap: 14px;
  padding-top: 4px;
}

.dashboard-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
  padding: 24px;
  background:
    radial-gradient(22rem 18rem at 0% 0%, rgba(105, 156, 255, 0.12), transparent 58%),
    linear-gradient(180deg, rgba(10, 14, 24, 0.98), rgba(9, 12, 20, 0.98));
}

.dashboard-side {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 20px;
  padding: 16px;
  border-radius: 28px;
  border: 1px solid rgba(73, 92, 138, 0.18);
  background: linear-gradient(180deg, rgba(18, 25, 45, 0.94), rgba(13, 18, 32, 0.96));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.side-brand {
  display: grid;
  gap: 4px;
}

.side-brand strong,
.stage-head h2,
.recent-head h3 {
  font-family: var(--headline-font);
}

.side-brand strong {
  font-size: 20px;
  letter-spacing: -0.04em;
  color: #56f2e4;
}

.side-brand span,
.side-foot span {
  color: var(--text-soft);
  font-size: 12px;
}

.upload-cta {
  min-height: 44px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(79, 255, 220, 0.96), rgba(83, 216, 255, 0.88));
  color: #062c28;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 16px 32px rgba(46, 205, 197, 0.18);
}

.side-nav {
  display: grid;
  gap: 8px;
  align-content: start;
}

.side-link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  color: var(--text-soft);
  text-decoration: none;
  border: 1px solid transparent;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.side-icon {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.78;
}

.side-link:hover,
.side-link.router-link-active,
.side-link.active {
  color: #69f9ec;
  border-color: rgba(105, 249, 236, 0.16);
  background: rgba(105, 249, 236, 0.08);
}

.side-foot {
  display: grid;
  gap: 6px;
}

.dashboard-main {
  display: grid;
  gap: 22px;
  min-width: 0;
}

.stage-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-search {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(73, 92, 138, 0.18);
  background: rgba(16, 22, 38, 0.8);
  color: var(--text-soft);
  font-size: 13px;
}

.toolbar-search span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: rgba(105, 249, 236, 0.8);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-btn,
.toolbar-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  min-height: 42px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(73, 92, 138, 0.18);
  background: rgba(16, 22, 38, 0.8);
  color: var(--text);
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.toolbar-avatar {
  width: 42px;
  padding: 0;
}

.stage-head,
.recent-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.stage-kicker {
  display: inline-block;
  margin-bottom: 10px;
  color: #56f2e4;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stage-head h2,
.recent-head h3 {
  margin: 0;
  font-size: clamp(34px, 4vw, 54px);
  letter-spacing: -0.06em;
}

.recent-head h3 {
  font-size: 24px;
}

.stage-head p {
  margin: 8px 0 0;
  color: var(--text-soft);
  max-width: 640px;
  line-height: 1.7;
}

.stage-link {
  color: var(--text-soft);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.stage-link:hover {
  color: var(--text);
}

.uploader-stage {
  min-width: 0;
  padding: 14px;
  border-radius: 32px;
  border: 1px solid rgba(73, 92, 138, 0.18);
  background:
    radial-gradient(28rem 22rem at 50% 26%, rgba(70, 216, 206, 0.12), transparent 56%),
    linear-gradient(180deg, rgba(17, 24, 40, 0.78), rgba(10, 15, 28, 0.92));
}

.recent-panel {
  display: grid;
  gap: 16px;
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.recent-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 22px;
  border: 1px solid rgba(73, 92, 138, 0.18);
  background: rgba(17, 24, 40, 0.76);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
}

.recent-card img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 16px;
  display: block;
}

.recent-file-fallback {
  display: grid;
  place-items: center;
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  background:
    radial-gradient(8rem 8rem at 50% 30%, rgba(105, 249, 236, 0.12), transparent 56%),
    rgba(13, 18, 32, 0.96);
  color: var(--text-soft);
  font-size: 14px;
  font-weight: 700;
}

.recent-copy,
.placeholder-copy {
  display: grid;
  gap: 6px;
}

.recent-copy span,
.placeholder-copy span {
  color: var(--text-soft);
  font-size: 12px;
}

.recent-card-status {
  min-height: 100%;
  align-content: end;
  background:
    radial-gradient(12rem 8rem at 50% 10%, rgba(105, 156, 255, 0.14), transparent 56%),
    rgba(17, 24, 40, 0.88);
}

.status-copy {
  display: grid;
  gap: 8px;
}

.status-copy span,
.status-copy p {
  color: var(--text-soft);
}

.status-copy p {
  margin: 0;
  line-height: 1.7;
}

@media (max-width: 1080px) {
  .dashboard-shell {
    grid-template-columns: 1fr;
  }

  .dashboard-side {
    grid-template-rows: auto auto auto auto;
  }

  .recent-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .upload-page {
    gap: 12px;
    padding-top: 2px;
  }

  .dashboard-shell {
    padding: 14px;
  }

  .recent-grid {
    grid-template-columns: 1fr;
  }
}
</style>
