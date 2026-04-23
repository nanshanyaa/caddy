import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd(), '..');
const distDir = path.resolve(process.cwd(), 'dist');

const passthroughFiles = [
  'preview.html',
  'block-img.html',
  'whitelist-on.html',
  'admin-imgtc.html',
  'admin-waterfall.html',
  'theme.css',
  'theme.js',
  'mobile-refactor.css',
  'admin-imgtc.css',
  'favicon.ico',
  'favicon.svg',
  'logo.png',
  'bg.svg',
  'music.svg',
];

const passthroughDirs = ['_nuxt'];

const redirects = [
  { file: 'admin.html', target: '/admin' },
  { file: 'gallery.html', target: '/history' },
  { file: 'webdav.html', target: '/webdav' },
  { file: 'login.html', target: '/login' },
];

function ensureDir(target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
}

function copyEntry(relativePath) {
  const from = path.resolve(rootDir, relativePath);
  if (!fs.existsSync(from)) return;
  const to = path.resolve(distDir, relativePath);
  ensureDir(to);

  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.cpSync(from, to, { recursive: true, force: true });
    return;
  }
  fs.copyFileSync(from, to);
}

fs.mkdirSync(distDir, { recursive: true });

for (const file of passthroughFiles) {
  copyEntry(file);
}
for (const dir of passthroughDirs) {
  copyEntry(dir);
}

for (const entry of redirects) {
  fs.writeFileSync(
    path.resolve(distDir, entry.file),
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url=${entry.target}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>K-Vault</title>
    <script>location.replace(${JSON.stringify(entry.target)});</script>
  </head>
  <body></body>
</html>
`,
    'utf8',
  );
}

fs.writeFileSync(
  path.resolve(distDir, '_redirects'),
  `/admin.html /admin 302
/gallery.html /history 302
/webdav.html /webdav 302
/login.html /login 302
/* /index.html 200
`,
  'utf8',
);

console.log('[frontend] SPA build + compatibility redirect pages ready');
