# CLAUDE.md

fortee のスタッフ投票ページ（CfP採点）に機能を足す Chrome 拡張（Manifest V3 / content script のみ）。
使い方や機能の説明は `README.md` にある。ここには、コードを読むだけでは分からないことを書く。

## コマンド

```bash
npm test    # tsc --noEmit → vite build → jsdom スモークテスト
npm run build
npm run watch   # 差分ビルド。拡張機能ページの再読み込みボタンと併用する
```

`npm test` は**ビルドを含む**。テストは `dist/content.js`（ビルド済みバンドル）を jsdom で eval するので、
ソースを直しただけでは反映されない。テストを走らせれば自動でビルドされる。

動作確認は `chrome://extensions` から `dist/` を「パッケージ化されていない拡張機能」として読み込む。

## ファイルの役割

| ファイル | 役割 |
| --- | --- |
| `src/page.ts` | **fortee の DOM への依存を閉じ込めるアダプタ**。セレクタ・スコアの読み書き・フォーカス移動はすべてここ経由 |
| `src/content.ts` | 状態と操作。フィルタ、キー操作、MutationObserver、矢印キーでの採点 |
| `src/bar.ts` | 画面下部のサマリーバーの描画 |
| `src/storage.ts` | `chrome.storage.local` の読み書き。イベントの slug ごとに保存領域を分ける |
| `src/types.ts` | 型と `DEFAULT_SETTINGS` |
| `test/fixture.mjs` | 投票ページを模したダミー DOM の生成 |

ページ構造が変わったときに直すのは `src/page.ts` だけで済むようにする。
他のファイルに `.proposal4staffvote` のようなセレクタを書かない。

## 踏むと痛いところ

### `renderChip` で `textContent` を無条件に代入しない

`textContent` への代入は、値が同じでもテキストノードを作り直すため childList のミューテーションが発生する。
スコアチップは MutationObserver の監視対象（プロポーザル一覧）の内側にあるので、
**observer 発火 → `render()` → チップ書き換え → observer 発火** が rAF ごとに永久に回る。
必ず「変わったときだけ書く」こと。同じ理由で、監視対象の内側を描画するコードは全て冪等にする。

回帰テストが `test/smoke.mjs` にある（アイドル時に `requestAnimationFrame` が呼ばれ続けないことを確認）。

### `DEFAULT_SETTINGS` は `src/types.ts` の1箇所だけ

以前 `content.ts` にも同じ初期値が書かれていて、片方だけ直すと不整合になる状態だった。
初期値を変えるときは `DEFAULT_SETTINGS` を直す。なお `loadSettings` は保存値をマージするので、
**既に設定を保存したことがあるユーザーには新しい初期値は適用されない**。

### `import './styles.css'` には型宣言が要る

TypeScript 7 は型宣言のない side-effect import を通さない（TS2882）。
`src/vite-env.d.ts` が `vite/client` の型を読み込むことで解決している。消さないこと。

### 実際の CfP をリポジトリに入れない

採択前のプロポーザル本文・タイトル・各票の集計は公開情報ではない。
フィクスチャは必ずダミーを使う（`test/fixture.mjs` が「ダミーセッション N」を生成する）。
特定のイベント名も書かない（このリポジトリは public）。
`fixtures/local/` と `screenshots/` は `.gitignore` 済み。

## 依存と CI

- `.npmrc` の `min-release-age=7` により、**公開から7日経っていないバージョンは選ばれない**。
  `npm install` の解決時のみ効き、`npm ci` には影響しない。出たての版が要るときは `--min-release-age 0`。
- GitHub Actions の action は**タグではなくコミット SHA で固定**している。
  更新は Dependabot に任せる（末尾のバージョンコメントを Dependabot が書き換える）。
- CI は `npm ci --ignore-scripts` を使う。依存の postinstall を実行しない。
- 本番依存（`dependencies`）は持たない。拡張に第三者の npm コードを一切含めない方針。

## Git

`main` にはブランチ保護（PR 必須）がある。直接 push は管理者権限で通ってしまうが、
`Bypassed rule violations` の警告が出る。**ブランチを切って PR を作り、CI グリーンを確認してから squash merge する。**
