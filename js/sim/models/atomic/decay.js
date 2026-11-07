// 放射性崩壊と半減期。各原子核は、いつ崩壊するかが確率的に決まる（単位時間あたりの崩壊の確率 λ が一定）
//   残っている数の期待値 N = N0 (1/2)^(t/T)（T：半減期、λ = ln2 / T）
// 各原子核の崩壊時刻を、決まった乱数の種で前もって選んでおく（t = −ln(u) / λ）
// p = { N0, T [s] }
export const FILE_VERSION = '0.3.0';
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const cache = new Map();
export default {
  id: 'atom.decay',
  integrator: 'analytic',
  times(p) {
    const key = `${p.N0}|${p.T}`;
    if (!cache.has(key)) { const r = rng(2024), lam = Math.LN2 / p.T, a = []; for (let i = 0; i < p.N0; i++) a.push(-Math.log(1 - r()) / lam); cache.set(key, a); }
    return cache.get(key);
  },
  duration(p) { return 4 * p.T; },
  at(p, t) { const ts = this.times(p); let n = 0; for (const x of ts) if (x > t) n++; return { t, N: n, Nth: p.N0 * Math.pow(0.5, t / p.T) }; },
  measures(p) { return { lam: Math.LN2 / p.T }; },
  validity(p) { return p.N0 < 100 ? ['原子核が少ないと、崩壊のばらつき（ゆらぎ）が目立ちます'] : []; },
};
