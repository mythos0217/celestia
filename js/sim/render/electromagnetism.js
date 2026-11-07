// 電磁気の描画
import { arrow, line, text, fmt } from './draw.js';
export const FILE_VERSION = '0.3.0';

function battery(ctx, x, y, C, label) { line(ctx, [[x - 12, y - 10], [x - 12, y + 10]], C.ink, { width: 1.6 }); line(ctx, [[x - 4, y - 5], [x - 4, y + 5]], C.ink, { width: 3.5 }); if (label) text(ctx, label, x - 8, y - 16, C.ink2, { align: 'center', font: '11px sans-serif' }); }
function resistor(ctx, x, y, w, C, label) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.strokeRect(x - w / 2, y - 7, w, 14); if (label) text(ctx, label, x, y - 13, C.ink2, { align: 'center', font: '11px sans-serif' }); }

export const ELM = {
  'elm.charges': {
    bounds(p) { const L = 1.5 * p.d; return { xmin: -L, xmax: L, ymin: -0.75 * L, ymax: 0.75 * L }; },
    draw(ctx, V, s, p, tr, C, model) {
      const b = V.b;
      // 電位を色で（正：赤、負：青）
      const nx = 90, ny = Math.round(nx * (b.ymax - b.ymin) / (b.xmax - b.xmin)), img = ctx.createImageData(nx, ny);
      const scale = 9e9 * 1e-9 * Math.max(Math.abs(p.q1), Math.abs(p.q2), 0.1) / (0.5 * p.d);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = b.xmin + (b.xmax - b.xmin) * (i + 0.5) / nx, y = b.ymax - (b.ymax - b.ymin) * (j + 0.5) / ny;
        const v = Math.tanh(model.V(p, x, y) / scale), k = 4 * (j * nx + i);
        img.data[k] = v > 0 ? 255 : Math.round(255 * (1 + v)); img.data[k + 1] = Math.round(255 * (1 - Math.abs(v))); img.data[k + 2] = v < 0 ? 255 : Math.round(255 * (1 - v)); img.data[k + 3] = 70;
      }
      const tmp = document.createElement('canvas'); tmp.width = nx; tmp.height = ny; tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.drawImage(tmp, V.X(b.xmin), V.Y(b.ymax), (b.xmax - b.xmin) * V.s, (b.ymax - b.ymin) * V.s);
      // 電気力線：正の電荷から（無ければ負の電荷へ逆向きに）たどる
      const cs = model.charges(p), src = cs.filter(c => c.q > 0), sign = src.length ? 1 : -1, starts = src.length ? src : cs.filter(c => c.q < 0);
      ctx.save(); ctx.strokeStyle = C.ink2; ctx.lineWidth = 1;
      for (const c of starts) {
        const nLines = Math.max(4, Math.round(16 * Math.abs(c.q) / (Math.max(...cs.map(q => Math.abs(q.q))) || 1)));
        for (let k = 0; k < nLines; k++) {
          let x = c.x + 0.03 * p.d * Math.cos(2 * Math.PI * k / nLines), y = c.y + 0.03 * p.d * Math.sin(2 * Math.PI * k / nLines);
          ctx.beginPath(); ctx.moveTo(V.X(x), V.Y(y));
          for (let it = 0; it < 600; it++) {
            const [ex, ey] = model.E(p, x, y), e = Math.hypot(ex, ey); if (e === 0) break;
            const h = 0.012 * p.d; x += sign * h * ex / e; y += sign * h * ey / e;
            if (x < b.xmin || x > b.xmax || y < b.ymin || y > b.ymax) break;
            if (cs.some(q => Math.hypot(x - q.x, y - q.y) < 0.025 * p.d)) { ctx.lineTo(V.X(x), V.Y(y)); break; }
            ctx.lineTo(V.X(x), V.Y(y));
          }
          ctx.stroke();
        }
      }
      ctx.restore();
      for (const c of cs) {
        ctx.beginPath(); ctx.arc(V.X(c.x), V.Y(c.y), 10, 0, 2 * Math.PI); ctx.fillStyle = c.q > 0 ? '#d7463b' : c.q < 0 ? '#3b6fd7' : C.ink3; ctx.fill();
        text(ctx, c.q > 0 ? '+' : c.q < 0 ? '−' : '0', V.X(c.x), V.Y(c.y) + 1, '#fff', { align: 'center', base: 'middle', font: 'bold 14px sans-serif' });
      }
      text(ctx, '線：電気力線（＋から−へ）　色：電位（赤が高く青が低い）', 10, 18, C.ink2, { font: '11px sans-serif' });
    },
  },
  'elm.rc': {
    bounds() { return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }; },
    draw(ctx, V, s, p, tr, C) {
      const W = V.W, H = V.H, l = W * 0.18, r = W * 0.82, tY = H * 0.28, bY = H * 0.78;
      line(ctx, [[l, bY], [l, tY], [r, tY], [r, bY], [l, bY]], C.ink, { width: 1.6 });
      ctx.fillStyle = C.card;
      if (p.mode >= 0.5) { ctx.fillRect(l - 14, (tY + bY) / 2 - 12, 28, 24); battery(ctx, l + 8, (tY + bY) / 2, C, `E = ${fmt(p.E)} V`); }
      else text(ctx, '（電池を外して放電）', l + 6, (tY + bY) / 2, C.ink3, { font: '11px sans-serif' });
      ctx.fillRect(W / 2 - 30, tY - 8, 60, 16); resistor(ctx, W / 2, tY, 56, C, `R = ${fmt(p.R)} kΩ`);
      // コンデンサー：極板の電荷の量を記号の数で
      const cx = r, cy = (tY + bY) / 2; ctx.fillRect(cx - 18, cy - 8, 36, 16);
      line(ctx, [[cx - 18, cy - 6], [cx + 18, cy - 6]], C.ink, { width: 2.5 }); line(ctx, [[cx - 18, cy + 6], [cx + 18, cy + 6]], C.ink, { width: 2.5 });
      const frac = s.q / Math.max(p.C * p.E, 1e-12), n = Math.round(6 * frac);
      for (let i = 0; i < n; i++) { text(ctx, '+', cx - 15 + i * 6, cy - 12, '#d7463b', { font: 'bold 11px sans-serif' }); text(ctx, '−', cx - 15 + i * 6, cy + 18, '#3b6fd7', { font: 'bold 11px sans-serif' }); }
      text(ctx, `C = ${fmt(p.C)} μF`, cx + 24, cy + 4, C.ink2, { font: '11px sans-serif' });
      const Imax = p.E / p.R, k = Math.abs(s.I) / Math.max(Imax, 1e-12);
      if (k > 0.01) arrow(ctx, W / 2 - 30 * Math.sign(s.I), tY - 22, W / 2 - 30 * Math.sign(s.I) + Math.sign(s.I) * (20 + 50 * k), tY - 22, C.cur, { width: 1.5 + 2.5 * k, label: 'I', font: 'italic 13px serif' });
      text(ctx, p.mode >= 0.5 ? '充電' : '放電', 10, 18, C.ink2, { font: 'bold 12px sans-serif' });
      text(ctx, `τ = RC = ${fmt(p.R * p.C * 1e-3)} s`, 10, 34, C.ink2);
    },
  },
  'elm.lorentz': {
    bounds(p, tr) { const r = Math.max(...tr.obs.y.map(Math.abs)) / 2 || 1; return { xmin: -1.4 * r, xmax: 1.4 * r, ymin: -2.3 * r, ymax: 0.5 * r }; },
    draw(ctx, V, s, p, tr, C) {
      const b = V.b, step = (b.xmax - b.xmin) / 9;
      for (let x = b.xmin + step / 2; x < b.xmax; x += step) for (let y = b.ymin + step / 2; y < b.ymax; y += step) { ctx.beginPath(); ctx.arc(V.X(x), V.Y(y), 2.2, 0, 2 * Math.PI); ctx.fillStyle = C.ink3; ctx.fill(); }
      text(ctx, '・：磁場（裏から表の向き）', 10, 18, C.ink2, { font: '11px sans-serif' });
      line(ctx, tr.states.map(q => [V.X(q.x), V.Y(q.y)]), C.ink3, { width: 1, dash: [4, 4] });
      const X = V.X(s.x), Y = V.Y(s.y), v = Math.hypot(s.vx, s.vy), L = 0.35 * (b.xmax - b.xmin) * V.s / 2;
      arrow(ctx, X, Y, X + s.vx / v * L, Y - s.vy / v * L, C.vel, { label: 'v' });
      // 力は円の中心（0, −r）の向き
      const cy = -Math.max(...tr.obs.y.map(Math.abs)) / 2, dx = 0 - s.x, dy = cy - s.y, d = Math.hypot(dx, dy) || 1;
      arrow(ctx, X, Y, X + dx / d * L * 0.8, Y - dy / d * L * 0.8, C.force, { label: 'qvB' });
      ctx.beginPath(); ctx.arc(X, Y, 7, 0, 2 * Math.PI); ctx.fillStyle = '#d7463b'; ctx.fill();
      text(ctx, '+', X, Y + 1, '#fff', { align: 'center', base: 'middle', font: 'bold 11px sans-serif' });
    },
  },
  'elm.induction': {
    // 棒が遠くまで進むので、画面は棒を追いかける（はじめの 2.5 m より先は、棒が画面の中ほどに来るようにずらす）
    bounds(p) { return { xmin: -0.7, xmax: 3.6, ymin: -0.35 * p.l - 0.3, ymax: 1.35 * p.l + 0.3 }; },
    draw(ctx, V, s, p, tr, C) {
      const b = V.b, off = Math.max(0, s.x - 2.2), X = (x) => V.X(x - off);
      const grid = 0.4;
      for (let x = Math.floor((b.xmin + off) / grid) * grid + grid / 2; x < b.xmax + off; x += grid) for (let y = 0.1; y < p.l; y += 0.25) { ctx.beginPath(); ctx.arc(X(x), V.Y(y), 1.8, 0, 2 * Math.PI); ctx.fillStyle = C.ink3; ctx.fill(); }
      line(ctx, [[X(-0.4), V.Y(0)], [V.X(b.xmax), V.Y(0)]], C.ink, { width: 2 }); line(ctx, [[X(-0.4), V.Y(p.l)], [V.X(b.xmax), V.Y(p.l)]], C.ink, { width: 2 });
      line(ctx, [[X(-0.4), V.Y(0)], [X(-0.4), V.Y(p.l)]], C.ink, { width: 1.6 });
      ctx.fillStyle = C.card; ctx.fillRect(X(-0.4) - 8, V.Y(p.l / 2) - 20, 16, 40); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.strokeRect(X(-0.4) - 7, V.Y(p.l / 2) - 18, 14, 36);
      text(ctx, 'R', X(-0.4) - 16, V.Y(p.l / 2) + 4, C.ink2, { align: 'right' });
      // 距離の目盛り（1 m ごと）：画面がずれても進んだ距離がわかるように
      for (let m = Math.ceil(off); m <= off + b.xmax; m++) text(ctx, `${m} m`, X(m), V.Y(-0.12) + 14, C.ink3, { align: 'center', font: '10px sans-serif' });
      line(ctx, [[X(s.x), V.Y(-0.12)], [X(s.x), V.Y(p.l + 0.12)]], C.accent, { width: 6 });
      const big = Math.max(p.F, s.Fm, 1e-9);
      if (p.F > 0) arrow(ctx, X(s.x), V.Y(p.l / 2), X(s.x) + p.F / big * 60, V.Y(p.l / 2), C.ink, { label: 'F' });
      if (s.Fm > 1e-9) arrow(ctx, X(s.x), V.Y(p.l / 2) + 18, X(s.x) - s.Fm / big * 60, V.Y(p.l / 2) + 18, C.force, { label: 'IlB' });
      if (s.v > 1e-6) arrow(ctx, X(s.x), V.Y(p.l + 0.22), X(s.x) + Math.min(80, 12 + s.v * 12), V.Y(p.l + 0.22), C.vel, { label: 'v' });
      // 回路を流れる電流の向き（棒の中は、右手の法則で決まる向き）
      if (s.I > 1e-6) arrow(ctx, X(s.x) + 10, V.Y(p.l * 0.8), X(s.x) + 10, V.Y(p.l * 0.2), C.cur, { width: 1.6, label: 'I', font: 'italic 12px serif' });
      text(ctx, '・：磁場（裏から表の向き）', 10, 18, C.ink2, { font: '11px sans-serif' });
      text(ctx, `起電力 vBl = ${fmt(s.emf)} V　電流 ${fmt(s.I)} A`, 10, 34, C.ink2);
    },
  },
  'elm.rlc': {
    bounds() { return { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }; },
    draw(ctx, V, s, p, tr, C, model) {
      // 回転するベクトル（フェーザー）：電流の向きを基準に vR・vL・vC と電源電圧 v
      const W = V.W, H = V.H, cx = W * 0.3, cy = H / 2, { XL, XC, I0 } = model.parts(p);
      const vmax = Math.max(p.V0, XL * I0, XC * I0, p.R * I0, 1e-9), k = (Math.min(W, H) * 0.36) / vmax, th = s.ph;
      ctx.beginPath(); ctx.arc(cx, cy, p.V0 * k, 0, 2 * Math.PI); ctx.strokeStyle = C.line; ctx.stroke();
      line(ctx, [[cx - H * 0.45, cy], [cx + H * 0.45, cy]], C.line, { width: 1 });
      const ph = (amp, a, col, lab) => arrow(ctx, cx, cy, cx + amp * k * Math.cos(a), cy - amp * k * Math.sin(a), col, { label: lab, font: '12px sans-serif', width: 2 });
      ph(p.R * I0, th, C.cur, 'V_R'); ph(XL * I0, th + Math.PI / 2, C.comp, 'V_L'); ph(XC * I0, th - Math.PI / 2, C.vel, 'V_C'); ph(p.V0, th + model.parts(p).phi, C.force, 'V');
      text(ctx, '回転ベクトル（縦の成分が瞬間の値）', 10, 18, C.ink2, { font: '11px sans-serif' });
      const m = model.measures(p);
      const x0 = W * 0.62;
      [['Z', `${fmt(m.Z)} Ω`], ['I₀', `${fmt(m.I0)} A`], ['位相の遅れ φ', `${fmt(m.phi)}°`], ['共振周波数 f₀', `${fmt(m.f0)} Hz`]].forEach(([a, b2], i) => { text(ctx, a, x0, 50 + i * 24, C.ink2); text(ctx, b2, W - 12, 50 + i * 24, C.ink, { align: 'right' }); });
      text(ctx, Math.abs(m.phi) < 1 ? '共振：電流が最大' : m.phi > 0 ? 'コイルの性質が強い（電流が遅れる）' : 'コンデンサーの性質が強い（電流が進む）', x0, 50 + 4 * 24 + 6, C.accent, { font: '11px sans-serif' });
    },
  },
};
