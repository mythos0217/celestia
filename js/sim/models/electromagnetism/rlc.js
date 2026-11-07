// 交流の RLC 直列回路（十分時間がたった後の定常状態）。電源電圧 v = V0 sin ωt
//   インピーダンス Z = √(R² + (ωL − 1/(ωC))²)、電流 i = (V0/Z) sin(ωt − φ)、tan φ = (ωL − 1/(ωC)) / R
//   各素子の電圧：vR = Ri（電流と同位相）、vL：電流より π/2 進む（振幅 ωL I0）、vC：π/2 遅れる（振幅 I0/(ωC)）
//   共振周波数 f0 = 1 / (2π√(LC)) で Z = R が最小
// 見やすさのため振動数を小さく（1秒に数回）したので、L と C は大きめの値
// p = { V0 [V], f [Hz], R [Ω], L [H], C [F] }
export const FILE_VERSION = '0.3.0';
const TAU = 2 * Math.PI;
export default {
  id: 'elm.rlc',
  integrator: 'analytic',
  parts(p) {
    const w = TAU * p.f, XL = w * p.L, XC = 1 / (w * p.C), Z = Math.hypot(p.R, XL - XC);
    return { w, XL, XC, Z, I0: p.V0 / Z, phi: Math.atan2(XL - XC, p.R) };
  },
  duration(p) { return Math.min(20, 3 / p.f); },
  sample(p) { return 1 / (60 * p.f); },
  at(p, t) {
    const { w, XL, XC, I0, phi } = this.parts(p), th = w * t - phi;
    const i = I0 * Math.sin(th);
    return { t, v: p.V0 * Math.sin(w * t), i, vR: p.R * i, vL: XL * I0 * Math.cos(th), vC: -XC * I0 * Math.cos(th), ph: th };
  },
  measures(p) { const { Z, I0, phi } = this.parts(p); return { Z, I0, phi: phi * 180 / Math.PI, f0: 1 / (TAU * Math.sqrt(p.L * p.C)) }; },
  validity() { return []; },
};
