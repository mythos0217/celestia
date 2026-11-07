// 再生の制御：再生・一時停止・速度・時刻の移動。描画は onFrame(t) に任せる（物理の計算はしない）
export const FILE_VERSION = '0.3.0';

export class Clock {
  constructor({ tEnd, onFrame, onEnd = () => {} }) {
    this.t = 0; this.tEnd = tEnd; this.speed = 1; this.playing = false;
    this.onFrame = onFrame; this.onEnd = onEnd; this.raf = null; this.last = null;
  }
  play() {
    if (this.playing) return;
    if (this.t >= this.tEnd) this.t = 0;
    this.playing = true; this.last = null;
    const loop = (now) => {
      if (!this.playing) return;
      if (this.last != null) this.t = Math.min(this.tEnd, this.t + (now - this.last) / 1000 * this.speed);
      this.last = now;
      this.onFrame(this.t);
      if (this.t >= this.tEnd) { this.playing = false; this.onEnd(); return; }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  pause() { this.playing = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }
  seek(t) { this.t = Math.max(0, Math.min(this.tEnd, t)); this.onFrame(this.t); }
  reset() { this.pause(); this.seek(0); }
  destroy() { this.pause(); }
}
