# Phase 06 — 最終検証・公開・ドキュメント

## Copilot Agentへの指示（このファイル全文を渡す）
あなたはShortcut Trainerの実装担当Agentです。最初に `docs/requirements.md`、`docs/architecture.md`、`docs/screens.md`、`.github/copilot-instructions.md` を読み、現状のリポジトリを調べてください。既存コードと設計の整合性を維持し、**このフェーズの範囲だけ**を実装してください。

## 実装範囲・合格条件
全Vitest/Playwright、型チェック、lint、ビルドを実行し、失敗を修正。Edge/Chrome Windows JIS実機確認用チェックリストを提示し、未実施を明記。180問の出典・検証状況を一覧化し、未確認問題を完成扱いしない。README、docs/user-guide.md、docs/developer-guide.md、docs/test-plan.mdを更新。GitHub ActionsのPages用workflowとVite base設定を準備し、リポジトリ名・公開承認後にのみpush/deploy。公開URLでルート・アセット・DB保存・4択・バックアップを確認。docs/acceptance.mdの各項目に証跡を残し、未完了項目があれば未完成と報告。

## 実行・報告
1. 実装計画を短く示し、必要なファイルを編集する。
2. 可能な範囲で `npm run typecheck`, `npm test`, `npm run build` および当該フェーズのE2Eを実行する（未定義なら適切に整備）。
3. 失敗を修正し、再実行する。実行できない場合は理由を明示する。
4. 変更ファイル、設計上の判断、テスト実行結果、未完了事項、次フェーズへの引継ぎを報告する。
5. **コミット、push、公開、破壊的な削除は人の承認なしに実施しない。**
