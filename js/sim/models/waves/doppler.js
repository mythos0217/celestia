// ドップラー効果（一直線上）。音源 S は x = 0 から速度 vs、観測者 O は x = D から速度 vo で動く（右向きが正）。
// 音源は振動数 f で波面を出す。時刻 te に出た波面が観測者に届く時刻：D + vo t − vs te = V (t − te)
//   → t = (D + (V − vs) te) / (V − vo)。届く間隔から、観測される振動数 f' = f (V − vo) / (V − vs)
// 見やすさのため振動数は小さく（1 秒に数回）示す。関係は実際の音と同じ
// p = { f [Hz], vs [m/s], vo [m/s], V [m/s] }
export const FILE_VERSION = '0.3.0';
export const D = 900;
const TAU = 2 * Math.PI;
export default {
  id: 'wave.doppler',
  integrator: 'analytic',
  // 音源が観測者を追い越す前まで（追い越すと前後が入れかわり、式の向きが変わる）
  // 最初の波面が観測者に届いてから、聞こえる振動数で3回分以上（長くても 15 秒）
  duration(p) {
    const meet = p.vs > p.vo ? D / (p.vs - p.vo) : Infinity, fo = p.f * (p.V - p.vo) / (p.V - p.vs);
    return Math.min(15, D / (p.V - p.vo) + 3.5 / fo, 0.9 * meet);
  },
  // 時刻 t に観測者に届いている波面が出た時刻（まだ届いていなければ null）
  emitTimeAtObserver(p, t) { const te = ((p.V - p.vo) * t - D) / (p.V - p.vs); return te >= 0 ? te : null; },
  at(p, t) {
    const te = this.emitTimeAtObserver(p, t);
    return { t, xs: p.vs * t, xo: D + p.vo * t, ys: Math.sin(TAU * p.f * t), yo: te == null ? 0 : Math.sin(TAU * p.f * te) };
  },
  // 波面：出た時刻 te と中心 xs(te)。t までに出た分（新しいものから）
  fronts(p, t) { const out = []; for (let k = Math.floor(p.f * t); k >= 0 && out.length < 40; k--) { const te = k / p.f; out.push({ x: p.vs * te, r: p.V * (t - te) }); } return out; },
  measures(p) { return { fo: p.f * (p.V - p.vo) / (p.V - p.vs), lamFront: (p.V - p.vs) / p.f, lamBack: (p.V + p.vs) / p.f }; },
  // 波面が観測者に届いた時刻の間隔から測る（式と独立に確かめる）
  measureTrace(trace) {
    const ts = [], y = trace.obs.yo, t = trace.t;
    for (let i = 1; i < y.length; i++) if (y[i - 1] < 0 && y[i] >= 0) ts.push(t[i - 1] + (t[i] - t[i - 1]) * (-y[i - 1]) / (y[i] - y[i - 1]));
    return { foMeasured: ts.length >= 2 ? (ts.length - 1) / (ts[ts.length - 1] - ts[0]) : null };
  },
  validity(p) { return Math.abs(p.vs) >= p.V ? ['音源が音速以上で動くと、波面が重なって衝撃波になります（この式は使えません）'] : []; },
};
