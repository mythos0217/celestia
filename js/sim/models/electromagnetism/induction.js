// 磁場中を動く導体棒（電磁誘導）。間隔 l の平行レールに抵抗 R、磁場 B（鉛直）。棒（質量 m）に一定の力 F
//   誘導起電力 V = vBl、電流 I = vBl/R、棒が磁場から受ける力 IlB（運動を妨げる向き：レンツの法則）
//   運動方程式 m dv/dt = F − (B²l²/R) v → v = vt + (v0 − vt) e^(−t/τ)、終端速度 vt = FR/(B²l²)、τ = mR/(B²l²)
// p = { F [N], v0 [m/s], B [T], l [m], R [Ω], m [kg] }
export const FILE_VERSION = '0.3.0';
export default {
  id: 'elm.induction',
  integrator: 'analytic',
  k(p) { return p.B * p.B * p.l * p.l / p.R; },
  tau(p) { return p.m / this.k(p); },
  vt(p) { return p.F / this.k(p); },
  duration(p) { return Math.min(30, 5 * this.tau(p)); },
  at(p, t) {
    const tau = this.tau(p), vt = this.vt(p), e = Math.exp(-t / tau);
    const v = vt + (p.v0 - vt) * e, x = vt * t + (p.v0 - vt) * tau * (1 - e);
    const emf = v * p.B * p.l, I = emf / p.R;
    // 0〜t の熱 ∫I²R dt と F の仕事 Fx（エネルギーの収支の確認用）
    const a = p.v0 - vt;
    const heat = this.k(p) * (vt * vt * t + 2 * vt * a * tau * (1 - e) + a * a * tau / 2 * (1 - e * e));
    return { t, x, v, emf, I, Fm: I * p.l * p.B, K: 0.5 * p.m * v * v, heat, W: p.F * x };
  },
  measures(p) { return { vt: this.vt(p), tau: this.tau(p) }; },
  validity() { return []; },
};
