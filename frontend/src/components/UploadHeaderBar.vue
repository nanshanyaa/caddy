<template>
  <section class="upload-header">
    <div class="copy-block">
      <h1>把文件拖进来</h1>
      <p>支持拖拽、粘贴、点选和导入链接，上传后默认给你 Markdown。</p>
    </div>
  </section>
</template>

<script setup>
</script>

<style scoped>
.upload-header {
  width: min(100%, 1120px);
  margin: 0 auto;
  text-align: center;
}

.copy-block {
  display: grid;
  gap: 10px;
  justify-items: center;
  max-width: 680px;
}

.copy-block h1 {
  margin: 0;
  font-size: clamp(42px, 6vw, 74px);
  line-height: 0.94;
  letter-spacing: -0.075em;
}

.copy-block p {
  margin: 0;
  font-size: 14px;
  color: var(--text-soft);
  line-height: 1.7;
  max-width: 520px;
}
</style>
