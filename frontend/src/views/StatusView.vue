<template>
  <section class="card panel status-panel">
    <div class="panel-head">
      <div>
        <h2>系统状态</h2>
        <p class="muted">这里会展示当前存储可用性、诊断信息，以及排查错误时最有用的上下文。</p>
      </div>
      <button class="btn btn-ghost" @click="loadStatus" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新状态' }}
      </button>
    </div>

    <div class="adapter-grid">
      <article v-for="item in adapters" :key="item.type" class="adapter-card">
        <div class="adapter-card-top">
          <strong>{{ item.label }}</strong>
          <span class="badge" :class="item.connected ? 'badge-ok' : 'badge-danger'">
            {{ item.connected ? '可用' : '不可用' }}
          </span>
        </div>
        <p class="muted">{{ item.message }}</p>
        <p class="muted">已配置：{{ item.configured ? '是' : '否' }} ｜ 接入层：{{ item.layer }}</p>
        <p v-if="item.errorMessage" class="error">{{ item.errorMessage }}</p>
      </article>
    </div>

    <section class="card-lite diagnostic-card" v-if="telegramDiag">
      <h3>Telegram 诊断</h3>
      <p class="muted">{{ telegramDiag.summary }}</p>
      <ul class="diag-list">
        <li><strong>配置来源：</strong> {{ telegramDiag.configSource || '未知' }}</li>
        <li><strong>Bot Token 来源：</strong> {{ telegramDiag.tokenSource || '未找到' }}</li>
        <li><strong>Chat ID 来源：</strong> {{ telegramDiag.chatIdSource || '未找到' }}</li>
        <li><strong>API Base 来源：</strong> {{ telegramDiag.apiBaseSource || '默认值' }}</li>
      </ul>
      <ol class="diag-steps">
        <li>先看 `/api/status` 里的 Telegram `message` 和 `errorModel.detail` 字段。</li>
        <li>再检查 Docker 环境变量，确认上面显示的别名是否真的是当前生效值。</li>
        <li>如果 token 和 chat 都没问题但仍然超时，就继续排查 VPS 到 Telegram API 的出站网络。</li>
      </ol>
    </section>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { apiFetch } from '../api/client';
import { getStorageLabel } from '../config/storage-definitions';

const loading = ref(false);
const error = ref('');
const status = ref(null);

const adapters = computed(() => {
  const source = status.value || {};
  const list = Array.isArray(source.capabilities) ? source.capabilities : [];
  return list.map((cap) => {
    const detail = source[cap.type] || {};
    const errorMessage = detail.errorModel?.detail || '';
    const layer = cap.layer || detail.layer || 'direct';
    return {
      type: cap.type,
      label: getStorageLabel(cap.type) || cap.label,
      connected: Boolean(detail.connected),
      configured: Boolean(detail.configured),
      layer: layer === 'mounted' ? '挂载' : '直连',
      message: humanizeStatusText(detail.message || cap.enableHint || '暂无信息'),
      errorMessage: humanizeStatusText(errorMessage),
    };
  });
});

const telegramDiag = computed(() => status.value?.diagnostics?.telegram || null);

onMounted(() => {
  void loadStatus();
});

async function loadStatus() {
  loading.value = true;
  error.value = '';
  try {
    status.value = await apiFetch('/api/status');
  } catch (err) {
    error.value = err.message || '加载状态失败';
  } finally {
    loading.value = false;
  }
}

function humanizeStatusText(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';

  const directMap = {
    'Not configured': '尚未配置',
    'All Files': '全部文件',
    'S3 Compatible': '兼容 S3',
    'WebDAV (Mounted)': 'WebDAV 挂载',
    Direct: '直连',
    Mounted: '挂载',
  };

  return directMap[text] || text;
}
</script>
