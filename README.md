# Claude Code History（VSCode拡張）

`~/.claude/projects/` に蓄積される Claude Code のチャット履歴を、VSCode内で閲覧・検索できる拡張。

## 機能

- リポジトリ単位でセッションをグルーピング
- LINE風のメッセージビュー（user右寄せ、assistant左寄せ、Markdown描画）
- プロジェクト横断のテキスト検索
- ファイル変更の自動反映（chokidarによるFS監視、ポーリングなし）
- プロジェクト/セッションの非表示トグル

## インストール

### VSIXからインストール

1. [Releases](../../releases) ページから `.vsix` ファイルをダウンロード
2. VSCodeのコマンドパレット（`Cmd+Shift+P`）を開く
3. `Extensions: Install from VSIX...` を選択してファイルを指定

### ソースからビルド

```sh
npm install
npm run build
npx vsce package
```

生成された `.vsix` ファイルを上記手順でインストール。

## 使い方

インストール後、**アクティビティバー（左端）** に Claude Code History のアイコンが表示される。

右側に常駐させたい場合は、ビューのタイトル部分を **Secondary Side Bar（右サイドバー）にドラッグ**してください（VSCode標準操作）。

## 設定

| 設定キー | デフォルト | 説明 |
|---|---|---|
| `cchistory.baseDir` | （空） | プロジェクトを配置しているディレクトリ。空なら `~/Projects` を使用。プロジェクト名のグルーピングに使われる |
| `cchistory.projectsDir` | （空） | Claude Code 履歴ディレクトリのパス。空なら `baseDir` の親直下の `.claude/projects` を自動導出（baseDir が `~/Projects` の場合は `~/.claude/projects`） |
| `cchistory.refreshDebounceMs` | `500` | FS変更検知のdebounce時間（ミリ秒） |

## 開発

```sh
npm install
npm run build
```

VSCodeで当ディレクトリを開き、`F5` で Extension Development Host を起動。

型チェック:

```sh
npm run typecheck
```

## ライセンス

[MIT](./LICENSE)
