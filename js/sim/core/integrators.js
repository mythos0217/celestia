// 数値積分。状態はふつうの数の配列。
//   rk4    … 4次のルンゲ＝クッタ（減衰・摩擦のある系、一般の微分方程式）
//   verlet … 速度ベルレ（シンプレクティック）。保存系（振り子・万有引力）で、長時間でもエネルギーがずれていかない
export const FILE_VERSION = '0.3.0';

// deriv(s, t) → ds/dt
export function rk4(deriv, s, t, dt) {
  const k1 = deriv(s, t);
  const k2 = deriv(s.map((v, i) => v + dt / 2 * k1[i]), t + dt / 2);
  const k3 = deriv(s.map((v, i) => v + dt / 2 * k2[i]), t + dt / 2);
  const k4 = deriv(s.map((v, i) => v + dt * k3[i]), t + dt);
  return s.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// 状態 = [位置…, 速度…]（同じ数ずつ）。accel(位置の配列) → 加速度の配列（速度によらない力のとき）
export function verlet(accel, s, t, dt) {
  const n = s.length / 2;
  const x = s.slice(0, n), v = s.slice(n);
  const a0 = accel(x, t);
  const x1 = x.map((xi, i) => xi + v[i] * dt + 0.5 * a0[i] * dt * dt);
  const a1 = accel(x1, t + dt);
  const v1 = v.map((vi, i) => vi + 0.5 * (a0[i] + a1[i]) * dt);
  return [...x1, ...v1];
}

export function step(model, p, s, t, dt) {
  if (model.integrator === 'verlet') return verlet((x, tt) => model.accel(x, p, tt), s, t, dt);
  return rk4((y, tt) => model.deriv(y, p, tt), s, t, dt);
}
