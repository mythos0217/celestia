#!/usr/bin/env python3
"""作図仕様（*.fig.json）から SVG を作る。

    python3 tools/figgen.py              content/problems/**/ の *.fig.json をすべて SVG にする
    python3 tools/figgen.py --check      SVG が仕様から作り直したものと同じか確かめるだけ（CI 用）

物理量（力の向き・斜面の角度など）を座標と角度で書くので、図と物理条件の照合（tools/validate_content.py）が
ほぼ自動になる。手描きの SVG を置いてもよい（その場合は data-phys の付け方を docs/figures.md に合わせる）。

仕様の形：
  {"schema": "celestia.figure/1", "size": [幅, 高さ], "items": [ 部品, ... ]}
部品（座標は SVG と同じく右が x、下が y。角度は数学と同じく右が 0°、反時計回りが正）：
  {"t": "line", "from": [x,y], "to": [x,y], "style": "ground|thin|dash|thick", "phys": "surface"}
  {"t": "poly", "points": [[x,y],...], "style": "solid|hatch|none"}
  {"t": "arrow", "from": [x,y], "dir": 度, "len": 長さ, "style": "force|velocity|component|current|thin",
       "phys": "force:N", "label": "N", "labelPos": "end|mid", "labelOffset": [dx,dy]}
  {"t": "block", "at": [x,y], "w": 幅, "h": 高さ, "angle": 度, "label": "m", "phys": "body:block"}
        at = 底辺の中央。angle = 底辺の傾き
  {"t": "ball", "at": [x,y], "r": 半径, "label": "", "phys": "body:ball"}
  {"t": "arc", "at": [x,y], "r": 半径, "from": 度, "to": 度, "label": "θ"}
  {"t": "text", "at": [x,y], "text": "文字", "italic": true, "size": 15, "anchor": "start|middle|end"}
  {"t": "spring", "from": [x,y], "to": [x,y], "coils": 8, "amp": 7}
  {"t": "curve", "f": "parabola", "from": [x,y], "dir": 度, "speed": 画面速さ, "g": 画面重力, "until_y": y, "style": "dash"}
  {"t": "resistor", "from": [x,y], "to": [x,y], "label": "R"}     （水平か垂直の区間に置く）
  {"t": "battery", "from": [x,y], "to": [x,y], "label": "E", "plus": "from|to"}
  {"t": "wire", "points": [[x,y],...]}
  {"t": "dot", "at": [x,y]}
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROBLEMS = ROOT / 'content' / 'problems'

STYLE = {
    'ground': 'stroke="currentColor" stroke-width="2"',
    'thin': 'stroke="currentColor" stroke-width="1.2"',
    'thick': 'stroke="currentColor" stroke-width="2.4"',
    'dash': 'stroke="currentColor" stroke-width="1.2" stroke-dasharray="5 4"',
}
ARROW_CLASS = {'force': 'f-force', 'velocity': 'f-vel', 'component': 'f-comp', 'current': 'f-cur', 'thin': 'f-ink'}


def f(x):
    """座標の書き出し（小数2桁、余分な 0 は付けない）"""
    s = f'{x:.2f}'.rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


def pt(p):
    return f'{f(p[0])},{f(p[1])}'


def unit(deg):
    a = math.radians(deg)
    return math.cos(a), -math.sin(a)   # SVG は y が下向き


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def text(x, y, s, italic=True, size=15, anchor='middle', cls='f-label'):
    st = ' font-style="italic"' if italic else ''
    return (f'<text x="{f(x)}" y="{f(y)}" font-size="{size}" text-anchor="{anchor}" dominant-baseline="middle"'
            f' class="{cls}" fill="currentColor"{st}>{esc(s)}</text>')


def arrow(it):
    x0, y0 = it['from']
    ux, uy = unit(it['dir'])
    L = it['len']
    x1, y1 = x0 + ux * L, y0 + uy * L
    head = min(10, L * 0.35)
    # 矢じり：先端と、軸から ±25° の2点
    bx, by = x1 - ux * head, y1 - uy * head
    px, py = -uy, ux
    w = head * math.tan(math.radians(25))
    h1, h2 = (bx + px * w, by + py * w), (bx - px * w, by - py * w)
    style = it.get('style', 'force')
    dash = ' stroke-dasharray="5 4"' if style == 'component' else ''
    phys = f' data-phys="{esc(it["phys"])}"' if it.get('phys') else ''
    out = [f'<g class="{ARROW_CLASS[style]}"{phys} data-dir="{f(it["dir"])}" data-len="{f(L)}">',
           f'<line x1="{f(x0)}" y1="{f(y0)}" x2="{f(bx)}" y2="{f(by)}" stroke="currentColor" stroke-width="2.2"{dash}/>',
           f'<polygon points="{pt((x1, y1))} {pt(h1)} {pt(h2)}" fill="currentColor"/>']
    if it.get('label'):
        pos = it.get('labelPos', 'end')
        lx, ly = (x1 + ux * 12, y1 + uy * 12) if pos == 'end' else ((x0 + x1) / 2 + px * 12, (y0 + y1) / 2 + py * 12)
        dx, dy = it.get('labelOffset', [0, 0])
        out.append(text(lx + dx, ly + dy, it['label'], italic=it.get('italic', True)))
    out.append('</g>')
    return out


def block(it):
    x, y = it['at']
    w, h, a = it['w'], it['h'], it.get('angle', 0)
    phys = f' data-phys="{esc(it["phys"])}"' if it.get('phys') else ''
    out = [f'<g transform="translate({f(x)},{f(y)}) rotate({f(-a)})"{phys} data-angle="{f(a)}">',
           f'<rect x="{f(-w / 2)}" y="{f(-h)}" width="{f(w)}" height="{f(h)}" class="f-body" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="1.6"/>']
    if it.get('label'):
        out.append(text(0, -h / 2, it['label']))
    out.append('</g>')
    return out


def arc(it):
    x, y = it['at']
    r, a0, a1 = it['r'], it['from'], it['to']
    p0 = (x + unit(a0)[0] * r, y + unit(a0)[1] * r)
    p1 = (x + unit(a1)[0] * r, y + unit(a1)[1] * r)
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 0 if a1 > a0 else 1
    out = [f'<path d="M{pt(p0)} A{f(r)},{f(r)} 0 {large} {sweep} {pt(p1)}" fill="none" stroke="currentColor" stroke-width="1.2"/>']
    if it.get('label'):
        m = (a0 + a1) / 2
        lr = r + it.get('labelGap', 11)
        out.append(text(x + unit(m)[0] * lr, y + unit(m)[1] * lr, it['label']))
    return out


def spring(it):
    (x0, y0), (x1, y1) = it['from'], it['to']
    n, amp = it.get('coils', 8), it.get('amp', 7)
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    px, py = -uy, ux
    lead = min(12, L * 0.12)
    pts = [(x0, y0), (x0 + ux * lead, y0 + uy * lead)]
    seg = (L - 2 * lead) / (2 * n)
    for k in range(2 * n):
        s = lead + seg * (k + 0.5)
        sgn = 1 if k % 2 == 0 else -1
        pts.append((x0 + ux * s + px * amp * sgn, y0 + uy * s + py * amp * sgn))
    pts += [(x1 - ux * lead, y1 - uy * lead), (x1, y1)]
    return [f'<polyline points="{" ".join(pt(p) for p in pts)}" fill="none" stroke="currentColor" stroke-width="1.5" data-phys="spring"/>']


def curve(it):
    x0, y0 = it['from']
    ux, uy = unit(it['dir'])
    vx, vy = ux * it['speed'], uy * it['speed']
    g, ymax = it['g'], it['until_y']
    pts, t = [], 0.0
    while True:
        x, y = x0 + vx * t, y0 + vy * t + 0.5 * g * t * t
        if y > ymax and t > 0:
            # 着地点を正確に（2次方程式）
            tl = (-vy + math.sqrt(vy * vy + 2 * g * (ymax - y0))) / g
            pts.append((x0 + vx * tl, ymax))
            break
        pts.append((x, y))
        t += 0.02
    st = STYLE[it.get('style', 'dash')]
    return [f'<polyline points="{" ".join(pt(p) for p in pts)}" fill="none" {st} data-phys="trajectory"/>']


def side_label(c, px, py, side, gap, label):
    """素子の横にラベルを置く。縦の素子なら左右に寄せて（文字の端をそろえて）重ならないようにする"""
    nx, ny = px * side, py * side
    anchor = 'middle' if abs(nx) < 0.5 else ('start' if nx > 0 else 'end')
    return text(c[0] + nx * gap, c[1] + ny * (gap + 4), label, italic=False, anchor=anchor)


def resistor(it):
    (x0, y0), (x1, y1) = it['from'], it['to']
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    px, py = -uy, ux
    bw, bh = min(46, L * 0.6), 14
    c = ((x0 + x1) / 2, (y0 + y1) / 2)
    a = (c[0] - ux * bw / 2, c[1] - uy * bw / 2)
    b = (c[0] + ux * bw / 2, c[1] + uy * bw / 2)
    corners = [(a[0] + px * bh / 2, a[1] + py * bh / 2), (b[0] + px * bh / 2, b[1] + py * bh / 2),
               (b[0] - px * bh / 2, b[1] - py * bh / 2), (a[0] - px * bh / 2, a[1] - py * bh / 2)]
    out = [f'<g data-phys="resistor:{esc(it.get("label", ""))}">',
           f'<line x1="{f(x0)}" y1="{f(y0)}" x2="{f(a[0])}" y2="{f(a[1])}" stroke="currentColor" stroke-width="1.6"/>',
           f'<line x1="{f(b[0])}" y1="{f(b[1])}" x2="{f(x1)}" y2="{f(y1)}" stroke="currentColor" stroke-width="1.6"/>',
           f'<polygon points="{" ".join(pt(p) for p in corners)}" fill="none" stroke="currentColor" stroke-width="1.6"/>']
    if it.get('label'):
        out.append(side_label(c, px, py, it.get('labelSide', 1), 14, it['label']))
    out.append('</g>')
    return out


def battery(it):
    (x0, y0), (x1, y1) = it['from'], it['to']
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    px, py = -uy, ux
    c = ((x0 + x1) / 2, (y0 + y1) / 2)
    gap = 5
    # 長い線が正極
    plus_first = it.get('plus', 'to') == 'from'
    pA = (c[0] - ux * gap, c[1] - uy * gap)
    pB = (c[0] + ux * gap, c[1] + uy * gap)
    long_p, short_p = (pA, pB) if plus_first else (pB, pA)
    out = [f'<g data-phys="battery:{esc(it.get("label", ""))}">',
           f'<line x1="{f(x0)}" y1="{f(y0)}" x2="{f(pA[0])}" y2="{f(pA[1])}" stroke="currentColor" stroke-width="1.6"/>',
           f'<line x1="{f(pB[0])}" y1="{f(pB[1])}" x2="{f(x1)}" y2="{f(y1)}" stroke="currentColor" stroke-width="1.6"/>',
           f'<line x1="{f(long_p[0] + px * 14)}" y1="{f(long_p[1] + py * 14)}" x2="{f(long_p[0] - px * 14)}" y2="{f(long_p[1] - py * 14)}" stroke="currentColor" stroke-width="1.6"/>',
           f'<line x1="{f(short_p[0] + px * 7)}" y1="{f(short_p[1] + py * 7)}" x2="{f(short_p[0] - px * 7)}" y2="{f(short_p[1] - py * 7)}" stroke="currentColor" stroke-width="3"/>']
    if it.get('label'):
        out.append(side_label(c, px, py, it.get('labelSide', 1), 20, it['label']))
    out.append('</g>')
    return out


def render(spec):
    W, H = spec['size']
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(W)} {f(H)}" width="{f(W)}" height="{f(H)}"'
           f' font-family="\'Times New Roman\', serif">']
    for it in spec['items']:
        t = it['t']
        if t == 'line':
            phys = f' data-phys="{esc(it["phys"])}"' if it.get('phys') else ''
            out.append(f'<line x1="{f(it["from"][0])}" y1="{f(it["from"][1])}" x2="{f(it["to"][0])}" y2="{f(it["to"][1])}" '
                       f'{STYLE[it.get("style", "thin")]}{phys}/>')
        elif t == 'poly':
            st = it.get('style', 'solid')
            fill = 'fill="currentColor" fill-opacity="0.08"' if st == 'hatch' else 'fill="none"'
            phys = f' data-phys="{esc(it["phys"])}"' if it.get('phys') else ''
            out.append(f'<polygon points="{" ".join(pt(p) for p in it["points"])}" {fill} stroke="currentColor" stroke-width="1.6"{phys}/>')
        elif t == 'arrow':
            out += arrow(it)
        elif t == 'block':
            out += block(it)
        elif t == 'ball':
            x, y = it['at']
            phys = f' data-phys="{esc(it["phys"])}"' if it.get('phys') else ''
            out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(it["r"])}" class="f-body" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.4"{phys}/>')
            if it.get('label'):
                out.append(text(x, y - it['r'] - 10, it['label']))
        elif t == 'arc':
            out += arc(it)
        elif t == 'text':
            out.append(text(*it['at'], it['text'], italic=it.get('italic', True), size=it.get('size', 15),
                            anchor=it.get('anchor', 'middle')))
        elif t == 'spring':
            out += spring(it)
        elif t == 'curve':
            out += curve(it)
        elif t == 'resistor':
            out += resistor(it)
        elif t == 'battery':
            out += battery(it)
        elif t == 'wire':
            out.append(f'<polyline points="{" ".join(pt(p) for p in it["points"])}" fill="none" stroke="currentColor" stroke-width="1.6"/>')
        elif t == 'dot':
            out.append(f'<circle cx="{f(it["at"][0])}" cy="{f(it["at"][1])}" r="3" fill="currentColor"/>')
        else:
            raise ValueError(f'知らない部品 {t}')
    out.append('</svg>')
    return '\n'.join(out) + '\n'


def targets():
    return sorted(PROBLEMS.glob('*/*/*.fig.json'))


def main():
    check = '--check' in sys.argv
    stale = []
    for p in targets():
        svg = render(json.loads(p.read_text(encoding='utf-8')))
        out = p.with_name(p.name.replace('.fig.json', '.svg'))
        if check:
            if not out.exists() or out.read_text(encoding='utf-8') != svg:
                stale.append(str(out.relative_to(ROOT)))
        else:
            out.write_text(svg, encoding='utf-8')
    if check:
        print(f'作図仕様 {len(targets())}個、SVG が古いもの {len(stale)}個')
        for s in stale:
            print('  古い →', s, '（python3 tools/figgen.py）')
        sys.exit(1 if stale else 0)
    print(f'{len(targets())}個の SVG を作りました')


if __name__ == '__main__':
    main()
