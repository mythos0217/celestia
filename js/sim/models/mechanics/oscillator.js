// ばね振り子（水平、なめらかな面）。解析解 x = A cos ωt、ω = √(k/m)
// p = { m [kg], k [N/m], A [m] }
export const FILE_VERSION = '0.3.0';
export default {
  id: 'mech.spring',
  integrator: 'analytic',
  omega({ m, k }) { return Math.sqrt(k / m); },
  duration(p) { return Math.min(30, 3 * 2 * Math.PI / this.omega(p)); },
  at(p, t) {
    const w = this.omega(p), x = p.A * Math.cos(w * t), v = -p.A * w * Math.sin(w * t);
    return { t, x, v, a: -w * w * x, K: 0.5 * p.m * v * v, U: 0.5 * p.k * x * x };
  },
  measures(p) { return { period: 2 * Math.PI / this.omega(p) }; },
  validity() { return []; },
};
