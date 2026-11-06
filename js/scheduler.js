// 間隔反復スケジューラ（FSRS の考え方を簡略化したもの）。Lemma から引き継ぎ、問題ごとの記憶の状態だけを扱う。
// 記憶の安定度 S（日）と難しさ D（1〜10）を問題ごとに持つ。
// 想起確率 R(t) = 1 / (1 + t / (9S))。R が 0.9 を切ったら復習（t = S 日後）。

export const FILE_VERSION = '0.1.1';
const DAY = 86400000;
const INIT_S = { 1: 0.4, 2: 1.2, 3: 3, 4: 8 }; // 初回の評価ごとの安定度（日）
export const TARGET_R = 0.9;

export function retrievability(st, now = Date.now()) {
  if (!st || !st.reps) return 0;
  const t = Math.max(0, (now - st.last) / DAY);
  return 1 / (1 + t / (9 * st.S));
}

export function dueAt(st) { return st.last + st.S * DAY; }

// grade: 1 = 解けなかった / 2 = ヒントを使って解けた / 3 = 自力で解けた / 4 = 自信をもって即答
export function review(st, grade, now = Date.now()) {
  if (!st || !st.reps) {
    return { S: INIT_S[grade], D: Math.min(10, Math.max(1, 5 - (grade - 3) * 1.5)), last: now, reps: 1, lapses: grade === 1 ? 1 : 0 };
  }
  const R = retrievability(st, now);
  let S;
  if (grade === 1) {
    S = Math.max(0.3, st.S * 0.3);
  } else {
    const mult = { 2: 0.6, 3: 1, 4: 1.4 }[grade];
    const growth = Math.E * (11 - st.D) * Math.pow(st.S, -0.2) * (Math.exp(1 - R) - 1) * mult;
    S = st.S * (1 + Math.max(0.05, growth));
  }
  const D = Math.min(10, Math.max(1, st.D - 0.8 * (grade - 3)));
  return { S, D, last: now, reps: st.reps + 1, lapses: st.lapses + (grade === 1 ? 1 : 0) };
}

export function cardStatus(st, now = Date.now()) {
  if (!st || !st.reps) return 'new';
  if (st.S >= 21) return 'solid';
  return retrievability(st, now) < TARGET_R ? 'due' : 'learning';
}

export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
