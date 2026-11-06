# CELESTIA 高校物理

<img src="icons/icon-192.png" width="96" alt="CELESTIA のアイコン：楕円軌道と、その焦点にある恒星">

図・シミュレーション・問題演習で、現象から理解する高校物理アプリ（試作版 v0.1.1）。
大学受験数学アプリ [Lemma](https://github.com/mythos0217/lemma-math) v0.9.0 の仕組み（復習・自動採点・同期・オフライン）を引き継いでいます。
iPhone・iPad・PC のブラウザで動き、ホーム画面に追加するとアプリとして使えます（PWA）。

目指す学び方：問題を読む → 図で現象をつかむ → シミュレーションで条件を変える → 結果を予測する → 法則で考える → 解く → 解答図と解説で深める → 間違えた概念を復習する

## いまできること（v0.1）

- **図つきの問題**：問題文の途中に図（SVG）を置ける。1問に複数の図
- **解答図**：解答・解説にも図。答え合わせを押すまで表示せず、ファイルも読み込まない
- **答えを入力して自動採点**：Lemma の採点をそのまま使い、物理向けに `v_0`・`v0`（添字）と単位 `[m/s]` を追加
- **概念・法則・誤概念**：問題は単元だけでなく「確かめる概念」「使う法則」「よくある誤解」につながる。概念ページから関連問題へ
- **全分野からランダム／単元ごと／復習／検索／問題セット**（Lemma と同じ）
- **自信度、定着度、ライト・ダーク、アカウントと同期、オフライン**（Lemma と同じ）
- **シミュレーション**：登録簿（7本）と一覧画面まで。本体は Phase 4
- **ケプラ（月のうさぎ）**：休憩や体調への声かけ、物理の勉強のアドバイス、物理学者のことば（設定でオフにできる）

アイコンは楕円軌道と、その**焦点**に置いた恒星（ケプラーの第1法則）。元の絵は `icons/src/icon.svg` で、`rsvg-convert -w 512 -h 512 icons/src/icon.svg -o icons/icon-512.png` のように書き出す（maskable 用に、絵は中心から半径 400/1024 の安全域に収めてある）。

Lemma から外したもの：計算トレーニング、グラフ電卓（2D・3D）、数学の内蔵問題。計算問題は通常の問題形式（`format: "calc"`）として扱います。

## フォルダ

```
content/                 正規データ（マスター。ここを編集する）
  taxonomy.json          分野・単元（ID 固定）
  concepts.json  laws.json  misconceptions.json  simulations.json  tags.json  collections/
  problems/<分野>/<問題ID>/
    problem.json         問題・答え・解説・図の情報
    q-*.fig.json         作図仕様（tools/figgen.py が SVG にする）
    q-*.svg  a-*.svg     図（q- は問題用、a- は解答用。名前は自由だが分けておくと見やすい）
data/                    アプリ用（生成物。tools/build_data.py が作る。手で編集しない）
js/                      アプリ（app.js・catalog.js・answer.js・parser.js・problem/figures.js・sync.js …）
tools/                   変換・作図・検査（Python と Node）
tests/                   検査（node tests/run.mjs）
docs/                    データ仕様（data-spec.md）・設計（DESIGN.md）
supabase/schema.sql      同期用の表（Supabase の SQL Editor で1回実行）
```

## 問題を追加・修正する

```sh
pip3 install jsonschema
python3 tools/figgen.py                 # 作図仕様（*.fig.json）から SVG を作る
python3 tools/build_data.py             # content/ → data/
node tests/run.mjs                      # 検査（全部 ✓ になればOK）
python3 tools/validate_content.py --write-golden   # 新しい問題ID を台帳に足す（問題を足したとき）
```

1. `content/problems/<分野>/<新しい問題ID>/problem.json` を、既存の問題をまねて作る（形は [docs/data-spec.md](docs/data-spec.md)）
2. 図は作図仕様（`*.fig.json`）で書くのがおすすめ。力の向き・斜面の角度などを数値で書くので、図と物理条件の照合が自動になる
3. 上の4行を実行。`validate_content.py` が、図の参照切れ・解答図の漏れ・図と物理条件の食い違い（力のつり合い・ベクトルの分解・角度）などを見つける
4. `content`・`data`・`tests` フォルダごとリポジトリにアップロード

規則：問題ID は変えない・消さない（消すと台帳 `tests/golden/ids.txt` との照合で検査が失敗する）。出さない問題は `quality.status` を `hidden` に。

## アカウントと同期（Supabase）

- Supabase プロジェクトは **Lemma と共通**（`js/config.js` の値も同じ）。アカウントも共通で、記録は別の表 `celestia_state` に保存
- 準備：`supabase/schema.sql` を SQL Editor で1回実行（表を1つ足すだけ。Lemma の表には触れない）
- 退会はアカウントごと消すので、Lemma の記録も消える（画面でもそう伝えている）
- 端末の保存キーは `celestia.v1`・`celestia.auth`。同じドメインの Lemma（`lemma.v2`）・ぶつりば（`lemma-physics.v1`）と混ざらない

## GitHub Pages で公開する

Lemma と同じ手順です。リポジトリ（例：`mythos0217/celestia`、Public）の直下にこのフォルダの中身を置き、Settings → Pages で `main` / `/ (root)` を選ぶと `https://mythos0217.github.io/celestia/` で開けます。

- `.github/workflows/test.yml`（自動検査）は、Web の「Upload files」でフォルダごとドラッグすると落ちることがあります。Actions タブに何も出ないときは、このファイルを個別にアップロードしてください
- 更新したときは `sw.js` の `VERSION` と、各 JS の `FILE_VERSION`、`css/style.css` の `--celestia-version` を同じ値に上げる
- オフライン用のキャッシュ名は `celestia-` で始まり、消すのも `celestia-` のものだけです（同じドメインの Lemma・ぶつりばのキャッシュを消さない）
