# 完成判定・検証証跡

次のすべてを満たすまで「完成」と宣言しない。各項目に実施日、環境、証跡（テストログ/スクリーンショット/URL等）、確認者、未解決事項を追記する。

## 2026-11-08 中間判定

確認者: Copilot（自動検査）。環境: Windows、Node.js 26.13.0、npm 11.20.0、Playwright Chromium、分離されたテスト用IndexedDB。本番URL・実機・支援技術での人による確認は未実施。判定はこの環境での証跡に限ります。

追記（2026-11-08）: 標準問題を180問に拡充。出典確認済み163問、未確認17問、実機確認0問のため、下表の問題品質は引き続き未達。最新の詳細は[品質監査](./shortcut-content-audit.md)を参照。以下の表は拡充前の中間判定として残す。

追記（2026-11-14）: 未確認17問を公式資料と照合し、データ上の出典確認済みは180問、未確認0問。実機確認は引き続き0問であり、完成判定・公開判定は変更しない。詳細は[品質監査](./shortcut-content-audit.md)を参照。

追記（2026-11-14、β版公開準備）: Windows環境の自動検証で`npm.cmd test` 56件、`npm.cmd run e2e` 23件を2回、`npm.cmd run e2e:pages` 1件、型チェック・ビルド・lint・auditが成功した。Pages相当のローカルサブパスで本番アセット、練習・分析・復習・実機検証画面、再読み込み、学習記録、バックアップ復元を検証した。公開URL・GitHub Actions実行・Windows JIS実機は未確認。β版として表示するが、完成・公開の判定は変更しない。

| 合格条件 | 判定 | 証跡・残課題 |
|---|---|---|
| 全主要機能 | 手動確認待ち | `npm.cmd run e2e` 18件成功。ガイド、クイズ、4択、適応出題、分析、復習、独自問題、設定、XPを自動確認。PC・スマートフォン実機での確認は未実施。JSON編集フォームの改善も残る。 |
| 標準問題約180問・公式出典・問題別検証 | 未達 | `npm.cmd run validate:questions -- --details`: 24問、出典確認済み6問、未確認18問、実機確認0問。詳細は[問題状況](./question-status.md)。残り約156問は未登録。 |
| IndexedDB保存・移行・バックアップ | 合格 | `src/db/migration.test.ts`、`src/features/questions/questionStore.test.ts`、`e2e/questions.spec.ts`、`e2e/pages.spec.ts` が自動成功。実公開環境での確認は別途必要。 |
| Vitest・Playwright・型チェック・ビルド | 合格 | `npm.cmd test` 39件、`npm.cmd run e2e` 18件、`npm.cmd run e2e:pages` 1件成功。`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run lint`、`npm.cmd audit`成功。 |
| Windows JIS・Edge/Chrome実機 | 手動確認待ち | [テスト計画](./test-plan.md)のチェックリストを未実施。Playwright Chromiumは実機・Edge確認の代替ではない。 |
| WCAG 2.2 AA目標の自動・手動検査 | 手動確認待ち | `e2e/accessibility.spec.ts` のaxe・キーボード・モバイル検査は成功。[手動チェックリスト](./accessibility-checklist.md)は未実施。適合は未判定。 |
| ドキュメント整備 | 合格 | [README](../README.md)、[ユーザーガイド](./user-guide.md)、[開発者ガイド](./developer-guide.md)、[テスト計画](./test-plan.md)を更新。 |
| 承認後のPages公開・公開URL確認 | 手動確認待ち | workflow・相対base・HashRouterを準備し、ローカルの `/trainer/` で本番ビルドを検証。公開先リポジトリと承認、実際のworkflow実行と公開URL確認は未実施。 |

未達・手動確認待ちがあるため、**完成・公開済みとは判定しない**。下記チェックボックスは全条件を満たした後、人が証跡を確認して更新する。

- [ ] 全主要機能（ガイド、クイズ、出題順、分析、復習、問題管理、設定、XP）が動作。
- [ ] 標準問題約180問の登録、公式出典の確認、問題別検証状況の確認が完了。
- [ ] IndexedDB保存・スキーマ移行・JSONバックアップ/復元を確認。
- [ ] Vitest・Playwright・型チェック・ビルドの必須チェックが成功。
- [ ] Windows JISキーボードとEdge/Chromeでキー判定、予約キー代替を実機確認。
- [ ] WCAG 2.2 AA目標の自動検査と必要な手動検査を実施し、未達を記録。
- [ ] README、ユーザーマニュアル、開発者ガイド、テスト計画を整備。
- [ ] GitHub Pagesに承認のうえ公開し、公開URLで主要機能を確認。

## 注意
テスト成功は問題内容の正確性やWCAG適合を自動的に証明しない。AI生成の出典や実機確認を検証済みとして扱わない。
