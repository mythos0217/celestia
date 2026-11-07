// すべての描画器（シミュレーション ID → 描画器）
import { RENDERERS as MECH } from './mechanics.js';
import { WAVES } from './waves.js';
import { OPTICS } from './optics.js';
import { ELM } from './electromagnetism.js';
import { THERMO } from './thermo.js';
import { ATOMIC } from './atomic.js';
export const FILE_VERSION = '0.3.0';
export const RENDERERS = { ...MECH, ...WAVES, ...OPTICS, ...ELM, ...THERMO, ...ATOMIC };
