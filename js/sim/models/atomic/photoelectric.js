// 光電効果。光子のエネルギー hf が仕事関数 W より大きいときだけ電子が飛び出す（光の強さによらない）
//   飛び出す電子の運動エネルギーの最大値 K0 = hf − W、阻止電圧 V0 = K0 / e
//   光電流：陽極の電圧 V ≥ 0 で飽和電流（光の強さに比例）。V < 0 では運動エネルギーが e|V| 以上の電子だけ届く
//   （簡単のため、電子の運動エネルギーは 0〜K0 に一様に分布するとみなす）
// 時間によらない。振動数ごとの K0 と、電圧ごとの光電流を分布として出す
// p = { f [×10¹⁴ Hz], W [eV], I（光の強さ・相対値）, V [V] }
export const FILE_VERSION = '0.3.0';
export const H = 6.63e-34, E = 1.60e-19;
export default {
  id: 'atom.photoelectric',
  static: true,
  K0(p) { return H * p.f * 1e14 / E - p.W; },   // [eV]（負なら飛び出さない）
  current(p, V) { const K = this.K0(p); if (K <= 0) return 0; if (V >= 0) return p.I; return p.I * Math.max(0, 1 + V / K); },
  profile(p) {
    const fs = [], Ks = [], Vs = [], Is = [];
    for (let i = 0; i <= 240; i++) { const f = 2 + 18 * i / 240; fs.push(f); Ks.push(Math.max(0, this.K0({ ...p, f }))); }
    for (let i = 0; i <= 240; i++) { const V = -5 + 8 * i / 240; Vs.push(V); Is.push(this.current(p, V)); }
    return { state: { K0: Math.max(0, this.K0(p)), f0: p.W * E / H / 1e14, Icur: this.current(p, p.V), emit: this.K0(p) > 0 ? 1 : 0, markF: p.f, markV: p.V },
      obs: { f: fs, K: Ks, V: Vs, Ip: Is } };
  },
  measures(p) { const K = this.K0(p); return { K0: Math.max(0, K), V0: Math.max(0, K), f0: p.W * E / H / 1e14, lam: 3e8 / (p.f * 1e14) * 1e9 }; },
  validity(p) { return this.K0(p) <= 0 ? ['光の振動数が限界振動数より小さいので、どんなに強い光でも電子は飛び出しません'] : []; },
};
