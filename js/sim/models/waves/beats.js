// うなり：振動数の近い2つの音の重ね合わせ。y = A sin 2πf1 t + A sin 2πf2 t
//   = 2A cos(π(f1 − f2)t) sin(π(f1 + f2)t)。大きさ（包絡線）は 1 秒に |f1 − f2| 回大きくなる
// 見やすさのため、実際の音（数百 Hz）より低い振動数で示す（関係は同じ）
// p = { f1 [Hz], f2 [Hz], A }
export const FILE_VERSION = '0.3.0';
const TAU = 2 * Math.PI;
export default {
  id: 'wave.beats',
  integrator: 'analytic',
  sample(p) { return 1 / (40 * Math.max(p.f1, p.f2)); },
  duration(p) { const d = Math.abs(p.f1 - p.f2); return d > 1e-9 ? Math.min(12, 3 / d) : 4; },
  at(p, t) {
    const y1 = p.A * Math.sin(TAU * p.f1 * t), y2 = p.A * Math.sin(TAU * p.f2 * t);
    const env = 2 * p.A * Math.abs(Math.cos(Math.PI * (p.f1 - p.f2) * t));
    return { t, y1, y2, y: y1 + y2, env, envm: -env };
  },
  measures(p) { const d = Math.abs(p.f1 - p.f2); return { fb: d, Tb: d > 1e-9 ? 1 / d : null }; },
  validity(p) { return Math.abs(p.f1 - p.f2) > 0.3 * Math.min(p.f1, p.f2) ? ['振動数の差が大きいと、うなりとして聞き分けにくくなります'] : []; },
};
