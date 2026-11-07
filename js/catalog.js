// 問題カタログ：content/ から書き出した data/*.json を読む（tools/build_data.py）
//   一覧 data/index.json、本文 data/f-<単元ID>.json、概念・法則・誤概念・シミュレーション data/knowledge.json
import { retrievability, dueAt, TARGET_R } from './scheduler.js';

export const FILE_VERSION = '0.3.0';

// 難易度（data/index.json の levels で上書きされる）
export let LEVELS = { 0: '基礎', 1: '標準', 2: '入試基礎', 3: '国公立2次', 4: '難関', 5: '最難関' };
// 分野（力学・熱力学…）の並び。画面では「分野 → 単元」の2段で出す（FIELDS は単元）
export let SUBJECT_ORDER = ['力学', '熱力学', '波動', '電磁気', '原子', '分野横断'];

export let FIELDS = [];        // 単元 { key: 'MEC-02', subject: '力学', fieldKey: 'MEC', name: '力とつり合い' }
export let ENTRIES = [];       // { id, f: 単元ID, lv, t?, th?, tg?, fm?, c?, m?, sim?, pr?, in?, kind: 'bank' }
export const fieldByKey = {};
export const entryById = new Map();
export let META = { count: 0, generated: null, source: null, ok: false, error: null, format: null, dataVersion: null, warnings: [] };
// このアプリが読めるデータ形式（index.json の format）
export const DATA_FORMATS = ['celestia.data/1'];

export async function loadCatalog() {
  let meta = null;
  try {
    const res = await fetch('data/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`data/index.json を読めません（${res.status}）`);
    meta = await res.json();
    META = { count: meta.count, generated: meta.generated, source: meta.source, ok: true, error: null,
      format: meta.format || null, dataVersion: meta.dataVersion || null, warnings: [] };
    if (!DATA_FORMATS.includes(meta.format)) {
      META.warnings.push(`問題データの形式 ${meta.format} はこの版のアプリでは想定していません（アプリの更新が必要かもしれません）`);
    }
  } catch (e) {
    META = { count: 0, generated: null, source: null, ok: false, error: e.message, format: null, dataVersion: null, warnings: [] };
  }
  if (meta && meta.levels) LEVELS = Object.fromEntries(Object.entries(meta.levels).map(([k, v]) => [+k, v]));
  if (meta && meta.subjects) SUBJECT_ORDER = meta.subjects.slice();
  FIELDS = meta ? meta.fields.slice() : [];
  ENTRIES = meta ? meta.problems.map(e => ({ ...e, kind: 'bank' })) : [];
  for (const k of Object.keys(fieldByKey)) delete fieldByKey[k];
  for (const f of FIELDS) fieldByKey[f.key] = f;
  entryById.clear();
  for (const e of ENTRIES) entryById.set(e.id, e);
  return META;
}

// 概念・法則・誤概念・シミュレーション登録簿（初めて使うときに読む）
let knowledge = null;
export async function loadKnowledge() {
  if (!knowledge) {
    knowledge = fetch('data/knowledge.json').then(r => { if (!r.ok) throw new Error(`data/knowledge.json を読めません（${r.status}）`); return r.json(); })
      .then(d => {
        if (META.dataVersion && d.dataVersion !== META.dataVersion) staleData.add('data/knowledge.json');
        const by = (list) => Object.fromEntries(list.map(x => [x.id, x]));
        return { ...d, concept: by(d.concepts), law: by(d.laws), misconception: by(d.misconceptions), simulation: by(d.simulations) };
      })
      .catch(e => { knowledge = null; throw e; });
  }
  return knowledge;
}

// 本文（分野ごとのファイル）を必要な分だけ読み込む
const bodies = new Map();
const loaded = new Map();
export async function ensureBodies(ids) {
  const need = new Set();
  for (const id of ids) {
    const e = entryById.get(id);
    if (e && !bodies.has(id)) need.add(e.f);
  }
  await Promise.all([...need].map(f => {
    if (!loaded.has(f)) {
      loaded.set(f, fetch(`data/f-${f}.json`).then(r => {
        if (!r.ok) throw new Error(`data/f-${f}.json を読めません（${r.status}）`);
        return r.json();
      }).then(d => {
        // 本文ファイルの版が一覧（index.json）と違う＝一部のファイルだけ古い
        const v = d._meta && d._meta.dataVersion;
        if (META.dataVersion && v !== META.dataVersion) staleData.add(`data/f-${f}.json`);
        for (const [id, b] of Object.entries(d)) if (id !== '_meta') bodies.set(id, b);
      })
        .catch(e => { loaded.delete(f); throw e; }));
    }
    return loaded.get(f);
  }));
}
export const getBody = (id) => bodies.get(id);

// 一覧と版が合わなかった本文ファイル（ensureBodies のあとに見る）
const staleData = new Set();
export const staleDataFiles = () => [...staleData];

// 共通の問題ビュー（本文が未読み込みなら html は null）
//   { id, field, subject, fieldName, level, levelName, minutes, theme, tags, concepts, misconceptions, simulation,
//     verified, html: {q, a, s, k} | null, figs, grading: {format, spec} | null, hints, laws, predict, choices }
export function getProblem(id) {
  const e = entryById.get(id);
  if (!e) return undefined;
  const f = fieldByKey[e.f] || {};
  const b = bodies.get(id);
  return { id, kind: 'written', field: e.f, subject: f.subject, fieldName: f.name, level: e.lv, levelName: LEVELS[e.lv],
    minutes: e.t || null, theme: e.th || null, tags: e.tg || [], formats: e.fm || [], concepts: e.c || [], misconceptions: e.m || [],
    simulation: b ? b.sim || null : (e.sim ? { id: e.sim } : null), verified: !!e.ok,
    html: b ? { q: b.q, a: b.a, s: b.s, k: b.k } : null, figs: b ? b.figs || {} : null,
    grading: e.in ? { format: 'lemma-input/1', spec: b ? b.in : null } : null,
    hints: b && b.k ? [b.k] : [], laws: b ? b.laws || [] : [], predict: b ? b.predict || null : null, choices: b ? b.choices || null : null };
}

export const subjectsWithFields = () =>
  SUBJECT_ORDER.map(s => ({ name: s, fields: FIELDS.filter(f => f.subject === s) })).filter(x => x.fields.length);

export function pool({ fields = null, levels = null } = {}) {
  const fs = fields && new Set(fields), ls = levels && new Set(levels);
  return ENTRIES.filter(e => (!fs || fs.has(e.f)) && (!ls || ls.has(e.lv)));
}

// 単元が連続しないように並べる（交互練習）
function interleave(list) {
  const out = [], rest = list.slice();
  while (rest.length) {
    const prev = out.length ? out[out.length - 1].f : null;
    let i = rest.findIndex(e => e.f !== prev);
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

// 演習：まだ解いていない問題を無作為に、次に久しぶりの問題を優先
export function pickPractice(state, { fields = null, levels = null, size = 8 } = {}) {
  const cand = pool({ fields, levels }).map(e => {
    const rec = state.problems[e.id];
    return { e, key: rec ? rec.last : -1e15 + Math.random() * 1e14 };
  }).sort((a, b) => a.key - b.key).slice(0, size).map(x => x.e);
  // 分野の偏りを避けるため、選んだ問題をシャッフルしてから交互に並べる
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  return interleave(cand).map(e => ({ kind: 'problem', pid: e.id }));
}

// 復習：問題ごとの記憶の見込みが下がったもの
export function dueEntries(state, { fields = null } = {}, now = Date.now()) {
  const fs = fields && new Set(fields);
  return ENTRIES.filter(e => state.pstat[e.id] && (!fs || fs.has(e.f)))
    .map(e => ({ e, R: retrievability(state.pstat[e.id], now) }))
    .filter(x => x.R < TARGET_R).sort((a, b) => a.R - b.R).map(x => x.e);
}
export function pickReview(state, { fields = null, size = 8 } = {}) {
  return interleave(dueEntries(state, { fields }).slice(0, size)).map(e => ({ kind: 'problem', pid: e.id }));
}
export function nextReviewTime(state) {
  const ts = Object.values(state.pstat || {}).map(dueAt);
  return ts.length ? Math.min(...ts) : null;
}

// ---------- 検索（data/search.json を初めて使うときに読む） ----------
// 比較用の正規化：tools/tags.py の norm() と同じ規則（全角半角・大文字小文字・中黒や空白の違いを無視）
export const normText = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[・･\s、,／/()（）「」\-−ー~〜]/g, '');
let searchIndex = null;
export async function loadSearch() {
  if (!searchIndex) {
    searchIndex = fetch('data/search.json').then(r => { if (!r.ok) throw new Error(`data/search.json を読めません（${r.status}）`); return r.json(); })
      .then(d => { if (META.dataVersion && d.dataVersion !== META.dataVersion) staleData.add('data/search.json'); return d.items; })
      .catch(e => { searchIndex = null; throw e; });
  }
  return searchIndex;
}
// 空白で区切った語をすべて含む問題を返す。タグが語と一致 > テーマに含む > 本文に含む の順、同点は易しい順
export async function searchProblems(query, { levels = null } = {}) {
  const terms = String(query || '').split(/[\s　]+/).map(normText).filter(Boolean);
  if (!terms.length) return [];
  const items = await loadSearch();
  const ls = levels && new Set(levels);
  const out = [];
  for (const [id, text] of items) {
    if (!terms.every(t => text.includes(t))) continue;
    const e = entryById.get(id);
    if (!e || (ls && !ls.has(e.lv))) continue;
    const tags = (e.tg || []).map(normText), theme = normText((e.th || '').replace(/<[^>]+>|\$[^$]*\$/g, ''));
    let score = 0;
    for (const t of terms) score += tags.includes(t) ? 3 : theme.includes(t) ? 2 : tags.some(x => x.includes(t)) ? 1.5 : 1;
    out.push({ e, score });
  }
  out.sort((a, b) => b.score - a.score || a.e.lv - b.e.lv || (a.e.id < b.e.id ? -1 : 1));
  return out.map(x => x.e);
}

// ---------- 問題セット（data/collections.json） ----------
let collections = null;
export async function loadCollections() {
  if (!collections) {
    collections = fetch('data/collections.json').then(r => r.ok ? r.json() : { collections: [] })
      .then(d => (d.collections || []).map(c => ({ ...c, items: c.items.filter(it => entryById.has(it.id)) })).filter(c => c.items.length))
      .catch(() => { collections = null; return []; });
  }
  return collections;
}
// セットの順番どおりに、まだ解いていない問題から。全部解いたら、最後に解いてから久しい順
export function pickCollection(state, col, size = 8) {
  const ids = col.items.map(it => it.id);
  const fresh = ids.filter(id => !state.problems[id]);
  const done = ids.filter(id => state.problems[id]).sort((a, b) => state.problems[a].last - state.problems[b].last);
  return [...fresh, ...done].slice(0, size).map(pid => ({ kind: 'problem', pid }));
}
export const collectionProgress = (state, col) => col.items.filter(it => state.problems[it.id]).length;
