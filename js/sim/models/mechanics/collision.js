// 1次元の衝突（2台の台車）。台車1は左、台車2は右から始まる。速度は右向きを正。
//   衝突後：v1' = (m1v1 + m2v2 − m2 e (v1 − v2)) / (m1 + m2)、v2' = (m1v1 + m2v2 + m1 e (v1 − v2)) / (m1 + m2)
//   （運動量保存と、反発係数の式 v2' − v1' = −e (v2 − v1) を連立したもの）
// p = { m1, m2 [kg], v1, v2 [m/s], e }
export const FILE_VERSION = '0.3.0';
export const X1 = -1.5, X2 = 0.5, W = 0.4;   // 初めの位置（台車の中心）と台車の長さ [m]
export default {
  id: 'mech.collision',
  integrator: 'analytic',
  // どちらかの台車が見える範囲（|x| ≤ 2.4 m）を出るまで（長くても 4 秒）
  duration(p) {
    const lim = 2.4, tc = this.collisionTime(p);
    const leave = (x0, v) => (v > 0 ? (lim - x0) / v : v < 0 ? (-lim - x0) / v : Infinity);
    if (tc == null) return Math.min(4, Math.max(0.5, Math.min(leave(X1, p.v1), leave(X2, p.v2))));
    const [a, b] = this.after(p), c1 = X1 + p.v1 * tc, c2 = X2 + p.v2 * tc;
    return Math.min(4, Math.max(tc + 0.8, tc + Math.min(leave(c1, a), leave(c2, b))));
  },
  collisionTime({ v1, v2 }) {
    const gap = (X2 - X1) - W, rel = v1 - v2;   // 近づく速さ
    return rel > 0 ? gap / rel : null;
  },
  after({ m1, m2, v1, v2, e }) {
    const P = m1 * v1 + m2 * v2, M = m1 + m2;
    return [(P - m2 * e * (v1 - v2)) / M, (P + m1 * e * (v1 - v2)) / M];
  },
  at(p, t) {
    const tc = this.collisionTime(p);
    let x1, x2, u1, u2;
    if (tc == null || t <= tc) { u1 = p.v1; u2 = p.v2; x1 = X1 + u1 * t; x2 = X2 + u2 * t; }
    else {
      const [a, b] = this.after(p);
      const c1 = X1 + p.v1 * tc, c2 = X2 + p.v2 * tc;
      u1 = a; u2 = b; x1 = c1 + a * (t - tc); x2 = c2 + b * (t - tc);
    }
    return { t, x1, x2, v1: u1, v2: u2, p: p.m1 * u1 + p.m2 * u2, K: 0.5 * p.m1 * u1 * u1 + 0.5 * p.m2 * u2 * u2, hit: tc != null && t > tc ? 1 : 0 };
  },
  measures(p) {
    const [a, b] = this.after(p);
    const K0 = 0.5 * p.m1 * p.v1 ** 2 + 0.5 * p.m2 * p.v2 ** 2, K1 = 0.5 * p.m1 * a * a + 0.5 * p.m2 * b * b;
    return { v1after: a, v2after: b, dK: K1 - K0, tc: this.collisionTime(p) };
  },
  validity(p) { return this.collisionTime(p) == null ? ['このままでは2台は近づかないので衝突しません'] : []; },
};
