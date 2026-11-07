// あらい斜面上の物体。斜面の上端に静かに置く。
//   tanθ ≤ μ（静止摩擦係数）なら静止：f = mg sinθ（つり合い）
//   そうでなければ滑る：a = g (sinθ − μ' cosθ)。a ≤ 0 なら（μ' ≥ tanθ）動き出せず静止とみなす
// p = { theta [rad], mu, muk, m [kg], g [m/s²] }。斜面の長さは 4 m
export const FILE_VERSION = '0.3.0';
export const LENGTH = 4;
export default {
  id: 'mech.incline',
  integrator: 'analytic',
  endName: '下端に到達',
  accel({ theta, mu, muk, g }) {
    if (Math.tan(theta) <= mu + 1e-12) return 0;
    return Math.max(0, g * (Math.sin(theta) - muk * Math.cos(theta)));
  },
  endTime(p) { const a = this.accel(p); return a > 0 ? Math.sqrt(2 * LENGTH / a) : null; },
  duration(p) { const T = this.endTime(p); return T ?? 3; },
  at(p, t) {
    const { theta, m, g, muk } = p, a = this.accel(p);
    const N = m * g * Math.cos(theta);
    const sliding = a > 0;
    const f = sliding ? muk * N : m * g * Math.sin(theta);
    return { t, s: 0.5 * a * t * t, v: a * t, a, N, f, sliding: sliding ? 1 : 0 };
  },
  measures(p) { const a = this.accel(p); return { a, N: p.m * p.g * Math.cos(p.theta), fmax: p.mu * p.m * p.g * Math.cos(p.theta) }; },
  validity(p) { return p.muk > p.mu ? ['動摩擦係数が静止摩擦係数より大きい設定です（ふつうは μ\' < μ）'] : []; },
};
