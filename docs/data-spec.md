# CELESTIA データ仕様（v0.1）

正規データ `content/`（マスター）→ `tools/build_data.py` → アプリ用データ `data/`。アプリが読むのは `data/` だけ。
JSON Schema は `tools/schema/`、Schema で見られない関係の検査は `tools/validate_content.py`。

## ID の規則

| ID | 形 | 規則 |
| --- | --- | --- |
| 問題ID | `MEC-INC-001` | `<分野3字>-<単元略号3字>-<番号>`。一度使ったら変えない・再利用しない。分野を移しても ID はそのまま（フォルダだけ移す） |
| 分野ID | `MEC` `THM` `WAV` `ELM` `ATM` `SYN` | 力学・熱力学・波動・電磁気・原子・分野横断 |
| 単元ID | `MEC-02` | `taxonomy.json` で固定。使わなくなったら `retired` に残し、再利用しない |
| 概念ID・法則ID | `normal-force` `newton-2nd` | 英小文字とハイフン |
| 誤概念ID | `MC-NORMAL-EQ-MG` | `MC-` で始まる英大文字 |
| シミュレーションID | `mech.projectile` | `<分野>.<名前>` |
| 図ID | `q-setup` `a-forces` | 問題の中で一意。英小文字とハイフン |

## 問題（`content/problems/<分野>/<問題ID>/problem.json`、`celestia.problem/1`）

| 項目 | 必須 | 内容 |
| --- | --- | --- |
| `id` `schema` `field` `unit` | ○ | 問題ID、`"celestia.problem/1"`、分野ID、単元ID |
| `topic` `course` `minutes` | | テーマ、`物理基礎`／`物理`、想定時間（分） |
| `level` | ○ | 0=基礎 1=標準 2=入試基礎 3=国公立2次 4=難関 5=最難関 |
| `format` | ○ | `choice` `numeric` `calc` `written` `derivation` `graph-read` `figure-read` `construct` `experiment` `concept` `synthesis`（複数可） |
| `examStyle` | | `common-test` `national-2nd` `private` `original` |
| `statement.blocks` | ○ | 本文（下の「ブロック」） |
| `figures` | ○ | 図の一覧（下の「図」）。無ければ `[]` |
| `answer.parts` | ○ | 小問ごとの答え `{id, tex, grading?, wrong?}`。小問が無い問題は `id: "main"` 1つ |
| `solutions` | ○ | `{id: "main"|"alt1"|"note", kind, blocks}`。別解・補足を足せる |
| `idea` | | 核となる考え方 `{tex}` |
| `simulation` | | `{id, preset, locked, show}`。`show` は `before`／`after-attempt`／`solution` |
| `predict` | | 予測 → 実験 → 説明 `{prompt, choices[{id, tex, misconception?}], answer, experiment{sim, vary, measure}, explain{laws, tex}}` |
| `choices` | | 選択問題の選択肢。誤答の選択肢に `misconception` を付けると、選んだときに誤概念として記録できる（Phase 5） |
| `concepts` `laws` `misconceptions` | ○ | 概念・法則・誤概念の ID（無ければ `[]`） |
| `tags` `provenance` `quality` | ○ | `quality.status` は `draft`／`review`／`published`／`hidden`。アプリに出るのは `published` だけ |

### ブロック

```json
{"type": "text", "tex": "文章（LaTeX。$...$ が数式）"}
{"type": "figure", "ref": "図ID", "placement": "block | float-right | side-by-side"}
{"type": "parts", "items": [{"id": "1", "tex": "…", "figures": ["図ID"]}]}
{"type": "simulation", "caption": "…"}
```

並びがそのまま表示順。図の位置も、ブロックの位置で決まる（`order` を手で管理しない）。

### 入力用の答え（`answer.parts[].grading`）

Lemma の書式（`js/answer.js` の先頭）に、次の2つを足した：

- 添字：`v_0`、`v_{max}`、`m_A`。文字の直後の数字も添字とみなす（`v0` = `v_0`）
- 単位：末尾の `[ ]`。`6 [Ω]`、`v_0 cos(θ) [m/s]`（今は表示用。単位表は `tools/validate_content.py` の `UNITS`）

証明・説明など自動で採点しない小問は `grading` を書かない（自己採点になる）。

## 図

```json
{"id": "a-forces", "role": "answer", "kind": "vector", "format": "svg", "src": "a-forces.svg",
 "alt": "物体にはたらく重力・垂直抗力・静止摩擦力", "caption": "…",
 "physics": {"angle_deg": 30, "equilibrium": true,
   "forces": [{"name": "mg", "dir_deg": 270}],
   "decompositions": [{"of": "force:mg", "into": ["component:mg-parallel", "component:mg-normal"]}]}}
```

| 項目 | 内容 |
| --- | --- |
| `role` | `question`（問題用）／`answer`（解答用）／`both`。**解答用の図は問題文から参照できない**（検査でエラー）。アプリは答え合わせまで表示もファイルの読み込みもしない |
| `kind` | `diagram` `vector` `circuit` `ray` `waveform` `apparatus` `state` `graph` `photo` `sim-initial` |
| `format` | `svg`（標準）、`png`／`webp`（写真）、`plot-json`（データから描くグラフ）、`sim-plot`／`sim-snapshot`（シミュレーションから描く。Phase 4） |
| `src` | 問題フォルダ内のファイル名。Base64 の埋め込みは不可 |
| `alt` | 代替テキスト（必須。図が見えない人が問題を解けるように） |
| `physics` | この図が表す物理条件。`validate_content.py` が SVG の実際の形と照合する |

### 図と物理条件の照合（`physics`）

| 宣言 | 照合すること |
| --- | --- |
| `angle_deg` | `data-phys="surface"` の線の傾き（±2°） |
| `forces` `vectors` | `data-phys="force:N"` などの矢印の向き（±2°） |
| `equilibrium: true` | `force:` の矢印の和が 0（最大の力の 4% 以内） |
| `decompositions` | 成分の矢印の和が元の矢印に一致 |
| `equalLength` | 同じ大きさのはずの矢印の長さがそろう |
| `junctions` | 分岐点で電流の和が保存される |

見た目が正しくても物理的に誤った図（AI が作った図に多い）を止めるための仕組み。自動の照合に通っても `quality.checks.figures` は `"auto"` 止まりで、人が確認したら `"human"`。

### 作図仕様（`*.fig.json`、`celestia.figure/1`）

`tools/figgen.py` が SVG を作る。部品：`line` `poly` `arrow` `block` `ball` `arc` `text` `spring` `curve`（放物線）`resistor` `battery` `wire` `dot`。
座標は SVG と同じ（右が x、下が y）、角度は数学と同じ（右 0°、反時計回り正）。詳しくは `tools/figgen.py` の先頭。
`node tests/run.mjs` は、SVG が仕様から作り直したものと同じか（作り忘れ）も確かめる。

### 手描き・AI 生成の SVG の決まり

- `viewBox` を付ける。`script`・`foreignObject`・`on*` 属性・外部参照・埋め込み画像は使わない（検査でエラー）
- 色は `currentColor`（明暗の設定に合わせて変わる）。力・速度・成分・電流は `<g class="f-force|f-vel|f-comp|f-cur">`
- 照合したい矢印は `<g data-phys="force:N">` の中に、軸の `<line>` と、先端を最初の点にした `<polygon>` を置く
- 面は `<line data-phys="surface">`

## 概念・法則・誤概念・シミュレーション

| ファイル | 1件の形 |
| --- | --- |
| `concepts.json` | `{id, name, field, requires: [前提の概念], laws: [法則]}`（前提関係の循環は検査でエラー） |
| `laws.json` | `{id, name, tex, conditions: 適用条件, concepts}` |
| `misconceptions.json` | `{id, wrong: 誤った考え, right: 正しい考え, concepts, remedy: [補強問題の ID]}` |
| `simulations.json` | `{id, name, field, model: "mechanics/projectile", status: planned|ready, params{名前: {label, unit, min, max, step, default}}, observables, measures?, plots: [[x, y]]}` |

## アプリ用データ（`data/`、`celestia.data/1`）

| ファイル | 中身 |
| --- | --- |
| `index.json` | `format` `dataVersion` `levels` `subjects`（分野の並び）`fields`（単元）`problems`（一覧：`id f lv t th tg fm c m sim pr in ok`） |
| `f-<単元ID>.json` | 本文：`q a s k`（HTML）、`figs`（図の情報）、`in`（入力用の答え）、`sim` `predict` `choices` `laws` `alt`（別解） |
| `knowledge.json` | 概念・法則・誤概念・シミュレーション登録簿 |
| `search.json` `collections.json` | 検索の索引（概念名・法則名も入る）、問題セット |
| `assets/<問題ID>/` | 図のファイル。名前に中身のハッシュ（`q-setup-35755270.svg`）が付くので、図を直すとキャッシュも入れ替わる |

本文の HTML では、図は `<figure class="pfig" data-fig="図ID"></figure>` の空の枠で、`js/problem/figures.js` が中身を入れる。

## 版は3つを分ける（Lemma と同じ）

| 版 | 場所 | いつ上げるか |
| --- | --- | --- |
| コードの版 | 各 JS の `FILE_VERSION`、CSS の `--celestia-version`、`sw.js` の `VERSION` | アプリを更新したとき（食い違うと赤い警告） |
| データ形式の版 | `index.json` の `format` | `data/` の項目の意味を変えたとき |
| 学習記録の版 | localStorage `celestia.v1` の `schema`（今は 1） | 学習記録の形を変えたとき |
