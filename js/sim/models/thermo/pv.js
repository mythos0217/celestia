// 理想気体（単原子分子、1 mol）の状態変化と熱力学第1法則 Q = ΔU + W（W：気体がした仕事）
//   はじめ T0 = 300 K、P0 = 1.0×10⁵ Pa。変化の種類：0 等温、1 定圧、2 定積、3 断熱
//   ratio：等温・定圧・断熱は体積の比 V/V0、定積は圧力の比 P/P0
//   ΔU = (3/2) nR ΔT。断熱では PV^γ = 一定（γ = 5/3）
// 変化はゆっくり（準静的）。時刻 0〜4 秒で変化の途中を追う
// p = { proc, ratio }
export const FILE_VERSION = '0.3.0';
export const R = 8.31, N = 1, T0 = 300, P0 = 1.0e5, V0 = N * R * T0 / P0, GAMMA = 5 / 3;
export default {
  id: 'thermo.pv',
  integrator: 'analytic',
  duration() { return 4; },
  // 変化の割合 s（0〜1）での状態
  state(p, s) {
    const r = 1 + (p.ratio - 1) * s, proc = Math.round(p.proc);
    let P, V, T, W;
    if (proc === 0) { V = V0 * r; T = T0; P = N * R * T / V; W = N * R * T0 * Math.log(r); }
    else if (proc === 1) { V = V0 * r; P = P0; T = P * V / (N * R); W = P0 * (V - V0); }
    else if (proc === 2) { V = V0; P = P0 * r; T = P * V / (N * R); W = 0; }
    else { V = V0 * r; P = P0 * Math.pow(V0 / V, GAMMA); T = P * V / (N * R); W = (P0 * V0 - P * V) / (GAMMA - 1); }
    const dU = 1.5 * N * R * (T - T0);
    return { P, V, T, W, dU, Q: dU + W };
  },
  at(p, t) { return { t, ...this.state(p, Math.min(1, t / 4)) }; },
  measures(p) { const e = this.state(p, 1); return { W: e.W, Q: e.Q, dU: e.dU, T2: e.T }; },
  validity(p) { return Math.round(p.proc) === 2 && Math.abs(p.ratio - 1) < 1e-9 ? ['変化がありません'] : []; },
};
