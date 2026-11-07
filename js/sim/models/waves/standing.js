// 弦の固有振動（両端固定の定常波）。逆向きに進む2つの正弦波の重ね合わせ：
//   y1 = A sin 2π(x/λ − f t)、y2 = A sin 2π(x/λ + f t)、y = y1 + y2 = 2A sin(2πx/λ) cos(2πft)
//   両端が節になるのは λ = 2L/n のとき：振動数 f_n = n v / (2L)
// p = { L [m], n（倍振動の番号）, v [m/s]（弦を伝わる波の速さ）, A [m] }
export const FILE_VERSION = '0.3.0';
const TAU = 2 * Math.PI;
export default {
  id: 'wave.standing',
  integrator: 'analytic',
  lam(p) { return 2 * p.L / p.n; },
  freq(p) { return p.n * p.v / (2 * p.L); },
  sample(p) { return Math.min(1 / 120, 1 / (40 * this.freq(p))); },
  playRate(p) { return Math.min(1, 0.6 / this.freq(p)); },   // 1秒に約 0.6 回振動して見えるように
  duration(p) { return 4 / this.freq(p); },
  at(p, t) {
    const f = this.freq(p), lam = this.lam(p), xa = lam / 4;   // 最初の腹
    return { t, yAnti: 2 * p.A * Math.sin(TAU * xa / lam) * Math.cos(TAU * f * t) };
  },
  snapshot(p, t) {
    const f = this.freq(p), lam = this.lam(p), n = 201, x = [], y1 = [], y2 = [], y = [];
    for (let i = 0; i < n; i++) {
      const xi = p.L * i / (n - 1);
      const a = p.A * Math.sin(TAU * (xi / lam - f * t)), b = p.A * Math.sin(TAU * (xi / lam + f * t));
      x.push(xi); y1.push(a); y2.push(b); y.push(a + b);
    }
    return { x, y1, y2, y };
  },
  nodes(p) { const out = []; for (let k = 0; k <= p.n; k++) out.push(k * p.L / p.n); return out; },
  measures(p) { return { f: this.freq(p), lambda: this.lam(p), nodes: p.n + 1 }; },
  validity() { return []; },
};
