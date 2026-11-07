// 2つの点波源からの水面波の干渉。波源 S1・S2（間隔 d、同位相）から出た波の重ね合わせ：
//   y = A sin 2π(f t − r1/λ) + A sin 2π(f t − r2/λ)
//   |r1 − r2| = mλ の点で強め合い（腹の線）、(m + 1/2)λ で弱め合う（節の線）
// p = { d [m], lambda [m], f [Hz], phase（0：同位相、1：逆位相） }
export const FILE_VERSION = '0.3.0';
export const W = 10, H = 7;   // 水面の範囲 [m]（波源は下端の中央付近）
export const SCREEN_Y = 6;    // 振幅の分布を見る線の高さ
const TAU = 2 * Math.PI;
export default {
  id: 'wave.interference',
  integrator: 'analytic',
  duration(p) { return 4 / p.f; },
  sources(p) { return [[-p.d / 2, 0.5], [p.d / 2, 0.5]]; },
  // 点 (x, y) での変位（描画用。物理の式はここだけ）
  field(p, x, y, t) {
    const [[x1, y1], [x2, y2]] = this.sources(p), k = TAU / p.lambda, w = TAU * p.f;
    const r1 = Math.hypot(x - x1, y - y1), r2 = Math.hypot(x - x2, y - y2);
    return Math.sin(w * t - k * r1) + Math.sin(w * t - k * r2 + (p.phase ? Math.PI : 0));
  },
  // 振幅（時間平均ではなく、合成波の振幅 = |2 cos(π Δr/λ + 位相差/2)|）
  amp(p, x, y) {
    const [[x1, y1], [x2, y2]] = this.sources(p);
    const dr = Math.hypot(x - x1, y - y1) - Math.hypot(x - x2, y - y2);
    return Math.abs(2 * Math.cos(Math.PI * dr / p.lambda + (p.phase ? Math.PI / 2 : 0)));
  },
  at(p, t) { return { t, yC: this.field(p, 0, SCREEN_Y, t) }; },
  snapshot(p) {
    const n = 241, x = [], a = [];
    for (let i = 0; i < n; i++) { const xi = -W / 2 + W * i / (n - 1); x.push(xi); a.push(this.amp(p, xi, SCREEN_Y)); }
    return { x, a };
  },
  // 腹の線の数（両波源を結ぶ線分上で |Δr| = mλ < d となる m の数）
  measures(p) { const m = Math.floor(p.d / p.lambda - 1e-12); return { lines: p.phase ? 2 * Math.floor(p.d / p.lambda + 0.5 - 1e-12) : 2 * m + 1 }; },
  validity() { return []; },
};
