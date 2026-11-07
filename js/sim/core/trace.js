// 軌跡（時系列）を作る。アニメーションもグラフも、この同じ軌跡から描く（両者が食い違わない）。
//   解析解のあるモデル … at(p, t) を一定間隔で呼ぶ（誤差なし）
//   数値積分のモデル   … 固定刻み dt で積分し、一定間隔で記録する。巻き戻しは記録を引くだけ（計算し直さない）
//   イベント（着地・衝突など）… 符号が変わった区間を二分法で詰め、正確な時刻で止める
import { step } from './integrators.js';
export const FILE_VERSION = '0.3.0';

const SAMPLE = 1 / 120;   // 記録の間隔（秒）。長い現象（人工衛星など）はモデルの sample(p) で変える
const MAX_SAMPLES = 20000;

export function buildTrace(model, p, { tMax = null } = {}) {
  // 時間によらないシミュレーション（レンズの像・干渉縞の強度分布など）：分布を1回計算するだけ
  if (model.static) {
    const prof = model.profile(p);
    return { t: [0], states: [prof.state], obs: prof.obs, tEnd: 0, events: [], static: true };
  }
  const T = tMax ?? model.duration(p);
  const sample = Math.max(model.sample ? model.sample(p) : SAMPLE, T / MAX_SAMPLES);
  const ts = [], states = [];
  const events = [];
  let tEnd = T;
  if (model.at) {
    const ev = model.endTime ? model.endTime(p) : null;
    if (ev != null && ev < T) { tEnd = ev; events.push({ name: model.endName || 'end', t: ev }); }
    const n = Math.max(2, Math.ceil(tEnd / sample));
    for (let i = 0; i <= n; i++) { const t = tEnd * i / n; ts.push(t); states.push(model.at(p, t)); }
  } else {
    const dt = model.dt(p);
    let s = model.init(p), t = 0, next = 0;
    ts.push(0); states.push(model.state(s, p, 0));
    next = sample;
    const evFn = model.event;
    let stop = false;
    while (t < T - 1e-12 && !stop) {
      const h = Math.min(dt, T - t);
      let s1 = step(model, p, s, t, h);
      if (evFn && evFn(s, p) > 0 && evFn(s1, p) <= 0) {
        // 二分法で着地などの時刻を求める
        let lo = 0, hi = h;
        for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; const sm = step(model, p, s, t, mid); if (evFn(sm, p) > 0) lo = mid; else hi = mid; }
        s1 = step(model, p, s, t, hi);
        t += hi; s = s1; stop = true; tEnd = t;
        events.push({ name: model.endName || 'end', t });
        ts.push(t); states.push(model.state(s, p, t));
        break;
      }
      s = s1; t += h;
      if (t >= next - 1e-12) { ts.push(t); states.push(model.state(s, p, t)); next += sample; }
    }
    if (!stop) tEnd = t;
  }
  const obs = {};
  for (const k of Object.keys(states[0])) obs[k] = states.map(st => st[k]);
  return { t: ts, states, obs, tEnd, events };
}

// 時刻 t の状態（記録の間は1次補間。描画用）
export function stateAt(trace, t) {
  if (trace.static) return trace.states[0];
  const ts = trace.t;
  if (t <= ts[0]) return trace.states[0];
  if (t >= ts[ts.length - 1]) return trace.states[ts.length - 1];
  let lo = 0, hi = ts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
  const r = (t - ts[lo]) / (ts[hi] - ts[lo] || 1);
  const a = trace.states[lo], b = trace.states[hi], out = {};
  for (const k of Object.keys(a)) out[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * r : a[k];
  return out;
}

// 周期の測定：ある量が上向きに 0 を横切る時刻の間隔の平均（補間で求める）
export function measurePeriod(trace, key) {
  const t = trace.t, y = trace.obs[key], ups = [];
  for (let i = 1; i < y.length; i++) if (y[i - 1] < 0 && y[i] >= 0) ups.push(t[i - 1] + (t[i] - t[i - 1]) * (-y[i - 1]) / (y[i] - y[i - 1]));
  if (ups.length < 2) return null;
  return (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
}
