// catalog.js の単体テスト（ブラウザなしで data/ を読む）
//   node tests/catalog.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// catalog.js は相対 URL で fetch するので、リポジトリのファイルを返す fetch に差し替える
globalThis.fetch = async (url) => {
  const p = path.join(root, String(url));
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
  const text = fs.readFileSync(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
};
const CAT = await import('../js/catalog.js');

let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };

const meta = await CAT.loadCatalog();
const idx = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8'));
ok(meta.ok && meta.format === 'celestia.data/1', '問題データを読めること');
ok(CAT.ENTRIES.length === idx.count, `ENTRIES の数 ${CAT.ENTRIES.length} = ${idx.count}`);
ok(meta.warnings.length === 0, `形式の警告がないこと ${meta.warnings}`);
ok(CAT.FIELDS.every(f => f.subject && f.fieldKey && /^[A-Z]{3}-\d{2}$/.test(f.key)), '単元は「分野 → 単元」の形');
ok(CAT.LEVELS[2] === '入試基礎' && CAT.SUBJECT_ORDER[0] === '力学', '難易度と分野の並びをデータから読む');

ok(CAT.pool({ levels: [0] }).length > 0, 'pool() で基礎の問題がとれる');
const st = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/state-v1.json'), 'utf8'));
ok(CAT.pickPractice(st, { size: 3 }).length === 3, 'pickPractice()');
ok(Array.isArray(CAT.pickReview(st, { size: 5 })), 'pickReview()');

// 全問の本文を読み、共通ビューが作れること
await CAT.ensureBodies(CAT.ENTRIES.map(e => e.id));
ok(CAT.staleDataFiles().length === 0, `本文ファイルの版が揃っていること ${CAT.staleDataFiles()}`);
let bad = 0;
for (const e of CAT.ENTRIES) {
  const p = CAT.getProblem(e.id);
  const good = p && p.id === e.id && p.field === e.f && p.level === e.lv && p.subject && p.fieldName && p.html && p.html.q
    && (!!p.grading === !!e.in) && (!p.grading || typeof p.grading.spec === 'string') && p.figs && typeof p.figs === 'object';
  if (!good) { bad++; if (bad < 5) console.log('  bad', e.id, p && Object.keys(p)); }
}
ok(bad === 0, `getProblem() が全 ${CAT.ENTRIES.length}問で正しい形（だめ ${bad}問）`);
ok(CAT.getProblem('no-such-id') === undefined, '無い ID は undefined');
ok(CAT.getBody('_meta') === undefined, '_meta を本文として登録しないこと');

// 図：本文の枠と figs の対応。問題文に解答用の図の枠が無いこと
let figBad = 0;
for (const e of CAT.ENTRIES) {
  const b = CAT.getBody(e.id), figs = b.figs || {};
  const refs = (html) => [...html.matchAll(/data-fig="([^"]+)"/g)].map(m => m[1]);
  for (const r of refs(b.q)) if (!figs[r] || figs[r].role === 'answer') { figBad++; console.log('  問題文の図', e.id, r); }
  for (const r of refs(b.s)) if (!figs[r]) { figBad++; console.log('  解説の図', e.id, r); }
  for (const f of Object.values(figs)) if (f.src && !fs.existsSync(path.join(root, f.src))) { figBad++; console.log('  ファイル', e.id, f.src); }
}
ok(figBad === 0, '図の枠・情報・ファイルがそろい、問題文に解答用の図が無い');

// 概念・法則・誤概念
const K = await CAT.loadKnowledge();
ok(K.concepts.length && K.concept['normal-force'] && K.law['newton-2nd'] && K.misconception['MC-NORMAL-EQ-MG'], 'knowledge.json を読める');
ok(CAT.ENTRIES.every(e => (e.c || []).every(c => K.concept[c]) && (e.m || []).every(m => K.misconception[m])), '問題の概念・誤概念がすべて knowledge.json にある');

// 学習記録のサンプルが今のデータで使えること
const ids = new Set([...Object.keys(st.pstat), ...Object.keys(st.problems), ...st.log.map(l => l.p)]);
const missing = [...ids].filter(i => !CAT.entryById.has(i));
ok(missing.length === 0, `記録にある問題ID がすべてある（無い ${missing.slice(0, 5)}）`);
ok(st.practice.fields.every(k => CAT.fieldByKey[k]), '記録にある単元ID がすべてある');

// 検索・問題セット
ok(CAT.normText('最大・最小') === CAT.normText('最大最小') && CAT.normText('ＡＢ　c') === 'abc', 'normText が表記ゆれを吸収する');
const r1 = await CAT.searchProblems('斜面');
ok(r1.length >= 2 && r1.some(e => e.id === 'MEC-INC-001'), `「斜面」で見つかる（${r1.length}問）`);
const r2 = await CAT.searchProblems('垂直抗力');
ok(r2.some(e => e.id === 'MEC-CON-001'), '概念名「垂直抗力」でも見つかる');
const r3 = await CAT.searchProblems('オームの法則', { levels: [0] });
ok(r3.length > 0 && r3.every(e => e.lv === 0), `法則名・難易度の絞り込み（${r3.length}問）`);
ok((await CAT.searchProblems('')).length === 0, '空の検索は0件');
const cols = await CAT.loadCollections();
ok(cols.length >= 1 && cols.every(c => c.items.every(it => CAT.entryById.has(it.id))), `問題セット ${cols.length}件、すべての問題がある`);
const pc = CAT.pickCollection({ problems: { [cols[0].items[0].id]: { last: 1, n: 1 } } }, cols[0], 3);
ok(pc.length === 3 && pc[0].pid === cols[0].items[1].id, 'pickCollection は未着手の問題から順に');

console.log(`catalog.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
