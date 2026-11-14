# 技術設計・データ設計 v1.0

## 構成
React / TypeScript / Vite、React Router（GitHub PagesでのHashRouter推奨）、Tailwind CSS、Recharts、Zod、Dexie（IndexedDBラッパー）、Vitest + Testing Library、Playwright、必要に応じaxe-core。依存パッケージは導入時にバージョンとライセンスを確認する。

`src/features/keyboard`, `practice`, `quiz`, `sessions`, `analytics`, `review`, `questions`, `settings`, `gamification`; `src/data`, `src/db`, `src/shared`。UIと判定ロジック、保存処理を分離する。

## データ契約
Question: `id`（永続）、`revision`、`category`、`difficulty`、`action`、`description`、`platform`、`appVersions?`、`layout`、`steps`（配列、各要素にkey/code/modifiers）、`gradingModes`、`source`（publisher,url,checkedAt）、`verification`（pending/docs_checked/device_checked）、`tags`、`enabled`。

Attempt: `id`, `questionId`, `questionRevision`, `sessionId`, `timestamp`, `mode`, `gradingMethod`（keyboard/multiple_choice/self_assessment）, `correct`, `firstTry`, `elapsedMs?`, `inputSequence?`, `interrupted`。Self-assessmentと4択は入力速度比較から除外できるようにする。

Mastery: `questionId`, `score`（0–100）, `reviewDueAt`, `intervalDays`, `easeFactor`, `lastReviewedAt`, `lapses`, `algorithmVersion`, `questionRevision?`。`questionRevision`は習熟度を計算した問題revisionで、0は旧データのrevisionを特定できない状態を示す。Session: モード、対象、出題順、開始終了、完了数、XP。UserQuestion: 標準と同等のスキーマ＋所有者ローカル属性。

IndexedDBテーブル: attempts, sessions, mastery, customQuestions, settings, achievements, metadata, deviceVerifications。スキーマversion 4で実機検証テーブルを追加し、既存学習データを変更しない。検証記録は標準問題ID・revision、結果、明示確認、実施日時・登録日時、環境、備考、ブラウザー入力検出を持つ追記型とする。現行revisionの最新登録のみ進捗に反映し、旧revisionは履歴として保持する。ブラウザー入力の一致は対象アプリの成功を証明しない。JSONバックアップはversion 3で出力し、version 1・2も読み込む。標準問題JSONはビルド時に検証し、アプリ内では読み取り専用とする。独自問題IDが標準IDと衝突した場合は独自問題だけを一意な`custom-...` IDに移し、attempts・mastery・sessionsの参照を同一Dexieトランザクションで更新する。移行失敗時は全変更をロールバックする。バックアップ復元も旧形式を受け付け、衝突する独自IDとその参照を同じ規則で再割当する。検証記録の同一IDで異なる内容は復元全体をロールバックする。

## キー判定エンジン
- `KeyboardEvent.code` と `key` の両方を保持。物理位置と文字を混同しない。修飾キーは集合として比較、複数段階は有限状態機械で順序を評価。
- `repeat` を除外し、IME composing中は入力を採点しない。Ctrl/Shift/Alt/Metaの左右差は原則無視、問題指定時のみ区別。フォーカス喪失時は押下状態をクリア。
- 一定時間でステップ入力をリセット（初期値1500ms、設定可能）。誤キー、タイムアウト、キーアップの扱いをユニットテストで固定。
- ブラウザ予約キーを全てpreventDefaultできると仮定しない。直接捕捉不能なら代替方式へ。

## 習熟度・間隔反復の初期案（後で調整可能）
- `keyboard` の初回正答を重視。直近20回の重み付き正答率60%、回答速度20%、直近5回の成績20%を基準とする。サンプルが少ないときは中立の事前値を採用し、スコアを過信しない。
- 速度評価は問題ごとの目標時間を使い、単純な全問共通秒数で難易度を歪めない。4択・自己申告は速度成分を計算しない。
- 間隔反復の初期ルール例: 初回正解1日→再正解3日→7日→14日→30日。誤答は翌日へ戻す。連続正答・誤答回数に応じ調整。厳密な最適化を主張しない。
- `algorithmVersion`と`questionRevision`を保存し、将来の再計算・移行に対応。revisionをまたいだ過去回答・採点結果は履歴と全体分析に残すが、現行revisionの習熟度・復習には混ぜない。学習履歴は削除しない。
- 適応型出題は期限到来、低習熟度、未学習の順に優先し、同一問題の過度な連発を避ける。ランダムシードをテスト可能にする。

## セキュリティ・品質
JSON/CSV取込時のZod検証、サイズ制限、重複ID、XSS対策（ユーザー文をHTMLとして挿入しない）、バックアップ復元時の確認、破損データ処理。GitHub Pages公開前にライセンスと機密情報を確認。
