// コンデンサーの充電・放電（RC 回路）。時定数 τ = RC
//   充電（電池 E）：q = CE (1 − e^(−t/τ))、I = (E/R) e^(−t/τ)
//   放電（はじめ電圧 E）：q = CE e^(−t/τ)、I = −(E/R) e^(−t/τ)
//   充電が終わるまでに電池がした仕事 QE = CE² のうち、半分 ½CE² がコンデンサーに、残り半分が抵抗の熱になる
// p = { E [V], R [kΩ], C [μF], mode（1：充電、0：放電） }
export const FILE_VERSION = '0.3.0';
export default {
  id: 'elm.rc',
  integrator: 'analytic',
  tau(p) { return p.R * 1e3 * p.C * 1e-6; },
  duration(p) { return 5 * this.tau(p); },
  sample(p) { return this.tau(p) / 200; },
  playRate(p) { return this.tau(p); },   // τ を 1 秒で見せる
  at(p, t) {
    const tau = this.tau(p), C = p.C * 1e-6, R = p.R * 1e3, e = Math.exp(-t / tau);
    const charge = p.mode >= 0.5;
    const q = charge ? C * p.E * (1 - e) : C * p.E * e;
    const I = (charge ? 1 : -1) * p.E / R * e;
    // 抵抗で出た熱（0 から t まで）：∫ I²R dt = (E²/R)(τ/2)(1 − e^(−2t/τ)) = ½CE² (1 − e^(−2t/τ))
    const heat = 0.5 * C * p.E * p.E * (1 - e * e);
    return { t, q: q * 1e6, I: I * 1e3, Vc: q / C, VR: I * R, U: q * q / (2 * C), heat };
  },
  measures(p) { const C = p.C * 1e-6; return { tau: this.tau(p), Q: C * p.E * 1e6, Uf: 0.5 * C * p.E * p.E }; },
  validity() { return []; },
};
