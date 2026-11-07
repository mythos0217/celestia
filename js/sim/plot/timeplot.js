// シミュレーションのグラフ。データは軌跡（trace）そのもの（アニメーションと同じ計算結果）。
//   横軸が t のグラフ … 全部の段に同じ時刻のカーソル。なぞるとシミュレーションの時刻も動く（onSeek）
//   横軸が t 以外      … P-V 図のように状態の軌跡を描き、いまの状態を点で示す
//   時間によらないシミュレーション（レンズ・干渉縞など）… 分布（obs の配列）を描き、必要なら目印の縦線（mark）
// 1段に複数の量を重ねられる（keys）。例：交流の電圧と電流
import { fitCanvas, colors, fmt } from '../render/draw.js';
import { stateAt } from '../core/trace.js';
export const FILE_VERSION = '0.3.0';

// 目盛り：1・2・5 × 10ⁿ の間隔
export function ticks(lo, hi, n = 4) {
  const span = hi - lo; if (!(span > 0)) return [lo];
  const raw = span / n, e = Math.floor(Math.log10(raw)), b = raw / 10 ** e;
  const step = (b < 1.5 ? 1 : b < 3.5 ? 2 : b < 7.5 ? 5 : 10) * 10 ** e;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9 * step; v += step) out.push(+v.toPrecision(12));
  return out;
}

const PALETTE = (C) => [C.accent, C.force, C.comp, C.cur];

export class TimePlot {
  // series: [{ key | keys: [..], x = 't', label, unit, xLabel, xUnit, mark? }]
  // snapshot(t) → いまの時刻の分布 { 量: 配列 }（波形 y-x のように、時刻ごとに形が変わるグラフ用）
  constructor(host, { series, onSeek = null, height = 92, cursor = true, snapshot = null }) {
    this.host = host; this.series = series; this.onSeek = onSeek; this.cursor = cursor; this.snapshot = snapshot;
    this.pad = { l: 46, r: 12, t: 16, b: 18 };
    host.classList.add('timeplot');
    host.innerHTML = series.map((s, i) => `<div class="tp-row"><canvas data-i="${i}" style="height:${s.height || height}px" role="img" aria-label="${s.label}${(s.x || 't') === 't' ? ' と時間' : ` と ${s.xLabel || s.x}`}のグラフ"></canvas></div>`).join('');
    this.canvases = [...host.querySelectorAll('canvas')];
    this.t = 0; this.trace = null;
    if (onSeek) {
      this.canvases.forEach((c, i) => {
        if ((series[i].x || 't') !== 't') return;
        const seek = (ev) => { if (!this.trace || this.trace.static) return; const r = c.getBoundingClientRect(); const x = (ev.clientX - r.left - this.pad.l) / (r.width - this.pad.l - this.pad.r); onSeek(Math.max(0, Math.min(1, x)) * this.trace.tEnd); };
        c.addEventListener('pointerdown', (ev) => { c.setPointerCapture(ev.pointerId); seek(ev); c.onpointermove = seek; });
        c.addEventListener('pointerup', () => { c.onpointermove = null; });
        c.style.touchAction = 'pan-y';
      });
    }
  }
  setTrace(trace) { this.trace = trace; this.draw(); }
  setTime(t) { this.t = t; this.draw(); }
  draw() {
    if (!this.trace) return;
    const C = colors(), tr = this.trace, P = this.pad, pal = PALETTE(C);
    this.series.forEach((s, i) => {
      const { ctx, W, H } = fitCanvas(this.canvases[i]);
      ctx.clearRect(0, 0, W, H);
      const xKey = s.x || 't', keys = s.keys || [s.key];
      const snap = s.snap && this.snapshot ? this.snapshot(this.t) : null;
      const src = snap || tr.obs;
      const xs = xKey === 't' && !tr.static && !snap ? tr.t : src[xKey];
      const yss = keys.map(k => src[k]);
      if (!xs || yss.some(y => !y)) return;
      let x0 = Math.min(...xs), x1 = Math.max(...xs);
      if (xKey === 't' && !tr.static && !snap) { x0 = 0; x1 = tr.tEnd || 1; }
      if (!(x1 > x0)) { x0 -= 1; x1 += 1; }
      let lo = Math.min(...yss.flat()), hi = Math.max(...yss.flat());
      if (s.yRange) { lo = s.yRange[0]; hi = s.yRange[1]; }   // 形が時刻で変わるグラフは目盛りを固定
      if (s.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      // 保存される量（エネルギー・運動量など）は、数値誤差の小さな揺れを拡大しないよう平らに見せる
      if (hi - lo <= 1e-4 * Math.max(Math.abs(hi), Math.abs(lo)) || hi - lo < 1e-12) { const m = Math.max(Math.abs(hi), Math.abs(lo)) || 1; const c = (hi + lo) / 2; lo = c - 0.5 * m; hi = c + 0.5 * m; }
      const padY = (hi - lo) * 0.1; lo -= padY; hi += padY;
      const X = (x) => P.l + (W - P.l - P.r) * (x - x0) / (x1 - x0), Y = (y) => P.t + (H - P.t - P.b) * (hi - y) / (hi - lo);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.strokeRect(P.l, P.t, W - P.l - P.r, H - P.t - P.b);
      ctx.font = '10px -apple-system, sans-serif'; ctx.fillStyle = C.ink3;
      for (const v of ticks(lo + padY * 0.5, hi - padY * 0.5, 3)) {
        const y = Y(v); ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(W - P.r, y); ctx.strokeStyle = C.line; ctx.stroke();
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(fmt(v), P.l - 4, y);
      }
      for (const v of ticks(x0, x1, Math.max(3, Math.floor((W - P.l - P.r) / 70)))) {
        const x = X(v); ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, H - P.b); ctx.strokeStyle = C.line; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(fmt(v), x, H - P.b + 2);
      }
      if (lo < 0 && hi > 0) { ctx.beginPath(); ctx.moveTo(P.l, Y(0)); ctx.lineTo(W - P.r, Y(0)); ctx.strokeStyle = C.ink3; ctx.stroke(); }
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${xKey === 't' ? 't' : (s.xLabel || xKey)}${s.xUnit || xKey === 't' ? ` [${xKey === 't' ? 's' : s.xUnit}]` : ''}`, W - P.r - 2, H - P.b - 2);
      // 凡例（量の名前）
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '11px -apple-system, sans-serif';
      let lx = P.l + 4;
      keys.forEach((k, j) => {
        const name = keys.length > 1 ? ((s.labels || [])[j] || k) : `${s.label}${s.unit && s.unit !== '1' ? ` [${s.unit}]` : ''}`;
        ctx.fillStyle = keys.length > 1 ? pal[j % pal.length] : C.ink2; ctx.fillText(name, lx, 2); lx += ctx.measureText(name).width + 12;
      });
      const curve = (ys, until, color, width) => {
        ctx.beginPath(); let started = false;
        for (let k = 0; k < xs.length; k++) {
          if (until != null && tr.t[k] > until) break;
          const x = X(xs[k]), y = Y(ys[k]);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
      };
      const timeAxis = xKey === 't' && !tr.static && !snap;
      yss.forEach((ys, j) => {
        const col = keys.length > 1 ? pal[j % pal.length] : C.accent;
        if (tr.static || snap) { curve(ys, null, col, 2); return; }
        curve(ys, null, keys.length > 1 ? col : C.ink3, keys.length > 1 ? 1 : 1);
        if (this.cursor) curve(ys, this.t, col, 2.2);
      });
      if (!this.cursor || snap) return;
      if (timeAxis) {
        const x = X(this.t);
        ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, H - P.b); ctx.strokeStyle = C.accent; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      } else if (!tr.static) {
        const st = stateAt(tr, this.t);
        keys.forEach((k, j) => { ctx.beginPath(); ctx.arc(X(st[xKey]), Y(st[k]), 4.5, 0, 2 * Math.PI); ctx.fillStyle = keys.length > 1 ? pal[j % pal.length] : C.accent; ctx.fill(); });
      } else if (s.mark && tr.states[0][s.mark] != null) {
        const x = X(tr.states[0][s.mark]);
        ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, H - P.b); ctx.strokeStyle = C.force; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      }
    });
  }
}
