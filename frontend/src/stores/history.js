import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { absoluteFileUrl } from '../api/client';
import { deleteFiles, getDriveExplorer } from '../api/drive';
import { useUiStore } from './ui';

function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const input = document.createElement('textarea');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      return true;
    } catch {
      return false;
    }
  }
}

function buildHistoryItem(file) {
  const fileId = file.name;
  const fileName = file.metadata?.fileName || file.name;
  const fileUrl = absoluteFileUrl(fileId);
  return {
    id: fileId,
    fileId,
    fileName,
    fileUrl,
    previewUrl: fileUrl,
    size: Number(file.metadata?.fileSize || 0),
    createdAt: file.metadata?.TimeStamp || file.metadata?.updatedAt || Date.now(),
    markdown: `![${fileName}](${fileUrl})`,
    html: `<img src="${escapeHtml(fileUrl)}" alt="${escapeHtml(fileName)}" />`,
    storageType: file.metadata?.storageType || '',
    raw: file,
  };
}

export const useHistoryStore = defineStore('history', () => {
  const uiStore = useUiStore();
  const items = ref([]);
  const selectedIds = ref([]);
  const search = ref('');
  const nextCursor = ref('');
  const loading = ref(false);
  const deleting = ref(false);
  const error = ref('');
  const viewMode = ref('grid');
  const hydrated = ref(false);

  const selectedSet = computed(() => new Set(selectedIds.value));
  const selectedItems = computed(() => items.value.filter((item) => selectedSet.value.has(item.id)));

  async function loadHistory({ reset = true } = {}) {
    if (loading.value) return;
    loading.value = true;
    error.value = '';

    try {
      const data = await getDriveExplorer({
        path: '',
        storage: 'all',
        search: search.value,
        limit: 60,
        cursor: reset ? '' : nextCursor.value,
        includeStats: reset,
      });

      const incoming = Array.isArray(data.files) ? data.files.map(buildHistoryItem) : [];
      if (reset) {
        items.value = incoming;
        selectedIds.value = [];
      } else {
        const seen = new Set(items.value.map((item) => item.id));
        for (const item of incoming) {
          if (!seen.has(item.id)) {
            items.value.push(item);
          }
        }
      }

      nextCursor.value = data.list_complete ? '' : (data.cursor || '');
      hydrated.value = true;
    } catch (err) {
      error.value = err.message || '加载历史记录失败。';
    } finally {
      loading.value = false;
    }
  }

  function toggleSelect(id) {
    selectedIds.value = selectedSet.value.has(id)
      ? selectedIds.value.filter((item) => item !== id)
      : [...selectedIds.value, id];
  }

  function toggleSelectAll() {
    if (selectedIds.value.length === items.value.length) {
      selectedIds.value = [];
      return;
    }
    selectedIds.value = items.value.map((item) => item.id);
  }

  function clearSelection() {
    selectedIds.value = [];
  }

  async function copyItems(targetItems = selectedItems.value) {
    if (!targetItems.length) return false;
    const text = targetItems.map((item) => item.markdown).join('\n');
    const copied = await copyText(text);
    if (copied) {
      uiStore.pushToast(
        targetItems.length > 1 ? `已复制 ${targetItems.length} 条 Markdown 链接` : '已复制 Markdown 链接',
        'success',
      );
    } else {
      uiStore.pushToast('复制失败，请手动复制', 'error');
    }
    return copied;
  }

  async function deleteSelected() {
    if (!selectedIds.value.length || deleting.value) return;
    deleting.value = true;
    error.value = '';
    try {
      await deleteFiles(selectedIds.value);
      const removed = new Set(selectedIds.value);
      items.value = items.value.filter((item) => !removed.has(item.id));
      selectedIds.value = [];
      uiStore.pushToast('已删除选中文件', 'success');
    } catch (err) {
      error.value = err.message || '删除选中文件失败。';
      uiStore.pushToast(error.value, 'error');
    } finally {
      deleting.value = false;
    }
  }

  async function deleteOne(id) {
    selectedIds.value = [id];
    await deleteSelected();
  }

  function setSearch(nextSearch) {
    search.value = nextSearch;
  }

  return {
    items,
    selectedIds,
    search,
    nextCursor,
    loading,
    deleting,
    error,
    viewMode,
    hydrated,
    selectedSet,
    selectedItems,
    loadHistory,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    copyItems,
    deleteSelected,
    deleteOne,
    setSearch,
  };
});
