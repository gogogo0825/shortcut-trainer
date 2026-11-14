# Shortcut Trainer

Windowsのショートカットを練習する日本語Webアプリです。学習データはIndexedDBを使って端末内に保存し、サーバーへの送信は行いません。

**β版（試験公開準備中）**: 180問のWindows JIS実機検証は未完了です。動作は製品のバージョン・設定・キーボード配列によって異なります。自動テストは実機確認や正式完成を意味しません。

## 開発を始める

このREADMEがあるフォルダーで次を実行します。

```powershell
npm install
npm run dev
```

型チェック・静的解析・テスト・本番ビルド:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Playwright E2EテストはChromiumブラウザーをインストールした後に実行します。

```powershell
npx playwright install chromium
npm run e2e
npm run e2e:pages
```

`e2e:pages` は本番ビルドを作成し、ローカルのサブパスで表示・保存・バックアップを検証します。

## 実装状況

- Phase 1: 開発基盤、データモデル、IndexedDB初期化、ホーム画面。
- Phase 2: キー入力、ガイド練習・クイズ、4択・自己申告、セッション結果と回答記録。
- Phase 3: 履歴分析、習熟度、復習予定、適応型出題。
- Phase 4: 標準問題180件、独自問題、CSV/JSON取込、JSONバックアップ・復元。`npm run validate:questions` で問題を検証します。出典・実機確認の状況は `docs/shortcut-content-audit.md` を参照。
- Phase 5: XP・レベル・連続正解・連続学習日数、文字サイズとテーマ、画面操作・アクセシビリティ改善。手動確認は `docs/accessibility-checklist.md` を参照。
- Phase 6: Pages用手動workflowとサブパス検証を準備。公開・実機確認・問題の拡充は未完了です。判定と証跡は `docs/acceptance.md` を参照。
- 各フェーズの実装範囲は`docs/prompts/phase-XX.md`を参照してください。

## 参照順
`docs/requirements.md` → `docs/architecture.md` → `docs/screens.md` → `.github/copilot-instructions.md` → `docs/prompts/phase-XX.md`。

## フェーズ
1. 開発環境・基盤・データモデル
2. キー入力エンジン・練習・クイズ
3. IndexedDB・学習分析・復習
4. 標準問題集・独自問題・インポート
5. UI・ゲーミフィケーション・アクセシビリティ
6. E2E・文書化・GitHub Pages・最終検証

**注意**: 問題一覧で出典確認状況を個別に表示します。実機確認済みの問題はまだありません。問題の実機検証や公開承認は人が行います。

## 公開準備

`.github/workflows/pages.yml` は手動起動のみで、承認なしに実行・公開しません。公開先リポジトリのルートにこのアプリを配置し、GitHub PagesのソースをGitHub Actionsに設定する必要があります。Viteは相対base `./`、ルーティングはHashRouterを使用し、リポジトリ名によるサブパスに対応します。Pagesの公開ファイルと公開リポジトリのソースは第三者に閲覧されます。コミット前に内容を人が確認し、バックアップや秘密情報を含めないでください。学習データはオリジンごとに分離され、開発環境から公開先へ自動移行されません。実際のリポジトリ名・権限・公開先と承認後の手順は `docs/developer-guide.md` を参照してください。
