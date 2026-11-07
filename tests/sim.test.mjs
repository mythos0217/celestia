// シミュレーションの物理モデルの検査（ブラウザなし）：解析解・保存則・登録簿との整合・依存の向き
//   node tests/sim.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTrace, measurePeriod, stateAt } from '../js/sim/core/trace.js';
import { merge, toModel, clamp } from '../js/sim/core/params.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const near = (a, b, rel = 1e-6) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
const load = async (n) => (await import(`../js/sim/models/mechanics/${n}.js`)).default;
const sims = JSON.parse(fs.readFileSync(path.join(root, 'content/simulations.json'), 'utf8')).simulations;
const D = Math.PI / 180;

// 登録簿：ready のものはモデルがあり、ID が一致し、既定値で軌跡が作れて、グラフの量が状態にある
for (const s of sims.filter(x => x.status === 'ready')) {
  const m = (await import(`../js/sim/models/${s.model}.js`)).default;
  ok(m.id === s.id, `${s.id}：モデルの id が一致`);
  const tr = buildTrace(m, toModel(s, merge(s)));
  ok(tr.static ? Object.keys(tr.obs).length > 0 : tr.t.length > 10 && tr.tEnd > 0, `${s.id}：既定値で軌跡（または分布）ができる`);
  const pm = toModel(s, merge(s));
  for (const sp of s.plots) {
    const o = Array.isArray(sp) ? { x: sp[0], ys: [sp[1]] } : { ...sp, ys: sp.ys || [sp.y] };
    const src = o.snap ? m.snapshot(pm, tr.tEnd / 2) : tr.obs;
    const xs = o.x === 't' && !tr.static && !o.snap ? tr.t : src[o.x];
    ok(xs && o.ys.every(y => src[y] && src[y].length === xs.length && src[y].every(Number.isFinite)), `${s.id}：グラフ ${o.ys}-${o.x} のデータがそろい、有限の値`);
  }
  for (const k of Object.keys(s.observables)) ok(k in tr.obs || k in tr.states[0] || (m.snapshot && k in m.snapshot(pm, 0)), `${s.id}：observables の ${k} が状態・分布にある`);
}

// 斜方投射：到達距離 v0² sin2θ / g、最高点 v0² sin²θ / 2g、着地で止まる
{
  const m = await load('projectile');
  const p = { v0: 20, theta: 30 * D, h0: 0, g: 9.8 };
  const tr = buildTrace(m, p), end = tr.states[tr.states.length - 1];
  ok(near(end.x, 400 * Math.sin(60 * D) / 9.8, 1e-9) && Math.abs(end.y) < 1e-9, `到達距離 ${end.x}`);
  ok(near(Math.max(...tr.obs.y), 100 / 19.6, 1e-3), '最高点の高さ（記録の間隔の誤差内）');
  ok(near(m.measures(p).maxHeight, 100 / 19.6, 1e-12), '最高点の高さ（式）');
  ok(tr.obs.vx.every(v => near(v, 20 * Math.cos(30 * D), 1e-12)), '水平方向の速度は一定');
  const q = { v0: 10, theta: 0, h0: 20, g: 9.8 }, T = m.endTime(q);
  ok(near(T, Math.sqrt(40 / 9.8), 1e-12) && near(m.at(q, T).x, 10 * Math.sqrt(40 / 9.8), 1e-12), '水平投射の落下時間と距離');
}
// 斜面：滑り出し条件 tanθ ≤ μ の境界、加速度 g(sinθ − μ' cosθ)
{
  const m = await load('incline');
  ok(m.accel({ theta: 30 * D, mu: 0.58, muk: 0.3, g: 9.8 }) === 0, 'tan30° = 0.577 < 0.58 なら静止');
  ok(m.accel({ theta: 30 * D, mu: 0.57, muk: 0.3, g: 9.8 }) > 0, 'tan30° > 0.57 なら滑る');
  const a = m.accel({ theta: 30 * D, mu: 0.5, muk: 0.3, g: 9.8 });
  ok(near(a, 9.8 * (0.5 - 0.3 * Math.cos(30 * D)), 1e-12), `滑るときの加速度 ${a}`);
  const st = m.at({ theta: 30 * D, mu: 0.8, muk: 0.3, m: 2, g: 9.8 }, 1);
  ok(near(st.f, 2 * 9.8 * 0.5, 1e-12) && near(st.N, 2 * 9.8 * Math.cos(30 * D), 1e-12), '静止しているとき f = mg sinθ（μN ではない）、N = mg cosθ');
}
// ばね振り子：周期 2π√(m/k)（軌跡から測っても）、エネルギー保存
{
  const m = await load('oscillator');
  for (const [mm, k] of [[1, 10], [2, 10], [0.5, 40]]) {
    const tr = buildTrace(m, { m: mm, k, A: 0.2 });
    const T = measurePeriod(tr, 'v');
    ok(near(T, 2 * Math.PI * Math.sqrt(mm / k), 1e-6), `m=${mm}, k=${k} の周期を軌跡から測る ${T}`);
    ok(tr.states.every(s => near(s.K + s.U, 0.5 * k * 0.04, 1e-9)), '力学的エネルギーが一定');
  }
  const t1 = measurePeriod(buildTrace(m, { m: 1, k: 10, A: 0.2 }), 'v'), t2 = measurePeriod(buildTrace(m, { m: 2, k: 10, A: 0.2 }), 'v');
  ok(near(t2 / t1, Math.SQRT2, 1e-6), '質量を2倍にすると周期は √2 倍（予測の実験）');
  ok(near(measurePeriod(buildTrace(m, { m: 1, k: 10, A: 0.4 }), 'v'), t1, 1e-6), '周期は振幅によらない');
}
// 単振り子：小振幅で 2π√(l/g)、振れ角 90° では T/T0 = 1.18034、エネルギーのずれが小さい（シンプレクティック）
{
  const m = await load('pendulum');
  const p = { l: 1, theta0: 2 * D, g: 9.8 }, T0 = 2 * Math.PI * Math.sqrt(1 / 9.8);
  ok(near(measurePeriod(buildTrace(m, p), 'omega'), T0, 2e-4), '振れ角 2° の周期 ≈ 2π√(l/g)');
  const big = measurePeriod(buildTrace(m, { l: 1, theta0: 90 * D, g: 9.8 }), 'omega');
  ok(near(big / T0, 1.18034, 2e-4), `振れ角 90° の周期の比 ${big / T0}（理論値 1.18034）`);
  const tr = buildTrace(m, { l: 1, theta0: 60 * D, g: 9.8 }, { tMax: 50 * T0 });
  const E = tr.obs.E, drift = Math.max(...E.map(e => Math.abs(e - E[0]))) / E[0];
  ok(drift < 1e-5, `50周期でエネルギーのずれ ${drift.toExponential(2)} < 1e-5`);
}
// 衝突：運動量保存、e=1 で運動エネルギー保存・等質量なら速度交換、e=0 で一体
{
  const m = await load('collision');
  for (const [m1, m2, v1, v2, e] of [[1, 1, 3, 0, 1], [1, 3, 2, -1, 0.5], [2, 1, 1, 0, 0], [1, 1, 3, 0, 0.6]]) {
    const p = { m1, m2, v1, v2, e }, [a, b] = m.after(p);
    ok(near(m1 * a + m2 * b, m1 * v1 + m2 * v2, 1e-12), `運動量保存 (m1=${m1}, m2=${m2}, e=${e})`);
    ok(near(b - a, -e * (v2 - v1), 1e-12), `反発係数の式 (e=${e})`);
  }
  const [a, b] = m.after({ m1: 1, m2: 1, v1: 3, v2: 0, e: 1 });
  ok(near(a, 0, 1e-12) && near(b, 3, 1e-12), '等質量・弾性衝突で速度が入れかわる');
  ok(near(m.measures({ m1: 1, m2: 1, v1: 3, v2: 0, e: 1 }).dK, 0, 1e-12), 'e=1 で運動エネルギー保存');
  const [c, d] = m.after({ m1: 2, m2: 1, v1: 1, v2: 0, e: 0 });
  ok(near(c, d, 1e-12) && near(c, 2 / 3, 1e-12), 'e=0 で一体になって動く');
  const tr = buildTrace(m, { m1: 1, m2: 2, v1: 2, v2: -1, e: 0.5 });
  ok(tr.obs.p.every(x => near(x, 0, 1e-12)), '軌跡の全時刻で運動量が一定');
  ok(Math.min(...tr.states.map(s => s.x2 - s.x1)) >= 0.4 - 1e-9, '台車どうしがめり込まない');
}
// 等速円運動：加速度の大きさ v²/r、中心向き
{
  const m = await load('circular');
  const tr = buildTrace(m, { r: 2, v: 4 });
  ok(tr.states.every(s => near(Math.hypot(s.ax, s.ay), 8, 1e-9) && near(s.ax * s.x + s.ay * s.y, -8 * 2, 1e-9)), '加速度は大きさ v²/r で中心向き');
  ok(tr.states.every(s => near(s.vx * s.x + s.vy * s.y, 0, 1e-9)), '速度は半径に垂直');
}
// 万有引力：円軌道（半径一定・ケプラーの第3法則の周期）、楕円軌道でも E・L が保存
{
  const m = await load('gravitation');
  const { R, GM } = await import('../js/sim/models/mechanics/gravitation.js');
  const p = { r0: 2, vratio: 1 };
  const tr = buildTrace(m, p);
  ok(tr.obs.r.every(r => near(r, 2 * R, 1e-6)), '円軌道の半径が一定（相対 1e-6）');
  const T = measurePeriod(tr, 'x');
  ok(near(T, 2 * Math.PI * Math.sqrt((2 * R) ** 3 / GM), 1e-4), `周期 = 2π√(r³/GM)（ケプラーの第3法則） ${T}`);
  const tr2 = buildTrace(m, { r0: 2, vratio: 0.8 });
  const dE = Math.max(...tr2.obs.E.map(e => Math.abs(e - tr2.obs.E[0]))) / Math.abs(tr2.obs.E[0]);
  const dL = Math.max(...tr2.obs.L.map(l => Math.abs(l - tr2.obs.L[0]))) / tr2.obs.L[0];
  ok(dE < 1e-5 && dL < 1e-9, `楕円軌道で E（${dE.toExponential(1)}）と L（${dL.toExponential(1)}）が保存`);
  const tr3 = buildTrace(m, { r0: 1.2, vratio: 0.3 });
  ok(tr3.events.length === 1 && near(tr3.states[tr3.states.length - 1].r, R, 1e-6), '遅すぎると地表に落ちて止まる（時刻はイベント検出）');
}

// ---------------- 波動
const loadF = async (f) => (await import(`../js/sim/models/${f}.js`)).default;
{
  const m = await loadF('waves/traveling'), p = { A: 0.2, lambda: 2, f: 0.5, dir: 1, xP: 1 };
  // 波形は速さ fλ で進む：y(x, t) = y(x − vΔt, t − Δt)
  const v = p.f * p.lambda;
  ok([0.3, 1.7, 4.2].every(x => near(m.y(p, x + v * 0.8, 1.3), m.y(p, x, 0.5), 1e-12)), '波形は速さ v = fλ で +x 向きに進む');
  ok(near(m.y({ ...p, dir: -1 }, 3 - v * 0.8, 1.3), m.y({ ...p, dir: -1 }, 3, 0.5), 1e-12), 'dir = −1 なら −x 向きに進む');
  const tr = buildTrace(m, p);
  ok(near(measurePeriod(tr, 'yP'), 1 / p.f, 1e-4), '媒質の点 P の振動の周期は 1/f');
  ok(tr.states.every(st => Math.abs(st.yP) <= p.A + 1e-12), '点 P は振幅 A の範囲で上下に動くだけ');
}
{
  const m = await loadF('waves/standing'), p = { L: 1.2, n: 3, v: 4, A: 0.04 };
  ok(near(m.freq(p), 3 * 4 / 2.4, 1e-12) && near(m.lam(p), 0.8, 1e-12), '固有振動数 nv/2L・波長 2L/n');
  const sn = m.snapshot(p, 0.37);
  ok(near(sn.y[0], 0, 1e-12) && near(sn.y[sn.y.length - 1], 0, 1e-9), '両端は節（変位 0）');
  const lam = m.lam(p), fr = m.freq(p), yAt = (x, t) => p.A * Math.sin(2 * Math.PI * (x / lam - fr * t)) + p.A * Math.sin(2 * Math.PI * (x / lam + fr * t));
  ok(m.nodes(p).every(xn => [0.1, 0.5, 0.9].every(t => Math.abs(yAt(xn, t)) < 1e-12)), '節（kL/n）はどの時刻でも動かない');
  ok(near(Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(yAt(lam / 4, i / 200 / fr)))), 2 * p.A, 1e-3), '腹は振幅 2A で振動');
  ok(sn.y.every((y, i) => near(y, sn.y1[i] + sn.y2[i], 1e-12)), '定常波は逆向きの2つの波の和');
}
{
  const m = await loadF('waves/beats'), p = { f1: 10, f2: 11, A: 1 };
  const tr = buildTrace(m, p);
  ok(tr.states.every(st => near(st.y, st.y1 + st.y2, 1e-12) && Math.abs(st.y) <= st.env + 1e-9), '重ね合わせは包絡線 2A|cos π(f₁−f₂)t| の内側');
  ok(near(m.at(p, 1).env, 2, 1e-9) && near(m.at(p, 0.5).env, 0, 1e-9), '1/|f₁−f₂| 秒ごとに大きく、その中間で 0（うなり 1 回/秒）');
}
{
  const m = await loadF('waves/doppler');
  for (const p of [{ f: 2, vs: 100, vo: 0, V: 340 }, { f: 2, vs: 0, vo: -100, V: 340 }, { f: 1.5, vs: -80, vo: 60, V: 340 }, { f: 3, vs: 150, vo: 50, V: 340 }]) {
    const tr = buildTrace(m, p), fm = m.measureTrace(tr).foMeasured, fo = m.measures(p).fo;
    ok(fm != null && near(fm, fo, 2e-3), `波面の届く間隔から測った振動数 ${fm?.toFixed(4)} = f(V−vo)/(V−vs) = ${fo.toFixed(4)}（vs=${p.vs}, vo=${p.vo}）`);
  }
  ok(near(m.measures({ f: 2, vs: 100, vo: 0, V: 340 }).lamFront, 120, 1e-12), '前方の波長 (V − vs)/f');
}
{
  const m = await loadF('waves/interference'), p = { d: 3, lambda: 1.2, f: 0.8, phase: 0 };
  ok(near(m.amp(p, 0, 6), 2, 1e-12), '同位相：垂直二等分線上は強め合う（振幅 2A）');
  ok(near(m.amp({ ...p, phase: 1 }, 0, 6), 0, 1e-12), '逆位相：垂直二等分線上は弱め合う');
  // 振幅の式と、変位の時間変化の最大値が一致する
  const pt = [1.3, 4.1], mx = Math.max(...Array.from({ length: 400 }, (_, i) => Math.abs(m.field(p, pt[0], pt[1], i / 400 / p.f))));
  ok(near(mx, m.amp(p, ...pt), 2e-3), `振幅 |2cos(πΔr/λ)| と変位の最大値が一致（${mx.toFixed(4)}）`);
  ok(m.measures(p).lines === 5 && m.measures({ ...p, d: 2.4 }).lines === 3, '強め合う線の数（d=3, λ=1.2 → 5 本、d=2λ → 3 本）');
}
// ---------------- 光
{
  const m = await loadF('optics/refraction');
  const st = m.profile({ n1: 1, n2: 1.5, theta1: 30 * D }).state;
  ok(near(Math.sin(st.th2 / 180 * Math.PI) * 1.5, 0.5, 1e-12), '屈折の法則 n₁ sinθ₁ = n₂ sinθ₂');
  const g = m.profile({ n1: 1.5, n2: 1, theta1: 45 * D }).state;
  ok(g.total === 1 && near(g.crit, Math.asin(1 / 1.5) * 180 / Math.PI, 1e-12), 'n₁ > n₂ で臨界角（sinθc = n₂/n₁）を超えると全反射');
  ok(m.profile({ n1: 1.5, n2: 1, theta1: 40 * D }).state.total === 0, '臨界角（41.8°）より小さければ屈折する');
}
{
  const m = await loadF('optics/lens');
  for (const [f, a] of [[1, 2.5], [1, 0.6], [-1, 2], [0.5, 1]]) { const b = m.image({ f, a }); ok(near(1 / a + 1 / b, 1 / f, 1e-12), `レンズの式 1/a + 1/b = 1/f（f=${f}, a=${a} → b=${b.toFixed(3)}）`); }
  ok(m.image({ f: 1, a: 2 }) === 2 && m.profile({ f: 1, a: 2, h: 0.5 }).state.h2 === -0.5, '焦点距離の2倍の位置では同じ大きさの倒立の実像');
  ok(m.image({ f: 1, a: 0.5 }) < 0 && m.image({ f: -1, a: 3 }) < 0, '焦点の内側の物体・凹レンズは虚像（b < 0）');
}
{
  const m = await loadF('optics/double-slit'), p = { lambda: 550, d: 0.3, L: 1.5 };
  ok(near(m.spacing(p), 1.5 * 550e-9 / 0.3e-3 * 1e3, 1e-12), '明線の間隔 Lλ/d');
  const dx = m.spacing(p);
  ok(near(m.intensity(p, dx), 1, 1e-9) && near(m.intensity(p, dx / 2), 0, 1e-9) && near(m.intensity(p, 0), 1, 1e-12), '明線は Δx ごと、その中間は暗線');
}
// ---------------- 電磁気
{
  const m = await loadF('electromagnetism/charges'), K = 9.0e9;
  const p = { q1: 2, q2: 0, d: 1 };
  ok(near(m.E(p, 0.5, 0)[0], K * 2e-9 / 1, 1e-12) && near(m.V(p, 0.5, 0), K * 2e-9 / 1, 1e-12), '点電荷 1 つ：E = kq/r²、V = kq/r');
  const q = { q1: 2, q2: -2, d: 1 };
  ok(near(m.V(q, 0, 0.7), 0, 1e-9) && m.E(q, 0, 0)[0] > 0, '等量異符号：垂直二等分線上は電位 0、中点の電場は + から − の向き');
  // 電場は電位の勾配の逆：E_x ≈ −ΔV/Δx
  const h = 1e-5, x0 = 0.83, y0 = 0.31;
  ok(near(-(m.V(q, x0 + h, y0) - m.V(q, x0 - h, y0)) / (2 * h), m.E(q, x0, y0)[0], 1e-5), 'E = −dV/dx（電場は電位が下がる向き）');
}
{
  const m = await loadF('electromagnetism/rc'), p = { E: 6, R: 10, C: 100, mode: 1 };
  const tau = m.tau(p);
  ok(near(tau, 1, 1e-12) && near(m.at(p, tau).q, 600 * (1 - Math.exp(-1)), 1e-12), '時定数 RC、t = τ で最後の電気量の 63%');
  const end = m.at(p, 50 * tau);
  ok(near(end.U, 0.5 * 100e-6 * 36, 1e-9) && near(end.heat, 0.5 * 100e-6 * 36, 1e-9), '充電で、抵抗の熱とコンデンサーのエネルギーは等しい（ともに ½CE²）');
  // 熱の式を数値積分で確かめる
  let h = 0; const n = 20000; for (let i = 0; i < n; i++) { const t = 5 * tau * (i + 0.5) / n, I = m.at(p, t).I * 1e-3; h += I * I * 10e3 * 5 * tau / n; }
  ok(near(h, m.at(p, 5 * tau).heat, 1e-6), '抵抗の熱 ∫I²R dt を数値積分と照合');
  const t1 = 0.37; const st = m.at(p, t1);
  ok(near(st.Vc + st.VR, 6, 1e-12), 'キルヒホッフの第2法則 E = Vc + RI がどの時刻でも成り立つ');
  ok(near(m.at({ ...p, mode: 0 }, tau).q, 600 * Math.exp(-1), 1e-12), '放電は q = CE e^(−t/τ)');
}
{
  const m = await loadF('electromagnetism/lorentz');
  const { MP, E0 } = await import('../js/sim/models/electromagnetism/lorentz.js');
  const p = { A: 1, Z: 1, v: 10, B: 0.5 };
  ok(near(m.radius(p), MP * 1e6 / (E0 * 0.5), 1e-12) && near(m.period(p), 2 * Math.PI * MP / (E0 * 0.5), 1e-12), '半径 mv/(qB)、周期 2πm/(qB)');
  ok(near(m.period({ ...p, v: 3 }), m.period(p), 1e-12) && near(m.radius({ ...p, v: 3 }) / m.radius(p), 0.3, 1e-12), '周期は速さによらず、半径は速さに比例');
  const tr = buildTrace(m, p), r = m.radius(p);
  ok(tr.states.every(st => near(Math.hypot(st.x, st.y + r), r, 1e-9) && near(st.vx * st.x + st.vy * (st.y + r), 0, 1e-6 * r * 1e6)), '円軌道で、速度は半径に垂直');
}
{
  const m = await loadF('electromagnetism/induction'), p = { F: 0.5, v0: 0, B: 1, l: 0.5, R: 2, m: 0.2 };
  ok(near(m.vt(p), 0.5 * 2 / 0.25, 1e-12) && near(m.at(p, 40).v, m.vt(p), 1e-6), '終端速度 FR/(B²l²) に近づく');
  for (const t of [0.3, 1.2, 4]) { const st = m.at(p, t); ok(near(st.W, st.K + st.heat, 1e-9), `エネルギーの収支：F の仕事 = 運動エネルギー + 熱（t=${t}）`); }
  const q = { ...p, F: 0, v0: 3 }, st = m.at(q, 2.5);
  ok(near(st.K + st.heat, 0.5 * 0.2 * 9, 1e-9) && st.v < 3, '引かなければ減速し、運動エネルギーがすべて熱になる');
  // 運動方程式を数値で確かめる
  const h = 1e-6, a = (m.at(p, 1 + h).v - m.at(p, 1 - h).v) / (2 * h), s1 = m.at(p, 1);
  ok(near(p.m * a, p.F - s1.I * p.l * p.B, 1e-6), '運動方程式 m dv/dt = F − IlB');
}
{
  const m = await loadF('electromagnetism/rlc'), p = { V0: 5, f: 0.5, R: 5, L: 1, C: 0.1 };
  const tr = buildTrace(m, p);
  ok(tr.states.every(st => near(st.vR + st.vL + st.vC, st.v, 1e-9)), '各素子の電圧の和 = 電源電圧（どの時刻でも）');
  const f0 = m.measures(p).f0, pr = m.parts({ ...p, f: f0 });
  ok(near(f0, 1 / (2 * Math.PI * Math.sqrt(0.1)), 1e-12) && near(pr.Z, 5, 1e-9) && Math.abs(pr.phi) < 1e-9, '共振周波数で Z = R、電流と電圧は同位相');
  // vL = L di/dt、i = C dvC/dt を数値微分で確かめる
  const h = 1e-6, t = 0.77, di = (m.at(p, t + h).i - m.at(p, t - h).i) / (2 * h), dvc = (m.at(p, t + h).vC - m.at(p, t - h).vC) / (2 * h);
  ok(near(m.at(p, t).vL, 1 * di, 1e-6) && near(m.at(p, t).i, 0.1 * dvc, 1e-6), 'コイル v = L di/dt、コンデンサー i = C dv/dt');
}
// ---------------- 熱
{
  const m = await loadF('thermo/molecules'), { KB } = await import('../js/sim/models/thermo/molecules.js');
  const p = { N: 300, T: 300, L: 5 };
  const tr = buildTrace(m, p, { tMax: 40 * m.duration(p) });
  const end = tr.states[tr.states.length - 1];
  ok(near(end.P, end.Pth, 0.03), `壁の力積から測った圧力 ${end.P.toFixed(4)} Pa ≈ 理論 Nm⟨v²⟩/(3V) ${end.Pth.toFixed(4)} Pa（3% 以内）`);
  const Tg = m.measures(p).Tgas, V = (5e-3) ** 3;
  ok(near(m.Pth(p), p.N * KB * Tg / V, 1e-12), 'PV = NkT（分子の速さから求めた温度で）');
  ok(Math.abs(Tg - 300) < 30, `標本の温度 ${Tg.toFixed(1)} K は 300 K に近い`);
  ok(near(m.Pth({ ...p, T: 600 }) / m.Pth(p), 2, 0.12), '温度を2倍にすると圧力もほぼ2倍');
}
{
  const m = await loadF('thermo/pv'), { R: Rg, P0, V0, GAMMA } = await import('../js/sim/models/thermo/pv.js');
  for (const proc of [0, 1, 2, 3]) {
    const e = m.state({ proc, ratio: 2 }, 1);
    ok(near(e.Q, e.dU + e.W, 1e-12) && near(e.P * e.V, Rg * e.T, 1e-9), `熱力学第1法則と状態方程式（変化 ${proc}）`);
    // 仕事は P-V 図の面積：数値積分と照合
    let w = 0; const n = 4000; for (let i = 0; i < n; i++) { const a = m.state({ proc, ratio: 2 }, i / n), b = m.state({ proc, ratio: 2 }, (i + 1) / n); w += (a.P + b.P) / 2 * (b.V - a.V); }
    ok(near(w, e.W, 1e-6), `仕事 W = P-V 図の面積（変化 ${proc}）`);
  }
  ok(near(m.state({ proc: 0, ratio: 2 }, 1).dU, 0, 1e-12), '等温変化：ΔU = 0、Q = W');
  ok(near(m.state({ proc: 3, ratio: 2 }, 1).Q, 0, 1e-9), '断熱変化：Q = 0');
  const a = m.state({ proc: 3, ratio: 2 }, 1);
  ok(near(a.P * a.V ** GAMMA, P0 * V0 ** GAMMA, 1e-9) && a.T < 300, '断熱膨張：PV^γ 一定で温度が下がる');
  ok(near(m.state({ proc: 1, ratio: 2 }, 1).Q, 2.5 * Rg * 300, 1e-9), '定圧変化：Q = (5/2)nRΔT');
}
// ---------------- 原子
{
  const m = await loadF('atomic/photoelectric'), { H, E } = await import('../js/sim/models/atomic/photoelectric.js');
  const p = { f: 8, W: 2.3, I: 0.6, V: 0 };
  ok(near(m.measures(p).K0, H * 8e14 / E - 2.3, 1e-12), 'K₀ = hf − W');
  ok(m.profile({ ...p, f: 5, I: 1 }).state.emit === 0 && m.current({ ...p, f: 5, I: 1 }, 0) === 0, '限界振動数より小さいと、強い光でも電子は出ない');
  ok(near(m.current(p, -m.measures(p).V0), 0, 1e-12) && m.current(p, -m.measures(p).V0 * 0.5) > 0, '阻止電圧で光電流が 0 になる');
  ok(near(m.current({ ...p, I: 1 }, 1) / m.current({ ...p, I: 0.5 }, 1), 2, 1e-12) && near(m.measures({ ...p, I: 1 }).K0, m.measures({ ...p, I: 0.2 }).K0, 1e-12), '光を強くすると電流は増えるが K₀ は変わらない');
  const prof = m.profile(p);
  const slope = (prof.obs.K[200] - prof.obs.K[180]) / ((prof.obs.f[200] - prof.obs.f[180]) * 1e14);
  ok(near(slope, H / E, 1e-9), 'K₀-f グラフの傾き = プランク定数 h（eV 単位で h/e）');
}
{
  const m = await loadF('atomic/decay'), p = { N0: 1000, T: 3 };
  const N1 = m.at(p, 3).N, N2 = m.at(p, 6).N;
  ok(Math.abs(N1 - 500) < 3 * Math.sqrt(250) && Math.abs(N2 - 250) < 3 * Math.sqrt(1000 * 0.25 * 0.75), `半減期ごとにほぼ半分（${N1}, ${N2}）`);
  ok(m.at(p, 0).N === 1000 && m.at(p, 2).N >= m.at(p, 4).N, '減り続ける（増えない）');
  ok(near(m.at(p, 3).Nth, 500, 1e-12), '期待値 N₀(1/2)^(t/T)');
}

// パラメータ：範囲・刻み・度→ラジアン
{
  const s = sims.find(x => x.id === 'mech.projectile');
  ok(clamp(s, 'theta', 200) === 90 && clamp(s, 'v0', 3.26) === 3.5, '範囲と刻みにそろえる');
  ok(near(toModel(s, merge(s, { theta: 30 })).theta, Math.PI / 6, 1e-12), '度はモデルに渡すときラジアンに');
  ok(near(stateAt(buildTrace((await load('oscillator')), { m: 1, k: 10, A: 0.2 }), 0.5).x, 0.2 * Math.cos(Math.sqrt(10) * 0.5), 1e-3), 'stateAt は記録の間を補間');
}
// 依存の向き：モデルと共通コアは画面（DOM・Canvas）を使わない
for (const dir of ['js/sim/models/mechanics', 'js/sim/models/waves', 'js/sim/models/optics', 'js/sim/models/electromagnetism', 'js/sim/models/thermo', 'js/sim/models/atomic', 'js/sim/core']) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    const src = fs.readFileSync(path.join(root, dir, f), 'utf8').replace(/\/\/.*$/gm, '');
    ok(!/document\.|window\.|getContext|from '\.\.\/(\.\.\/)?(render|ui|plot)\//.test(src) && !/views\//.test(src), `${dir}/${f} は画面に依存しない`);
  }
}

console.log(`sim.test: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
