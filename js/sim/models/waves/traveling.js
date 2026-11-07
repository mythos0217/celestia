// 正弦波の伝わり方。y(x, t) = A sin 2π(f t − s x / λ)（s = +1 で +x 向き、−1 で −x 向き）
// 媒質の各点は上下に単振動するだけで、波形（山）は速さ v = fλ で進む。点 P（x = xP）の変位と速度も追う
// p = { A [m], lambda [m], f [Hz], dir（+1 / −1）, xP [m] }
export const FILE_VERSION = '0.3.0';
export const XMAX = 8;   // 表示する媒質の長さ [m]
const TAU = 2 * Math.PI;
export default {
  id: 'wave.traveling',
  integrator: 'analytic',
  duration({ f }) { return Math.min(20, 3 / f); },
  y({ A, lambda, f, dir }, x, t) { return A * Math.sin(TAU * (f * t - Math.sign(dir || 1) * x / lambda)); },
  at(p, t) {
    const ph = TAU * (p.f * t - Math.sign(p.dir || 1) * p.xP / p.lambda);
    return { t, yP: p.A * Math.sin(ph), vP: p.A * TAU * p.f * Math.cos(ph), crest: this.crest(p, t) };
  },
  // 1つの山の位置（x = 0 に山があった時刻 t0 から、速さ fλ で進む）。表示範囲で折り返す
  crest(p, t) {
    const v = p.f * p.lambda * Math.sign(p.dir || 1);
    const x0 = Math.sign(p.dir || 1) > 0 ? p.lambda / 4 : XMAX - (XMAX % p.lambda) + p.lambda / 4 - p.lambda;
    return ((x0 + v * t) % XMAX + XMAX) % XMAX;
  },
  snapshot(p, t) {
    const n = 241, x = [], y = [];
    for (let i = 0; i < n; i++) { const xi = XMAX * i / (n - 1); x.push(xi); y.push(this.y(p, xi, t)); }
    return { x, y };
  },
  measures({ lambda, f }) { return { v: f * lambda, T: 1 / f }; },
  validity() { return []; },
};
