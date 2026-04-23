export const STORAGE_TYPES = [
  {
    value: 'telegram',
    label: 'Telegram',
    layer: 'direct',
    description: '最省心的默认上传目标，适合日常图床使用。',
  },
  {
    value: 'r2',
    label: 'Cloudflare R2',
    layer: 'direct',
    description: '适合大文件、对象存储和 CDN 分发场景。',
  },
  {
    value: 's3',
    label: '兼容 S3',
    layer: 'direct',
    description: '兼容任意 S3 协议的对象存储服务。',
  },
  {
    value: 'discord',
    label: 'Discord',
    layer: 'direct',
    description: '通过 Webhook 或机器人把文件发到 Discord。',
  },
  {
    value: 'huggingface',
    label: 'Hugging Face',
    layer: 'direct',
    description: '把数据集仓库当成轻量存储后端来使用。',
  },
  {
    value: 'webdav',
    label: 'WebDAV 挂载',
    layer: 'mounted',
    description: '适合挂载式或聚合式入口，推荐配合 alist/openlist 使用。',
  },
  {
    value: 'github',
    label: 'GitHub',
    layer: 'direct',
    description: '可走 Release 资产上传，也可走 Contents API。',
  },
];

export const STORAGE_TYPE_LABELS = STORAGE_TYPES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const STORAGE_FIELDS = {
  telegram: [
    { key: 'botToken', label: 'Bot Token', required: true, secret: true, placeholder: '123456:ABC...' },
    { key: 'chatId', label: 'Chat ID', required: true, placeholder: '-100xxxx' },
    { key: 'apiBase', label: 'API Base', placeholder: 'https://api.telegram.org' },
  ],
  r2: [
    { key: 'endpoint', label: 'Endpoint', required: true, placeholder: 'https://xxxx.r2.cloudflarestorage.com' },
    { key: 'region', label: 'Region', placeholder: 'auto' },
    { key: 'bucket', label: 'Bucket', required: true, placeholder: 'bucket-name' },
    { key: 'accessKeyId', label: 'Access Key ID', required: true, secret: true, placeholder: 'AKIA...' },
    { key: 'secretAccessKey', label: 'Secret Access Key', required: true, secret: true, placeholder: '******' },
  ],
  s3: [
    { key: 'endpoint', label: 'Endpoint', required: true, placeholder: 'https://s3.example.com' },
    { key: 'region', label: 'Region', required: true, placeholder: 'us-east-1' },
    { key: 'bucket', label: 'Bucket', required: true, placeholder: 'bucket-name' },
    { key: 'accessKeyId', label: 'Access Key ID', required: true, secret: true, placeholder: 'AKIA...' },
    { key: 'secretAccessKey', label: 'Secret Access Key', required: true, secret: true, placeholder: '******' },
  ],
  discord: [
    { key: 'webhookUrl', label: 'Webhook URL', secret: true, placeholder: 'https://discord.com/api/webhooks/...' },
    { key: 'botToken', label: 'Bot Token', secret: true, placeholder: '机器人令牌' },
    { key: 'channelId', label: 'Channel ID', placeholder: '频道 ID' },
  ],
  huggingface: [
    { key: 'token', label: 'Token', required: true, secret: true, placeholder: 'hf_xxx' },
    { key: 'repo', label: 'Dataset Repo', required: true, placeholder: 'username/repo' },
  ],
  webdav: [
    { key: 'baseUrl', label: 'Base URL', required: true, placeholder: 'https://dav.example.com/remote.php/dav/files/user' },
    { key: 'username', label: 'Username', placeholder: '如果使用 Bearer Token，这里可以留空' },
    { key: 'password', label: 'Password', secret: true, placeholder: '如果使用 Bearer Token，这里可以留空' },
    { key: 'bearerToken', label: 'Bearer Token', secret: true, placeholder: '如果使用用户名和密码，这里可以留空' },
    { key: 'rootPath', label: 'Root Path', placeholder: '可选路径前缀，例如 uploads' },
  ],
  github: [
    { key: 'repo', label: 'Repository', required: true, placeholder: 'owner/repo' },
    { key: 'token', label: 'Token', required: true, secret: true, placeholder: 'github_pat_xxx' },
    {
      key: 'mode',
      label: 'Mode',
      input: 'select',
      required: true,
      options: [
        { value: 'releases', label: 'Releases' },
        { value: 'contents', label: 'Contents API' },
      ],
    },
    { key: 'prefix', label: 'Path/Prefix', placeholder: '可选，例如 uploads' },
    { key: 'releaseTag', label: 'Release Tag', placeholder: '可选，仅 Releases 模式使用' },
    { key: 'branch', label: 'Branch', placeholder: '可选，仅 Contents 模式使用' },
    { key: 'apiBase', label: 'API Base', placeholder: 'https://api.github.com' },
  ],
};

export const STORAGE_NOTES = {
  telegram: '实际更稳妥的上传体积建议控制在 50MB 以内。',
  discord: '当前适配器默认按 25MB 的保守上限处理。',
  huggingface: '常规 commit 上传更适合小文件，适配器上限约 35MB。',
  webdav: '支持 PUT / GET / DELETE，并会为多层目录自动补 MKCOL。',
  github: '二进制文件更适合 Releases，小文件和文本更适合 Contents 模式。',
};

export const STORAGE_GROUPS = [
  {
    value: 'direct',
    label: '直连上传后端',
    description: '由 K-Vault 直接把文件上传到目标服务。',
  },
  {
    value: 'mounted',
    label: '挂载 / 聚合后端',
    description: '适合 WebDAV 挂载入口，例如 alist/openlist。',
  },
];

export function getStorageFields(type) {
  return STORAGE_FIELDS[type] || [];
}

export function getStorageLabel(type) {
  return STORAGE_TYPE_LABELS[type] || String(type || '');
}

export function storageEnabledFromStatus(status, type) {
  if (!status || !type) return false;
  const item = status[type];
  if (!item) return false;
  return Boolean(item.connected && (item.enabled !== false));
}
