// ブラウザでの通し操作（Playwright・Chromium、iPhone 幅 390×844）
//   node tests/e2e.mjs
// 主な画面、図（解答図は答え合わせまで読み込まない）、一部のデータだけ古いときの警告、オフライン、同期を確かめる。
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { createMockSupabase } from './mock-supabase.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
let fakeDataVersion = null;
const mock = createMockSupabase({ key: 'sb_publishable_e2e' });   // 同期のテスト用（このサーバーの /mock/ で応える）   // Service Worker のテスト用：index.json の dataVersion を差し替える
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  if (p.startsWith('/mock/')) {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', async () => {
      const r = await mock.handle({ method: req.method, url: req.url, headers: req.headers, body: body || null });
      res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(r.body);
    });
    return;
  }
  if (p === '/js/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    const v = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8').match(/FILE_VERSION = '([^']+)'/)[1];
    return res.end(`export const FILE_VERSION = '${v}';
export const SUPABASE_URL = 'http://localhost:${server.address().port}/mock';
export const SUPABASE_KEY = 'sb_publishable_e2e';`);
  }
  if (fakeDataVersion && p === '/data/index.json') {
    const d = JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); d.dataVersion = fakeDataVersion;
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(d));
  }
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const U = `http://localhost:${server.address().port}/`;

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const browser = await chromium.launch();

async function newPage({ state = null, route = null, sw = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, serviceWorkers: sw ? 'allow' : 'block' });
  if (state) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('celestia.v1', s); } }, JSON.stringify(state));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  page.requested = [];
  page.on('request', r => page.requested.push(new URL(r.url()).pathname));
  if (route) await route(page);
  return page;
}
const next = (page) => page.locator('button:has-text("次")').first().click();

try {
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v1.json'), 'utf8'));
  const LS = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('celestia.v1')));
  // 1. 起動・タブ・図つきの問題・解答図は答え合わせまで出ない・入力採点
  {
    const page = await newPage();
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    const tabs = await page.locator('.tabbar a span').allInnerTexts();
    ok(tabs.join() === '今日,シミュレーション,概念,定着度,設定', `タブが物理版の構成 ${tabs}`);
    ok(await page.locator('#lv button').count() === 6, '難易度ボタンが6つ');
    ok(await page.locator('.banner').count() === 0, '起動時に警告が出ない');
    await page.evaluate("__celestia.open(['MEC-INC-001', 'ELM-DCC-001'])"); await page.waitForTimeout(1200);
    ok(await page.locator('.question figure.pfig svg').count() === 1, '問題図が本文の中に SVG で入る');
    ok(await page.locator('.question figure.pfig[aria-label], .question figure.pfig [role="img"]').count() === 1, '問題図に代替テキスト');
    ok(await page.locator('figure.fig-answer').count() === 0, '答え合わせ前は解答図が無い');
    ok(!page.requested.some(u => u.includes('a-forces')), '答え合わせ前は解答図のファイルを読み込まない');
    await page.locator('#conf button').nth(2).click();
    const inputs = page.locator('#inputs input');
    ok(await inputs.count() === 3, '小問3つに入力欄');
    await inputs.nth(0).fill('mgcos(θ)'); await inputs.nth(1).fill('m g sinθ'); await inputs.nth(2).fill('μ>=tanθ');
    await page.click('#judge'); await page.waitForTimeout(800);
    ok((await page.locator('.verdict').innerText()).includes('完答'), 'MEC-INC-001 を正しく答えて完答');
    await page.waitForTimeout(500);
    ok(await page.locator('figure.fig-answer svg').count() === 1, '答え合わせのあとに解答図が出る');
    ok(page.requested.some(u => u.includes('a-forces')), '解答図のファイルは答え合わせのあとに読む');
    ok((await page.locator('figure.fig-answer figcaption').innerText()).includes('分解'), '解答図の説明');
    ok((await page.locator('.concept-box').innerText()).includes('垂直抗力'), '解説の下に確かめる概念・よくある誤解');
    await next(page); await page.waitForTimeout(1000);
    ok(await page.locator('.question figure.pfig svg').count() === 1, '回路図の問題');
    ok((await page.locator('#inputs .unit').allInnerTexts()).join() === 'Ω,A,A', '単位 [Ω] [A] が入力欄の横に出る');
    await page.locator('#conf button').nth(1).click();
    await page.locator('#inputs input').nth(0).fill('6'); await page.locator('#inputs input').nth(1).fill('3'); await page.locator('#inputs input').nth(2).fill('4/3');
    await page.click('#judge'); await page.waitForTimeout(400);
    ok((await page.locator('#feedback').innerText()).includes('2つ正解'), '1つだけ違うと「3つのうち2つ正解」');
    const st = await LS(page);
    ok(st.pstat['MEC-INC-001'] && st.log.some(l => l.p === 'MEC-INC-001'), '結果が問題ID で記録される');
    ok(page.errors.length === 0, `ページのエラーなし ${page.errors}`);
  }
  // 2. 自己採点の問題・シミュレーション・概念・設定・定着度
  {
    const page = await newPage();
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    await page.evaluate("__celestia.open(['MEC-CON-001'])"); await page.waitForTimeout(1000);
    await page.locator('#conf button').nth(1).click();
    await page.click('#reveal'); await page.waitForTimeout(500);
    const order = await page.evaluate(() => { const a = document.querySelector('#solbox'), b = document.querySelector('#self'); return !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); });
    ok(order, '自己採点の問題で、解答・解説が「どうだった？」より前に出る');
    await page.goto(U + '#sim'); await page.waitForTimeout(800);
    ok(await page.locator('.sim-card').count() === 7, 'シミュレーション一覧（登録簿の7件）');
    await page.goto(U + '#concept=normal-force'); await page.waitForTimeout(800);
    ok(await page.locator('details.concept[open]').count() === 1 && (await page.locator('details.concept[open]').innerText()).includes('mg'), '#concept= で概念が開き、誤解が出る');
    await page.locator('details.concept[open] [data-ids]').click(); await page.waitForTimeout(1000);
    ok(await page.locator('#conf button').count() === 3, '概念から関連問題の演習が始まる');
    await page.goto(U + '#drill'); await page.waitForTimeout(500);
    ok(await page.locator('.drill-card').count() === 0, '計算トレーニングは無い');
    await page.goto(U + '#settings'); await page.waitForTimeout(600);
    await page.locator('.segment.theme button:has-text("ダーク")').click();
    ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'ダークモード');
    await page.goto(U + '#map'); await page.waitForTimeout(600);
    ok((await page.locator('#view').innerText()).includes('定着度'), '定着度画面');
    ok(page.errors.length === 0, `ページのエラーなし ${page.errors}`);
  }
  // 3. 学習記録のある端末：CSV・続きに記録
  {
    const page = await newPage({ state: fixture });
    await page.goto(U + '#settings'); await page.waitForTimeout(1200);
    const dl = page.waitForEvent('download');
    await page.click('#csvall');
    const csv = fs.readFileSync(await (await dl).path(), 'utf8');
    ok(csv.split('\n').filter(l => l.trim()).length === fixture.log.length + 1, `CSV に記録 ${fixture.log.length}件がすべて出る`);
    await page.evaluate("__celestia.open(['MEC-SHM-001'])"); await page.waitForTimeout(1000);
    await page.locator('#conf button').nth(1).click();
    const inp = page.locator('#inputs input');
    await inp.nth(0).fill('2π√(m/k)'); await inp.nth(1).fill('A sqrt(k/m)'); await inp.nth(2).fill('√2');
    await page.click('#judge'); await page.waitForTimeout(600);
    ok((await page.locator('.verdict').innerText()).includes('完答'), '添字（v_max）や √ を含む答えを採点できる');
    const st = await LS(page);
    ok(Object.keys(fixture.pstat).every(k => st.pstat[k]), '前の復習状態がすべて残る');
    ok(st.log.length === fixture.log.length + 1, '学習記録が続きに足される');
    ok(st.predictions.length === fixture.predictions.length && st.misc['MC-SHM-PERIOD-LINEAR-M'], '予測・誤概念の記録が残る');
    ok(page.errors.length === 0, `ページのエラーなし ${page.errors}`);
  }
  // 4. 一部の data/ だけ古い（f-MEC-02.json の版が違う）
  {
    const page = await newPage({ route: (p) => p.route('**/data/f-MEC-02.json', async (r) => {
      const res = await r.fetch(); const d = await res.json(); d._meta = { dataVersion: 'old000000000' };
      await r.fulfill({ response: res, body: JSON.stringify(d) });
    }) });
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    await page.evaluate("__celestia.open(['MEC-INC-001'])"); await page.waitForTimeout(800);
    const b = page.locator('.banner');
    ok(await b.count() === 1 && (await b.innerText()).includes('data/f-MEC-02.json'), '古い本文ファイルを読むと警告が出る');
    ok(await page.locator('#inputs input').count() > 0, '警告が出ても問題は解ける');
  }
  // 5. 検索・問題セット・共有リンク
  {
    const page = await newPage({ state: fixture });
    await page.goto(U + '#today'); await page.waitForTimeout(1500);
    ok(await page.locator('#sets .set-card').count() >= 1, '今日の画面に問題セット');
    await page.fill('#sq', '垂直抗力'); await page.press('#sq', 'Enter'); await page.waitForTimeout(1200);
    ok(await page.locator('.res-row').count() >= 2, '概念名で検索できる');
    await page.goto(U + '#set=col-rikigaku-hajime'); await page.waitForTimeout(1500);
    ok(page.url().endsWith('#today') && await page.locator('#conf button').count() === 3, '#set= のリンクで問題セットが始まる');
    await page.goto(U + '#ids=MEC-PRJ-001'); await page.waitForTimeout(1500);
    ok((await page.locator('.chip').allInnerTexts()).some(t => t.includes('力学・運動の表し方')), '#ids= のリンクで指定の問題が出る');
    ok(page.errors.length === 0, `ページのエラーなし ${page.errors}`);
  }
  // 6. Service Worker：自分のキャッシュだけを管理し、同じドメインの他のアプリ（Lemma など）のキャッシュは消さない。オフラインで図も出る
  {
    const page = await newPage({ sw: true });
    await page.goto(U + '#today');
    await page.evaluate(async () => { await (await caches.open('lemma-v0.9.0')).put('/x', new Response('lemma')); await (await caches.open('butsuriba-v0.4.0')).put('/y', new Response('b')); });
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    await page.reload(); await page.waitForTimeout(1200);
    await page.evaluate("__celestia.open(['MEC-INC-001'])"); await page.waitForTimeout(1500);
    const v = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8')).dataVersion;
    const keys = await page.evaluate(async () => caches.keys());
    ok(keys.includes('celestia-data-' + v) && keys.includes('celestia-v0.1.1'), `コード用とデータ用のキャッシュ ${keys}`);
    ok(keys.includes('lemma-v0.9.0') && keys.includes('butsuriba-v0.4.0'), '同じドメインの他のアプリのキャッシュを消さない');
    await page.context().setOffline(true);
    await page.goto(U + '#today'); await page.waitForTimeout(1200);
    await page.evaluate("__celestia.open(['MEC-INC-001'])"); await page.waitForTimeout(1500);
    ok(await page.locator('#inputs input').count() === 3 && await page.locator('.question figure.pfig svg').count() === 1, 'オフラインでも開いた問題が図つきで解ける');
    await page.context().setOffline(false);
    fakeDataVersion = 'e2enewversion';
    await page.goto(U + '#today'); await page.waitForTimeout(1500);
    await page.evaluate(async () => fetch('data/index.json', { cache: 'no-cache' }));
    await page.waitForTimeout(500);
    const keys2 = await page.evaluate(async () => caches.keys());
    ok(keys2.includes('celestia-data-e2enewversion') && !keys2.includes('celestia-data-' + v) && keys2.includes('lemma-v0.9.0'), `データの版が変わると自分の古いデータ用キャッシュだけを消す ${keys2}`);
    fakeDataVersion = null;
  }
  // 7. アカウントと同期：2台の端末でログインすると記録が合わさる（にせ Supabase）
  {
    const login = async (page) => {
      await page.goto(U + '#settings'); await page.waitForTimeout(1500);
      await page.fill('#acct-email', 'me@example.com'); await page.click('#acct-send'); await page.waitForTimeout(500);
      await page.fill('#acct-code', '123456'); await page.click('#acct-verify'); await page.waitForTimeout(1500);
    };
    const A = await newPage({ state: { ...fixture, log: fixture.log.slice(0, 25) } });
    await login(A);
    ok((await A.locator('#acct').innerText()).includes('Lemma と共通'), 'アカウントが Lemma と共通であることを表示');
    const B = await newPage({ state: { ...fixture, log: fixture.log.slice(20) } });
    await login(B);
    const nB = (await LS(B)).log.length;
    ok(nB === fixture.log.length, `端末B：両方の端末の記録が合わさる（${nB}件）`);
    ok(await B.evaluate(() => !!localStorage.getItem('celestia.auth') && !localStorage.getItem('lemma.auth')), 'ログイン情報は celestia.auth に保存（Lemma と別）');
    ok([...mock.rows.values()][0] && mock.rows.size === 1, 'サーバーの表 celestia_state に1行');
    const real = (es) => es.filter(e => !/status of 403/.test(e));
    ok(real(A.errors).length === 0 && real(B.errors).length === 0, `ページのエラーなし ${A.errors} ${B.errors}`);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`e2e: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
