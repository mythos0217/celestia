# CELESTIA 高校物理

<img src="icons/icon-192.png" width="96" alt="CELESTIA のアイコン：楕円軌道と、その焦点にある恒星">

図・シミュレーション・問題演習で、現象から理解する高校物理アプリ（試作版 v0.3）。
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
- **シミュレーション（全分野 24本）**：パラメータを動かすと、アニメーションとグラフが同じ物理モデルから一緒に変わる。再生・一時停止・巻き戻し（シークバーやグラフをなぞる）・速度変更、測定値つき
  - 力学（7）：斜方投射・斜面と摩擦・ばね振り子・単振り子・1次元の衝突・等速円運動・万有引力と軌道
  - 波動（5）：正弦波の伝わり方・弦の固有振動（定常波）・うなり・ドップラー効果・水面波の干渉
  - 光（3）：屈折と全反射・レンズの像・ヤングの実験
  - 電磁気（5）：点電荷の電場と電位・コンデンサーの充電と放電・磁場中の荷電粒子・磁場中を動く導体棒・交流回路（RLC 直列）
  - 熱（2）：気体分子の運動と圧力（壁の力積から圧力を「測る」）・気体の状態変化と熱力学第1法則
  - 原子（2）：光電効果・放射性崩壊と半減期
- **問題とシミュレーションの連携**：解いたあとに「シミュレーションで確かめる」で、問題と同じ条件のシミュレーションが開く。グラフ読解の問題のグラフ（v-t、波形 y-x など）も、シミュレーションのモデルから描く
- **法則の導出（66件）**：導出できる法則は1段ずつ開ける導出、出発点となる法則・実験から得た法則は根拠と由来。概念ページ・解説から法則のページへ
- **問題 58問**：すべての単元（23単元）に問題がある。誤概念を扱う概念問題、グラフ読解、融合問題を含む。誤概念 23件

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
  sim/core/              シミュレーションの共通部分：時間・パラメータ（単位変換）・軌跡・数値積分・イベント検出
  sim/models/mechanics/  物理モデル（画面に依存しない。Node だけでテストできる）
  sim/render/  sim/plot/  sim/ui/   描画・連動グラフ・プレーヤー
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

## シミュレーションを追加する

1. `js/sim/models/<分野>/<名前>.js` に物理モデルを書く（SI 単位。解析解があれば `at(p, t)`、なければ `init`・`accel`（保存系は速度ベルレ）または `deriv`（RK4）。着地などは `event`）
2. `js/sim/render/` に描画器（`bounds` と `draw`）を書き、`RENDERERS` に登録する
3. `content/simulations.json` にパラメータ（単位・範囲・既定値）・量・グラフ・表示名を登録し、`status` を `ready` に
4. `tests/sim.test.mjs` に解析解・保存則との比較を足す（登録簿との整合は自動で検査される）
5. `sw.js` の `FILES` にファイルを足す

モデルの数値計算の精度は `tests/sim.test.mjs` で確かめています（例：振れ角 90° の単振り子の周期の比 1.18034、50周期でのエネルギーのずれ 1e-5 未満、楕円軌道での角運動量の保存、ドップラー効果で波面が届く間隔から測った振動数＝式、気体分子の壁への力積から測った圧力≒Nm⟨v²⟩/3V、RC 回路の熱＝½CE²、導体棒の F の仕事＝運動エネルギー＋熱、P-V 図の面積＝仕事）。

時間によらないシミュレーション（レンズ・屈折・干渉縞・電場・光電効果）は、モデルに `static: true` と `profile(p)` を書く。波形のように時刻ごとに形が変わるグラフは `snapshot(p, t)` を書き、登録簿のグラフに `"snap": true` を付ける。

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
