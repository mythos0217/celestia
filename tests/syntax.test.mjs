// すべての JS モジュールを読み込み、構文エラーや読み込みの失敗がないか確かめる（ブラウザ専用の命令による失敗は除く）
//   node tests/syntax.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); } })(path.join(root, 'js'));
let bad = 0;
for (const f of files) {
  try { await import(pathToFileURL(f)); }
  catch (e) { if (!/document|window|getComputedStyle|requestAnimationFrame|localStorage|navigator|self is not|location|matchMedia|ResizeObserver|DOMParser/.test(e.message)) { bad++; console.log('FAIL', path.relative(root, f), e.message); } }
}
console.log(`syntax.test: ${files.length} ファイルを読み込み${bad ? `、${bad} 件失敗` : '、すべて OK'}`);
process.exitCode = bad ? 1 : 0;
