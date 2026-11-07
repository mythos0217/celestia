// 一様な磁場中の荷電粒子（磁場は紙面に垂直・裏から表の向き、速度は磁場に垂直）。
//   ローレンツ力 qvB が向心力：m v²/r = q v B → r = m v / (q B)、周期 T = 2π m / (q B)（速さによらない）
// p = { A（質量数：質量 A × 1.67×10⁻²⁷ kg）, Z（電荷 Z × 1.60×10⁻¹⁹ C）, v [×10⁵ m/s], B [T] }
export const FILE_VERSION = '0.3.0';
export const MP = 1.67e-27, E0 = 1.60e-19;
export default {
  id: 'elm.lorentz',
  integrator: 'analytic',
  mq(p) { return { m: p.A * MP, q: p.Z * E0, v: p.v * 1e5 }; },
  radius(p) { const { m, q, v } = this.mq(p); return m * v / (q * p.B); },
  period(p) { const { m, q } = this.mq(p); return 2 * Math.PI * m / (q * p.B); },
  duration(p) { return 2 * this.period(p); },
  sample(p) { return this.period(p) / 300; },
  playRate(p) { return this.period(p) / 2; },
  // 原点から +x 向きに入射。正電荷・磁場が表向きなら、力 qv×B は −y 向き → 時計回り
  at(p, t) {
    const r = this.radius(p), w = 2 * Math.PI / this.period(p), { v } = this.mq(p);
    const s = Math.sin(w * t), c = Math.cos(w * t);
    return { t, x: r * s, y: -r * (1 - c), vx: v * c, vy: -v * s, F: this.mq(p).q * v * p.B };
  },
  measures(p) { return { r: this.radius(p), T: this.period(p), F: this.mq(p).q * this.mq(p).v * p.B }; },
  validity() { return []; },
};
