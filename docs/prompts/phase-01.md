# Phase 01 — 基盤・開発環境・データモデル

## Copilot Agentへの指示（このファイル全文を渡す）
あなたはShortcut Trainerの実装担当Agentです。最初に `docs/requirements.md`、`docs/architecture.md`、`docs/screens.md`、`.github/copilot-instructions.md` を読み、現状のリポジトリを調べてください。既存コードと設計の整合性を維持し、**このフェーズの範囲だけ**を実装してください。

## 実装範囲・合格条件
React + TypeScript + Viteプロジェクトをこのフォルダに構築。既存docsと.githubを保持。Tailwind、React Router（Pages対応）、Zod、Dexie、Vitest、Testing Library、Playwrightを導入。ディレクトリ構成、ルーティング、共通レイアウト、ライト/ダークテーマ、Question/Attempt/Mastery型、Zodスキーマ、IndexedDB初期マイグレーション、サンプル問題（出典未確認はpending）を実装。lint/typecheck/test/buildのnpm scriptsを作成。テスト: スキーマ正常/異常、DB初期化、ルート表示。終了条件: npm install、typecheck、test、buildが成功しホームが起動。

## 実行・報告
1. 実装計画を短く示し、必要なファイルを編集する。
2. 可能な範囲で `npm run typecheck`, `npm test`, `npm run build` および当該フェーズのE2Eを実行する（未定義なら適切に整備）。
3. 失敗を修正し、再実行する。実行できない場合は理由を明示する。
4. 変更ファイル、設計上の判断、テスト実行結果、未完了事項、次フェーズへの引継ぎを報告する。
5. **コミット、push、公開、破壊的な削除は人の承認なしに実施しない。**
