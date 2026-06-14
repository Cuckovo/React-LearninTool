/**
 * Web 端构建后，将 GeoGebra 离线资源复制到 dist 目录
 * 使用方式：npm run export:web && node scripts/copy-geogebra-web.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'geogebra');
const DEST = path.join(__dirname, '..', 'dist', 'geogebra');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.error('[GeoGebra] 源目录不存在:', SRC);
  process.exit(1);
}

console.log('[GeoGebra] 正在复制离线资源到 dist/geogebra/ ...');
copyDir(SRC, DEST);

// 统计大小
function getTotalSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? getTotalSize(p) : fs.statSync(p).size;
  }
  return total;
}

const sizeMB = (getTotalSize(DEST) / (1024 * 1024)).toFixed(1);
console.log(`[GeoGebra] 复制完成，总计 ${sizeMB} MB`);
