# CELESTIA（高校物理版 Lemma）— 設計

> 2026-11-07 決定：新リポジトリ「CELESTIA」で作る／正規データは `content/` の JSON／Supabase は既存プロジェクト lemma に表 `celestia_state` を追加。
> 実装後の名前：保存キー `celestia.v1`・`celestia.auth`、キャッシュ接頭辞 `celestia-`。Phase 2・3 は実装済み（README 参照）。

## Phase 1 調査・設計報告

対象：`mythos0217/lemma-math` @ `53aa6a4`（v0.9.0）。調査時点で `node tests/run.mjs` は 9 項目すべて ✓。

---

## 0. 結論（先に）

1. **lemma-math は改修せず、新しいリポジトリに分岐させる。** 指示書は「別のアプリ」を求めており、Lemma は弟さんが使っている運用中のアプリ。数学版を壊すリスクをゼロにできる。共通部分（同期・復習・採点・PWA）は当面コピーで持ち、安定したら共通化を検討する。
2. **物理版の正規データは `content/` の JSON を正（マスター）にし、問題と図を同じフォルダに置く。** Lemma の「Excel がマスター」は文章だけなら優秀だが、1問に複数の図・図の役割・表示位置・物理条件を持たせると Excel では管理しきれない。Excel は「文章を一括で書く入口」として任意で残す。
3. **図は「問題用」「解答用」を役割（`role`）で分け、本文中の位置はブロック列で指定する。** 解答用の図は答え合わせまで DOM にもネットワークにも出さない。グラフ図はシミュレーションの物理モデルから生成し、「図と物理が食い違う」問題を構造的に潰す。
4. **シミュレーションは「共通の再生・時間・パラメータ・グラフ」＋「分野別の物理モデル」＋「分野別の描画」の3層。** Plotly は入れず、軽い自前の時系列グラフ（Canvas）にする。
5. **Supabase は既存プロジェクト「lemma」に物理版用の表（`celestia_state`）を1つ追加。** アカウントは数学版と共通、記録は別の行。

> 既存アプリにすでにある不具合（物理版に限らず直すべきもの）を §8 に挙げた。特に **Lemma とぶつりばが同じドメインで互いのオフライン用キャッシュを消し合っている**。

---

## 1. 現状のアーキテクチャ（Lemma v0.9.0）

```
index.html  ── 下のタブ：今日 / グラフ / 計算 / 定着度 / 設定（ハッシュルーティング）
js/
  app.js       1,676行  画面すべて（今日・演習・問題・解答入力・グラフページ・定着度・設定）と状態保存
  catalog.js     212行  data/index.json と分野別本文の遅延読み込み、出題プール・復習の選び方
  scheduler.js   165行  FSRS を簡略化した間隔反復（問題ごと pstat、解法カードごと cards）
  answer.js      438行  「入力用の答え」書式（lemma-input/1）の読み取りと採点
  parser.js      388行  数式パーサ（乱数代入による同値判定）— answer.js と graph.js が使う
  graph.js       538行  2D グラフ電卓（陽・陰関数、不等式、媒介変数、スライダー、手描き予想）
  graph3d.js     368行  3D グラフ
  drill.js       334行  計算トレーニング（その場で問題生成、自己ベスト）
  content.js     488行  内蔵問題 61問と解法カード（JS に直書き）
  sync.js        212行  Supabase 同期（メールOTP、1人1行、mergeState で端末間マージ、版番号で競合回避）
  ui.js          143行  アイコン・効果音・テーマ・マスコット「ルート」
content/      正規データ（LaTeX のまま。taxonomy / tags / methods / collections / problems/<分野>.json）
data/         アプリ用（index.json＝一覧、f-<分野>.json＝本文、search.json、collections.json）
tools/        Excel → content → data の変換、JSON Schema、監査、KaTeX 検査、SymPy 照合
tests/        run.mjs（9項目）、採点・catalog・同期の単体テスト、Playwright の e2e
sw.js         コード用キャッシュとデータ用キャッシュ（dataVersion で入れ替え）
supabase/     schema.sql（lemma_state 表、RLS、退会関数）
```

**データの流れ**：`Lemma問題管理表.xlsx`（非公開）→ `tools/xlsx_to_content.py` → `content/` → `tools/build_app_data.py` → `data/`。アプリは `data/` だけを読む。ID 台帳 `tests/golden/ids.txt` で問題の消失を検出。

**優れていて、そのまま持っていくべき点**

- 正規データとアプリ用データの2段構成、`dataVersion` による整合チェックとキャッシュ入れ替え
- ID を変えない・再利用しない規則と、それを CI で守る仕組み
- 3つの版（コード・データ形式・学習記録）を分けて管理する決まり
- 同期のマージ規則（記録は和、復習状態は新しい方、設定は最後に変えた方）とそのテスト
- 入力採点の乱数代入による同値判定、「判定がおかしい？」の報告経路
- 自信度 → 結果のズレの記録（物理の「予測 → 実験」とそのまま相性が良い）

**物理版で足りない点**

- 問題データに図を持つ場所がない（`assets` は内蔵問題のグラフ式だけ。解答側には図の概念がない）
- 本文は「問題文1本・解説1本」の文字列で、図を途中に差し込めない
- 分類が「分野 → 単元」の木だけ。概念・法則・誤概念の網目がない
- 採点に単位・有効数字・許容誤差がない
- グラフ機能は「式を描く」もので、時間発展する現象を扱えない
- app.js が 1,676 行に全画面を抱えている

---

## 2. 再利用・変更・削除の仕分け

| ファイル | 扱い | 内容 |
| --- | --- | --- |
| `js/sync.js` | **再利用（小改修）** | 表名・保存キーを物理版用に。`mergeState` に予測記録・誤概念記録のマージを追加、計算トレーニングの自己ベストを削除 |
| `supabase/schema.sql` | **再利用（追加）** | 同じプロジェクトに `celestia_state` 表を追加（RLS は同じ形）。退会関数は共通のまま |
| `js/scheduler.js` | **再利用** | 問題単位の復習はそのまま。解法カード（`cards`）は廃止し、代わりに概念単位の定着度を問題結果から集計 |
| `js/catalog.js` | **再利用（改修）** | 分野＝力学など。`LEVELS`・`SUBJECT_ORDER` を物理用に。概念・法則・誤概念・シミュレーション一覧の読み込みを追加 |
| `js/answer.js` + `js/parser.js` | **再利用（拡張）** | 単位・許容誤差・有効数字・選択肢→誤概念の対応を追加（§4-6） |
| `js/ui.js` | 再利用 | マスコットは別の生き物に差し替え（数学版の鳥と分ける） |
| `sw.js` | 再利用（**修正必須**） | キャッシュ名の接頭辞を物理版専用にし、他アプリのキャッシュを消さないようにする（§8-1） |
| `tools/*`、`tests/run.mjs` | 再利用（改修） | 変換・監査・Schema 検査の骨格はそのまま。図・概念・シミュレーションの検査を追加 |
| `js/drill.js` | **削除** | 「計算」タブごと。計算問題は通常の問題形式 `format: "calc"` として残る |
| `js/graph.js` | **縮小して転用** | グラフ電卓タブは削除。ただし「手描きで予想してから本物と重ねる」機能は v-t グラフの予想・作図問題に転用価値が高いので、手描き部分だけ残す |
| `js/graph3d.js` | 削除 | 高校物理で必要な場面がない |
| `js/content.js` | 削除 | 数学の内蔵問題・解法カード。物理版では内蔵問題も `content/` のデータとして持ち、JS に直書きしない |
| `js/app.js` | **分割して改修** | 画面ごとにモジュールへ分ける（§5）。保存キー・状態の形を物理用に |
| `index.html` | 改修 | タブ：今日 / シミュレーション / 概念 / 定着度 / 設定 |
| `content/`・`data/` の数学データ | 持ち込まない | 新リポジトリは空のデータから |

---

## 3. 新しいアーキテクチャ

```
<新リポジトリ>/
  index.html  sw.js  manifest.webmanifest  privacy.html
  css/
  js/
    app.js                 起動・ルーティング・状態保存だけ
    views/                 画面ごと：today / practice / problem / sim / concepts / review / map / settings
    problem/
      blocks.js            本文ブロック（文章・図・小問・シミュレーション埋め込み）の描画
      figures.js           図の描画（SVG/画像/プロットJSON/シミュレーション初期状態）と解答図の遅延読み込み
    grade/                 answer.js・parser.js（拡張）・units.js（単位と次元）
    sim/
      core/                clock.js（再生・速度・巻き戻し）、params.js（パラメータ定義と検証）、
                           trace.js（時系列の記録）、integrators.js（解析解・RK4・速度Verlet）、
                           events.js（着地・衝突などの時刻検出）
      plot/timeplot.js     同じ時間軸に連動する x-t、v-t … のグラフ（Canvas、軽量・自前）
      ui/player.js         再生バー・スライダー・測定値表示（全シミュレーション共通）
      models/mechanics/    projectile.js  incline.js  oscillator.js  pendulum.js  collision.js  circular.js  gravitation.js
      render/mechanics/    各モデルの Canvas 描画（モデルの状態を読むだけ。物理計算をしない）
      registry.js          シミュレーションID → { model, renderer, 既定グラフ }
    catalog.js  scheduler.js  sync.js  ui.js  config.js
  content/                 正規データ（マスター）
  data/                    アプリ用（生成物）
  tools/  tests/  supabase/  docs/
  .github/workflows/test.yml
```

**依存の向き**（逆向きの import を禁止し、テストで検査する）

```
物理モデル (sim/models) ← 共通コア (sim/core) ← 描画・グラフ・UI ← 画面 (views)
                                          ↑
問題データ ── simulationId と preset で参照するだけ（モデルのコードは問題を知らない）
```

物理モデルは DOM・Canvas に触れず Node だけでテストできる。これで「アニメーションとグラフが同じモデルから出る」ことが構造上保証される。

---

## 4. データスキーマ案

### 4-1. 正規データの置き方：問題と図を同じフォルダに

```
content/
  taxonomy.json          分野・単元（ID 固定。Lemma と同じ規則）
  concepts.json          概念（前提関係つき）
  laws.json              法則（式・適用条件・関連概念）
  misconceptions.json    誤概念（誤った考え・正しい考え・関連概念）
  simulations.json       シミュレーションの登録簿（ID・パラメータ定義・出せるグラフ）
  tags.json  collections/*.json
  problems/
    MEC/
      MEC-PRJ-001/
        problem.json
        q-setup.svg          問題図
        a-decompose.svg      解答図
      MEC-INC-001/ …
    WAV/ …
```

1問1フォルダにする理由：図の参照切れ・孤立した図を機械的に検出でき、git の差分も1問単位で読める。数万問規模でも1ファイルあたりが小さい。`data/` を作るときに分野ごとの本文ファイルへまとめ、図は `data/assets/<問題ID>/` へコピーする（ファイル名に内容ハッシュを付けてキャッシュを安全にする）。

### 4-2. 問題（`physics.problem/1`）

```json
{
  "id": "MEC-INC-001",
  "schema": "physics.problem/1",
  "field": "MEC",
  "unit": "MEC-02",
  "topic": "あらい斜面",
  "course": "物理基礎",
  "level": 2,
  "minutes": 12,
  "format": ["numeric", "derivation"],
  "examStyle": "national-2nd",

  "statement": {
    "blocks": [
      { "type": "text", "tex": "傾き $\\theta$ のあらい斜面上に質量 $m$ の物体を置き、…" },
      { "type": "figure", "ref": "q-setup", "placement": "float-right" },
      { "type": "parts", "items": [
        { "id": "1", "tex": "物体が斜面から受ける垂直抗力の大きさ $N$ を求めよ。" },
        { "id": "2", "tex": "物体が滑り出さない条件を $\\mu$ と $\\theta$ で表せ。" }
      ]}
    ]
  },

  "figures": [
    { "id": "q-setup", "role": "question", "kind": "diagram", "format": "svg",
      "src": "q-setup.svg", "alt": "傾き θ の斜面上に置かれた質量 m の物体",
      "caption": "", "physics": { "angle_deg": 30, "objects": ["block"], "forces": [] } },
    { "id": "a-decompose", "role": "answer", "kind": "vector", "format": "svg",
      "src": "a-decompose.svg", "alt": "重力を斜面に平行な成分と垂直な成分に分解した図",
      "caption": "重力を斜面方向と垂直方向に分解する",
      "physics": { "angle_deg": 30, "forces": [
        { "name": "mg", "dir_deg": 270 }, { "name": "N", "dir_deg": 120 }, { "name": "f", "dir_deg": 30 } ] } },
    { "id": "a-vt", "role": "answer", "kind": "graph", "format": "sim-plot",
      "sim": { "id": "mech.incline", "preset": { "theta": 30, "mu": 0.2 } },
      "plot": { "x": "t", "y": ["v"] }, "alt": "滑り出したあとの v-t グラフ（直線）" }
  ],

  "answer": {
    "parts": [
      { "id": "1", "tex": "$N=mg\\cos\\theta$", "grading": "N：m g cos(θ)" },
      { "id": "2", "tex": "$\\mu \\ge \\tan\\theta$", "grading": "条件：μ>=tan(θ)" }
    ]
  },
  "solutions": [
    { "id": "main", "kind": "main", "blocks": [
      { "type": "text", "tex": "重力を斜面に平行・垂直に分解する。" },
      { "type": "figure", "ref": "a-decompose" },
      { "type": "text", "tex": "垂直方向のつり合いより $N=mg\\cos\\theta$。…" }
    ]}
  ],

  "simulation": { "id": "mech.incline", "preset": { "theta": 30, "mu": 0.2, "m": 1 },
                  "locked": ["g"], "show": "after-attempt" },
  "predict": null,

  "concepts": ["force-decomposition", "normal-force", "static-friction"],
  "laws": ["newton-2nd", "friction-law"],
  "misconceptions": ["MC-NORMAL-EQ-MG"],
  "choices": null,

  "tags": ["斜面", "摩擦"],
  "provenance": { "created": "2026-11-06" },
  "quality": { "status": "draft",
    "checks": { "schema": true, "units": true, "figures": "auto", "physics": false, "human": false } }
}
```

**指示書の案から変えた点と理由**

| 変更 | 理由 |
| --- | --- |
| 図を `question.figures` / `answer.figures` に分けず、`figures[]` に `role` を付けて1か所に | 同じ図を問題と解説の両方で使う場合（`role: "both"`）を自然に書ける。漏れ検査が「問題側ブロックが `role=answer` の図を参照していないか」の1規則で済む |
| 本文を文字列ではなく `blocks[]` に | 図を文章の途中・小問の間に置ける。`order` を手で管理しなくてよい（並び＝ブロックの順） |
| 答えを小問ごと（`answer.parts`）に | 小問ごとに採点・解答図を対応させられる |
| `explanation` を `solutions[]` に | Lemma と同じく別解（`alt1`…）・補足（`note`）を持てる |
| `graphConfig` を図の `format: "sim-plot"` に統合 | グラフは図の一種。シミュレーションのモデルから描くので、問題条件と食い違わない |
| `quality.checks.figures/physics` を追加 | 「見た目は正しいが物理的に誤り」の確認状況を問題ごとに残す |

**ID**：`<分野>-<単元略号>-<3桁>`（例 `MEC-PRJ-001`）。Lemma と同じく、一度使ったら変えない・分野を移しても変えない。分野：`MEC` 力学、`THM` 熱、`WAV` 波動、`ELM` 電磁気、`ATM` 原子。

**難易度**：0 基礎 / 1 標準 / 2 入試基礎 / 3 国公立2次 / 4 難関 / 5 最難関（Lemma と同じ6段階の考え方）。共通テスト型かどうかは難易度ではなく `examStyle`（`common-test` / `national-2nd` / `private` / `original`）で持つ。

**問題形式 `format`**（複数可）：`choice` 選択、`numeric` 数値、`calc` 計算、`written` 記述、`derivation` 導出、`graph-read` グラフ読解、`figure-read` 図の読み取り、`construct` 作図、`experiment` 実験考察、`concept` 概念、`synthesis` 総合。

### 4-3. 図

| `format` | 用途 | 保存 |
| --- | --- | --- |
| `svg` | 模式図・力の図・回路図・光路図・波形図・装置図（**標準**） | ファイル。`<script>`・外部参照・イベント属性は禁止（検査で弾く）。色は `currentColor`／CSS 変数でダーク表示に追従 |
| `png` / `webp` | 写真・実験画像 | ファイル。長辺 1600px 以下、WebP 優先 |
| `plot-json` | 実測データ・表から描くグラフ | JSON ファイル（系列・軸・単位） |
| `sim-plot` | 物理モデルから描くグラフ | ファイル不要。`sim.id` + `preset` から生成 |
| `sim-snapshot` | シミュレーションの初期状態 | ファイル不要。描画器で静止画として描く |

- Base64 埋め込みは Schema で禁止（`src` はフォルダ内の相対パスのみ）。
- 解答図の非表示は2段で守る：(1) 問題側ブロックから解答図を参照すると検査が失敗、(2) アプリは答え合わせを押すまで解答図の `<img>` を作らない（先読みもしない）。なお静的サイトなので、データファイルを直接開けば見える点は Lemma の解答文と同じ。
- 将来の操作可能な図（矢印を置く作図問題・回路組み立て）に備え、SVG 内の要素に `data-phys="force:N"` のような意味ラベルを付ける規約にしておく。作図問題の採点はこのラベルと `physics` の宣言を比べる。

**図と物理の整合（AI 生成の図への対策）**：図の `physics` 欄に「この図が主張する物理条件」を宣言させ、検査で問題文・パラメータと突き合わせる。

- 角度・向き：SVG の `data-phys` 付き矢印の実際の向きを計算し、宣言 `dir_deg` と比較（±3°）
- 力の図：宣言した力の和が、状況（静止なら 0、運動なら $ma$ の向き）と矛盾しないか
- 斜面の角度が問題文の値と一致するか
- 合格しても `figures: "auto"` 止まり。人が見て初めて `human: true`。AI 生成の図は `human` が付くまで公開しない（`status: draft`）

できる限り、図は手描き SVG ではなく **小さな作図仕様（JSON）から生成**する方針を推奨：斜面・物体・ばね・矢印・回路素子などの部品を座標と角度で並べ、`tools/figgen` が SVG を出す。物理量が仕様に入っているので、整合検査がほぼ自動になる。

### 4-4. 概念・法則・誤概念

```json
// concepts.json
{ "id": "normal-force", "name": "垂直抗力", "field": "MEC",
  "requires": ["force-concept", "action-reaction"], "laws": ["newton-3rd"] }

// laws.json
{ "id": "newton-2nd", "name": "運動方程式", "tex": "m\\vec a=\\vec F",
  "conditions": "慣性系。質量が一定", "concepts": ["inertia", "net-force"] }

// misconceptions.json
{ "id": "MC-NORMAL-EQ-MG", "wrong": "垂直抗力はいつも mg に等しい",
  "right": "垂直抗力は面に垂直な方向の力のつり合い（または運動方程式）で決まる",
  "concepts": ["normal-force"], "remedy": ["MEC-INC-003", "MEC-CON-012"] }
```

- 単元の木（taxonomy）とは別に、概念の前提関係（`requires`）で網目を持つ。1問は複数の概念・法則にぶら下がる。
- **誤概念の診断**：選択問題では選択肢ごとに誤概念を対応させる（`choices: [{id:"b", tex:"…", misconception:"MC-NORMAL-EQ-MG"}]`）。その選択肢を選ぶと学習記録に誤概念が記録され、`remedy` の概念問題へ誘導する。数値問題でも「典型的な誤答値 → 誤概念」を登録できる（例：$N=mg$ と答えた）。

### 4-5. 予測 → 実験 → 説明

```json
"predict": {
  "prompt": "質量を2倍にすると、ばね振り子の周期はどうなる？",
  "choices": ["1/2倍", "1/√2倍", "変わらない", "√2倍", "2倍"],
  "answer": 3,
  "experiment": { "sim": "mech.spring", "change": { "m": [1, 2] }, "measure": "period" },
  "explain": { "laws": ["shm-period"], "tex": "$T=2\\pi\\sqrt{m/k}$ より $\\sqrt2$ 倍" }
}
```

流れ：予測を選ぶ（確信度も）→ シミュレーションで条件を変え、周期を測る（測定値はモデルから計算）→ 予測と結果を並べて表示 → 法則で説明。学習記録に `predictions[]` として残し、Lemma の「自信度と結果のズレ」と同じ画面で集計する。

### 4-6. 採点の拡張（`lemma-input/1` を上位互換で拡張）

```
(1) v：4.9 [m/s] ±2%          ← 単位つき・相対許容誤差
(2) T：2π√(m/k)               ← 文字式（従来どおり乱数代入で同値判定）
(3) 向き：選択{右, 左, 上, 下}
(4) 誤答{ mg → MC-NORMAL-EQ-MG }   ← 典型誤答と誤概念の対応
```

単位は `grade/units.js` で次元（M・L・T・I・Θ）に分解して比較（`km/h` と `m/s` の換算、`N` = `kg·m/s²` も同じと判定）。外部ライブラリは使わず、高校物理で出る単位表（30個程度）を持つ。

### 4-7. シミュレーション登録簿（`content/simulations.json`）

```json
{ "id": "mech.projectile", "name": "斜方投射", "field": "MEC", "model": "mechanics/projectile",
  "params": {
    "v0":    { "label": "初速", "unit": "m/s", "min": 0, "max": 40, "step": 0.5, "default": 15 },
    "theta": { "label": "角度", "unit": "deg", "min": 0, "max": 90, "step": 1, "default": 45 },
    "h0":    { "label": "高さ", "unit": "m",   "min": 0, "max": 50, "step": 1, "default": 0 },
    "g":     { "label": "重力加速度", "unit": "m/s^2", "default": 9.8 } },
  "observables": { "x": "m", "y": "m", "vx": "m/s", "vy": "m/s", "K": "J", "U": "J" },
  "plots": [["t","x"], ["t","y"], ["t","vx"], ["t","vy"]] }
```

問題は `simulation.id` で参照するだけ。検査で「存在する ID か」「preset が params の範囲内か」「locked の名前が実在するか」を確かめる。

### 4-8. 学習記録（localStorage `celestia.v1`、同期表 `celestia_state`）

Lemma の形を引き継ぎ、`cards`・`drill`・`graphExprs` を除いて以下を追加：

```
predictions: [{ p: 問題ID, t, predicted, observed, conf }]
misc:        { "MC-…": { n, last, cleared } }     誤概念ごとの検出回数と解消
simPrefs:    { "mech.projectile": { 最後のパラメータ } }   ← 設定扱い（最後に変えた方）
```

保存キーを `celestia.v1` にするのは、ぶつりばがすでに `lemma-physics.v1` を使っているため（同じドメインなので名前が重なると記録が混ざる）。

---

## 5. 画面

| 画面 | ルート | 備考 |
| --- | --- | --- |
| ホーム（今日） | `#today` | 全分野ランダム／分野ごと／復習。Lemma と同じ |
| 分野別一覧・演習 | `#practice` | 力学〜原子 → 単元 |
| 問題検索 | `#search=` | 概念名・法則名・誤概念でも引けるよう索引を拡張 |
| 問題演習 | （セッション内） | ①問題文 ②問題図（ブロック内に配置）③シミュレーション（`show` に従い「解く前」か「解いた後」）④解答入力 ⑤解答・解説 ⑥解答図（答え合わせ後に初めて読み込む） |
| シミュレーション | `#sim` / `#sim=<ID>` | 単体で遊べる一覧。問題から開いた場合は preset 付き |
| 概念・法則一覧 | `#concepts` / `#concept=<ID>` | 概念の前提関係、関連法則、関連問題、よくある誤概念 |
| 誤答・復習 | `#review` | 間違えた問題と、検出された誤概念 → 補強問題 |
| 学習履歴（定着度） | `#map` | 分野・概念ごとの定着度、自信度・予測とのズレ |
| アカウント設定 | `#settings` | Lemma と同じ |

レイアウト：スマホは縦1列（図は本文幅いっぱい、シミュレーションは全画面化ボタン）。タブレット・PC は「問題文＋図」と「シミュレーション／入力」の2列。図は `placement`（`block` / `float-right` / `side-by-side`）を幅に応じて縦並びへ崩す。

---

## 6. シミュレーション設計

### 6-1. モデルの約束（全モデル共通のインターフェース）

```js
export default {
  id: 'mech.projectile',
  units: 'SI',
  // 解析解があるモデルは at(t) を持つ（巻き戻し・任意時刻へのジャンプが誤差なしで速い）
  at(p, t) { … return state; },
  // 解析解が無いモデル（大振幅の単振り子・万有引力など）は init と step を持つ
  init(p) { … }, step(s, dt, p) { … },
  integrator: 'verlet',            // 'analytic' | 'rk4' | 'verlet'
  dtMax: 1e-3,                     // 1描画フレームを何ステップに分けるかの上限
  observe(s, p) { return { x, y, vx, vy, K, U }; },
  events: [{ name: 'land', when: (s) => s.y, dir: -1, stop: true }],   // 零点を二分法で正確に
  validity(p) { return []; },      // 例：微小振動近似が崩れる角度なら警告文を返す
};
```

### 6-2. 共通コア

- **時間**：シミュレーション時刻 `t` と描画を分離。再生速度（0.25〜4倍）は1フレームで進める `t` の量だけを変える。
- **巻き戻し**：解析解モデルは `at(t)` を呼ぶだけ。数値積分モデルは固定刻みで計算した軌跡を `trace` に保存し、シークバーはその索引を引く（巻き戻すたびに計算し直さないので、行きと帰りで結果が変わらない）。
- **パラメータ変更**：値を変えたら `trace` を作り直し、アニメーションとグラフの両方を同じ `trace` から描く。
- **数値精度**：保存系（ばね・振り子・万有引力）はエネルギーが長時間で発散しない速度 Verlet（シンプレクティック）を既定、減衰・摩擦のある系は RK4。刻みは `dtMax` 以下に分割。衝突・着地はイベント検出で時刻を求め、フレーム境界でずれないようにする。
- **単位**：モデル内部はすべて SI。角度は UI で度、モデルではラジアン。変換は `params.js` だけが行う。

### 6-3. 最初の6本（力学）

| 順 | ID | 方式 | テストで確かめること |
| --- | --- | --- | --- |
| 1 | `mech.projectile`（水平投射を含む） | 解析解 | 到達距離 $v_0^2\sin2\theta/g$、最高点、着地時刻 |
| 2 | `mech.incline` | 解析解（静止/滑走の分岐） | 滑り出し条件 $\mu_s=\tan\theta$ の境界、加速度 |
| 3 | `mech.spring` / `mech.pendulum` | 解析解 / Verlet | 周期 $2\pi\sqrt{m/k}$、小振幅で $2\pi\sqrt{l/g}$、大振幅の周期の伸び、1000周期でエネルギー誤差 < 1e-6 |
| 4 | `mech.collision` | 解析解（1次元、反発係数 e） | 運動量保存が丸め誤差内、e=1 で運動エネルギー保存 |
| 5 | `mech.circular` | 解析解 | 向心加速度 $v^2/r$ |
| 6 | `mech.gravitation` | Verlet | 円軌道の周期（ケプラー第3法則）、角運動量保存 |

### 6-4. グラフ連動

`sim/plot/timeplot.js`：複数のグラフを縦に並べ、同じ時間軸・同じ現在時刻カーソルを共有。グラフ上をドラッグするとシミュレーションの時刻も動く（逆方向の連動）。描画は Canvas で 1 系列 2,000 点程度まで間引き。**Plotly は入れない**（本体が数MBあり、オフライン用キャッシュに常に載る負担に見合わない。必要なのは時系列の折れ線とカーソルだけ）。

---

## 7. 検証（`node tests/run.mjs` に追加する項目）

| 検査 | 方法 |
| --- | --- |
| 問題ID の重複・消失 | Lemma の台帳方式（`tests/golden/ids.txt`） |
| 必須項目・型 | JSON Schema（`physics.problem/1` ほか） |
| 図の参照先がある・孤立した図がない | フォルダ内のファイルと `figures[].src` を突き合わせ |
| 解答図が問題側に漏れていない | `statement.blocks` が `role=answer` の図を参照していたら失敗 |
| SVG の構文と安全性 | XML として読めるか、`script`・`on*` 属性・外部 URL がないか、`viewBox` があるか |
| 図の並び・ID の一意性 | 同一問題内で図 ID が重複しない、ブロックが参照しない図は警告 |
| 分野・単元の整合 | `unit` が `field` の下にあるか（taxonomy） |
| concept / laws / misconception の参照整合 | 存在する ID か、概念の前提関係に循環がないか |
| 小問と答えの対応 | `statement` の小問 ID と `answer.parts` の ID が一致 |
| シミュレーション ID・preset | 登録簿にあるか、範囲内か |
| 数式の描画 | Lemma の `check_katex.cjs` を流用 |
| 単位の妥当性 | 数値答えの単位の次元が、問われている量（例：速度）の次元と一致するか |
| 図と物理条件の整合 | §4-3 の宣言と SVG の実測、問題文の数値と比較 |
| 物理モデルの正しさ | §6-3 の解析解比較・保存則テスト（Node だけで実行） |
| 解答図は答え合わせまで出ない | Playwright：答え合わせ前に解答図の `<img>` が DOM に無く、リクエストも飛んでいない |
| 依存の向き | `sim/models` が DOM や `views` を import していないか |
| CI | `.github/workflows/test.yml` で上記を push ごとに実行 |

---

## 8. 調査で見つかった既存の問題

1. **【重要】Lemma とぶつりばが互いのオフライン用キャッシュを消している。** どちらも `mythos0217.github.io` という同じドメインで動いていて、キャッシュ置き場はドメイン単位で共有される。Lemma の `sw.js` は「自分の版と `lemma-data-` 以外」を、ぶつりばの `sw.js` は「自分の版以外すべて」を起動時に消す。片方を開くたびに、もう片方がオフラインで開けなくなる。物理版を同じドメインに置けば3つ巴になる。直し方：各アプリが**自分の接頭辞のキャッシュだけ**を消すようにする（各 `sw.js` 数行の修正）。
2. **GitHub Actions が実際には動いていない。** README は「Actions タブで ✓ を確認」とあるが、リポジトリに `.github/workflows/` がない。Web の「Upload files」でフォルダをドラッグすると `.github` のような「.」で始まるフォルダが落ちることが多い。
3. **ぶつりばのリポジトリに `ぶつりば問題管理表.xlsx` が公開状態で入っている。** Lemma では「参考元を含むので管理表はリポジトリに入れない」と決めているので、同じ理由があるなら外した方がよい（履歴からも消すには別作業が要る）。
4. `app.js` が全画面を1ファイルで持っており、物理版で画面が増えると保守が難しくなる（§3 で分割）。

---

## 9. 移行計画

数学版の利用者の記録・問題 ID には一切触れないので、利用者データの移行は発生しない。

1. 新リポジトリを作り、lemma-math v0.9.0 の中身を土台として置く（数学の `content/`・`data/`・`drill.js`・`graph3d.js`・`content.js` は除く）
2. 保存キー・キャッシュ接頭辞・同期表名を物理版用に変更（衝突回避）
3. Lemma の既存テストのうち、引き継ぐ部分（採点・同期・catalog）が新リポジトリで通ることを確認してから改修開始
4. Supabase：`supabase/schema.sql` に `celestia_state` を追加する SQL を用意（実行は手動で1回）
5. 将来 `lemma-input/1` の拡張を数学版へ戻す場合は、上位互換なので数学版のデータ変更は不要

---

## 10. 実装順序（Phase 2 以降）

| Phase | 作るもの | 完了の目安 |
| --- | --- | --- |
| 2 データ構造 | Schema 5種、`content/` の雛形、サンプル問題 5問（力学、図つき・解答図つき・予測つき）、概念・法則・誤概念の初期セット、`build_app_data` の物理版、§7 のデータ検査 | `tests/run.mjs` が新しい検査込みで ✓ |
| 3 既存機能の整理 | 計算タブ・グラフ電卓・3D・数学内蔵問題を削除、タブ構成変更、`app.js` の画面分割、キャッシュ・保存キーの修正 | e2e が新タブ構成で ✓、数学関連の参照ゼロ |
| 4 シミュレーション基盤 | `sim/core`・`timeplot`・`player`、斜方投射 → 斜面 → ばね・振り子 | モデルテスト ✓、スマホで 60fps 近く |
| 5 問題演習との統合 | ブロック描画・図の描画・解答図の遅延表示・シミュレーション埋め込み・予測→実験→説明・誤概念の記録と誘導・単位つき採点 | サンプル5問が通しで解ける、解答図漏れの e2e ✓ |
| 6 テスト・品質 | 残りの力学モデル、図と物理の整合検査、作図仕様 → SVG 生成、表示確認（スマホ・タブレット・PC） | CI ✓ |

---

## 11. リスク

| リスク | 対策 |
| --- | --- |
| AI 生成の図が「見た目は正しいが物理的に誤り」 | 物理条件の宣言＋自動照合、作図仕様からの生成、人の確認まで非公開 |
| 図の追加でデータ量・オフライン容量が増える | SVG 標準、写真は WebP・長辺制限、図は開いた問題の分だけ読み込む |
| シミュレーションの数値誤差・刻みによる見た目の破綻 | 解析解優先、保存系は Verlet、イベント検出、保存則の回帰テスト |
| 同じドメインの他アプリとの保存領域の衝突 | キー・キャッシュ名の接頭辞を分ける（§8-1） |
| 単位つき採点の誤判定 | 「判定がおかしい？」報告を引き継ぎ、単位表を小さく保ってテストで固定 |
| 作業量の膨張（波動・電磁気・光・熱まで） | 力学6本で共通基盤を固めてから分野を足す。モデル追加は「モデル1ファイル＋描画1ファイル＋登録簿1行」で済む構造にする |
