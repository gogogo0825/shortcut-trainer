# 標準問題の品質監査

初回調査日: 2026-11-08。未確認17問の追加照合日: 2026-11-14。資料確認: Copilot。対象はWindows向けの既定操作。資料への記載確認は実機動作の保証ではなく、製品のバージョン・設定・キーボード配列によって動作は異なる。問題一覧は `npm run validate:questions -- --details`、原本は `src/data/standards`。

| カテゴリ | 初級 | 中級 | 上級 | 計 | 出典確認済み | 出典未確認 | 実機確認済み |
|---|---:|---:|---:|---:|---:|---:|---:|
| Windows | 10 | 12 | 8 | 30 | 30 | 0 | 0 |
| Excel | 10 | 12 | 8 | 30 | 30 | 0 | 0 |
| Word | 10 | 12 | 8 | 30 | 30 | 0 | 0 |
| PowerPoint | 10 | 12 | 8 | 30 | 30 | 0 | 0 |
| VS Code | 10 | 12 | 8 | 30 | 30 | 0 | 0 |
| ブラウザー | 10 | 12 | 8 | 30 | 30 | 0 | 0 |
| 合計 | 60 | 72 | 48 | 180 | 180 | 0 | 0 |

2026-11-08の156問追加後は出典確認済み163問・未確認17問だった。2026-11-14に未確認17問を照合し、全180問がデータ上 `docs_checked` となった。実機未確認は180問のままで、品質検証は未完了。今回再照合したのは17問であり、残り163問を再検証したことは意味しない。

上表は調査時点の標準データの状態である。実機検証画面に人が登録する結果は端末内の自己申告であり、この監査表や標準JSONの`device_checked`を自動更新しない。実機での操作が必要で、ブラウザー入力検出や自動テストの成功だけでは確認済みとしない。

## 公式資料と適用範囲

- [Microsoft Windows キーボードショートカット](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows): 追加26問はWindows 10/11向け文字編集の一覧に基づく。書式や編集の動作は対応アプリと入力欄に依存する。
- [Microsoft Excel キーボードショートカット](https://support.microsoft.com/en-gb/accessibility/excel/keyboard-shortcuts-in-excel?nochrome=true)、[Microsoft Word キーボードショートカット](https://support.microsoft.com/en-gb/accessibility/word/keyboard-shortcuts-in-word?nochrome=true)、[Microsoft PowerPoint プレゼンテーション作成](https://support.microsoft.com/en-us/accessibility/powerpoint/use-keyboard-shortcuts-to-create-powerpoint-presentations): Windows版を参照。資料はUS配列を前提とし、JISでの適用は未確認。PowerPointのアニメーション書式コピー・貼り付けはOffice 2007/2010では使用できないと記載されている。リボンのキーは表示言語やバージョンによって異なり得る。
- [VS Code 既定キーバインド](https://code.visualstudio.com/docs/reference/default-keybindings): Windows版の既定値を参照。カスタマイズ・拡張機能やフォーカスで変化し、Ctrl+Alt+矢印はグラフィックスドライバー等と競合する場合がある。
- [Google Chrome ショートカット](https://support.google.com/chrome/answer/157179?hl=en): Windows版Chromeを参照。他ブラウザーへの適用は未確認。

出典確認済みは上記の実際に参照した資料の表記との照合を意味する。URL形式の検査のみで内容確認済みと判定しない。具体的な製品バージョンを実機で特定しておらず、JIS実機は全180問で未確認。検証状態は既存の `pending` / `docs_checked` / `device_checked` を維持し、`docs_checked` は実機未確認を意味する。

## 既存データの監査と訂正

既存24問はすべて初級、出典確認済み6件、未確認18件、実機確認0件だった。PowerPointの `powerpoint-new-slide` は旧revision 1のCtrl+Shift+Mが公式資料と不一致だったため、同じIDを維持してrevision 2のCtrl+Mに訂正し、出典確認済みにした。回答履歴・習熟度を消去・書換えしていない。旧revisionでの回答は誤ったキーで採点されている可能性があるが、自動的な再採点はできない。分析は異なるrevisionの履歴を同じ問題IDで集計するため、画面に旧revisionを含む旨を表示する。過去の正誤・XP・習熟度はそのまま残る。

## 2026-11-14 未確認17問の公式資料照合

照合前は17問すべて `revision: 1`、難易度 `beginner`、`verification: pending`、出典 `publisher: 未確認`（URL・確認日なし）、`layout: any` だった。以下は照合前のID・操作・正解キーと結果。リンク先の公式ページ本文を直接取得し、対象のWindows欄・操作名・キーを照合した。「一致」は公式資料への記載との一致であり、JISまたは実機での動作確認ではない。

| 問題ID | カテゴリ | 難易度 | 照合前の操作 | キー | 公式本文で確認した操作・結果 |
|---|---|---|---|---|---|
| `windows-copy` | Windows | 初級 | 選択した項目をコピーする | Ctrl+C | [Windows](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows): 選択したテキストをコピー。一致。ファイルは[エクスプローラー](https://support.microsoft.com/en-gb/sharepoint/sync/work-with-synced-files-in-file-explorer)の同期ファイル操作でも確認 |
| `windows-paste` | Windows | 初級 | 選択位置に貼り付ける | Ctrl+V | [Windows](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows): クリップボードの直近項目を貼り付け。一致 |
| `windows-cut` | Windows | 初級 | 選択した項目を切り取る | Ctrl+X | [Windows](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows): 選択したテキストを切り取り。一致 |
| `windows-undo` | Windows | 初級 | 操作を元に戻す | Ctrl+Z | [Windows](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows): 前の操作を取り消す。一致 |
| `excel-save` | Excel | 初級 | ブックを保存する | Ctrl+S | [Excel](https://support.microsoft.com/en-us/accessibility/excel/keyboard-shortcuts-in-excel): ブックを保存。一致 |
| `excel-copy` | Excel | 初級 | 選択したセルをコピーする | Ctrl+C | [Excel](https://support.microsoft.com/en-us/accessibility/excel/keyboard-shortcuts-in-excel): 選択範囲をコピー。一致 |
| `excel-paste` | Excel | 初級 | コピーした内容を貼り付ける | Ctrl+V | [Excel](https://support.microsoft.com/en-us/accessibility/excel/keyboard-shortcuts-in-excel): 選択範囲を貼り付け。一致 |
| `excel-undo` | Excel | 初級 | 直前の操作を元に戻す | Ctrl+Z | [Excel](https://support.microsoft.com/en-us/accessibility/excel/keyboard-shortcuts-in-excel): 直前の操作を取り消す。一致 |
| `word-bold` | Word | 初級 | 選択した文字を太字にする | Ctrl+B | [Word](https://support.microsoft.com/en-us/accessibility/word/keyboard-shortcuts-in-word): テキストに太字書式を適用。一致 |
| `word-save` | Word | 初級 | 文書を保存する | Ctrl+S | [Word](https://support.microsoft.com/en-us/accessibility/word/keyboard-shortcuts-in-word): 文書を保存。一致 |
| `word-copy` | Word | 初級 | 選択した文字をコピーする | Ctrl+C | [Word](https://support.microsoft.com/en-us/accessibility/word/keyboard-shortcuts-in-word): 選択内容をクリップボードにコピー。一致 |
| `word-italic` | Word | 初級 | 選択した文字を斜体にする | Ctrl+I | [Word](https://support.microsoft.com/en-us/accessibility/word/keyboard-shortcuts-in-word): テキストに斜体書式を適用。一致 |
| `powerpoint-save` | PowerPoint | 初級 | プレゼンテーションを保存する | Ctrl+S | [PowerPoint](https://support.microsoft.com/en-us/accessibility/powerpoint/use-keyboard-shortcuts-to-create-powerpoint-presentations): プレゼンテーションを保存。一致 |
| `powerpoint-copy` | PowerPoint | 初級 | 選択した内容をコピーする | Ctrl+C | [PowerPoint](https://support.microsoft.com/en-us/accessibility/powerpoint/use-keyboard-shortcuts-to-create-powerpoint-presentations): 選択した文字・オブジェクト・スライドをコピー。一致 |
| `powerpoint-undo` | PowerPoint | 初級 | 操作を元に戻す | Ctrl+Z | [PowerPoint](https://support.microsoft.com/en-us/accessibility/powerpoint/use-keyboard-shortcuts-to-create-powerpoint-presentations): 直前の操作を取り消す。一致 |
| `vscode-command-palette` | VS Code | 初級 | コマンドパレットを開く | Ctrl+Shift+P | [VS Code](https://code.visualstudio.com/docs/editing/getting-started/tips-and-tricks): Command Paletteを開き、その時点で利用可能なコマンドにアクセス。一致 |
| `browser-new-tab` | ブラウザー | 初級 | 新しいタブを開く | Ctrl+T | [Chrome](https://support.google.com/chrome/answer/157179?hl=en): 新しいタブを開き、そこに移動。一致。資料で確認したのはWindows版Chromeであり、他ブラウザーは今回未確認 |

上記17 IDは出典発行元・URL・確認日と資料が示す対象を追加し `docs_checked` に更新した。操作、正解キー、採点方法とrevisionは変更していない。不一致・修正キー・revision更新は今回0件。旧回答・採点結果に変更はない。未確認問題は0問。

### 適用条件・実機確認

- Windows資料はWindows 10/11の既定操作を示すが、アプリによってキーの動作が変わると明記している。コピー・切り取り・貼り付けには適切な選択範囲と対応するフォーカスが必要。ファイルの追加裏付けは同期済みOneDrive/SharePointファイルの例であり、すべてのファイル操作環境を検証したものではない。取り消しできない操作もある。
- Excel・Word・PowerPointは公式ページの **Windows** 欄を参照した。Web版・macOS版に同一動作を保証しない。Word公式資料はStarter版で一部機能が非対応と注意している。保存先・権限・保護状態、選択範囲、アプリ設定によって結果は異なる。Excel・PowerPointを含むOfficeの取り消しにも[制限](https://support.microsoft.com/en-us/office/foundations-experiences/undo-redo-or-repeat-an-action)がある。
- VS CodeはWindowsの既定バインドであり、[設定・拡張機能・フォーカスやwhen条件](https://code.visualstudio.com/docs/configure/keybindings)によって変更・競合し得る。ChromeのCtrl+Tも変更された環境や他ブラウザーでの動作は未検証。
- 17問は英字キーとCtrl/Shiftのみで記号キーのJIS/US位置差を使わないが、JIS配列・IME・物理キーイベントの実測はしていない。公式資料上の一致をJIS実機保証とみなさない。
- ChromeのCtrl+Tはブラウザー予約キーであり、このWebアプリにイベントが届かない場合がある。Ctrl+Sもブラウザーの保存操作と競合し得る。その他もブラウザー・OS・拡張機能により捕捉を保証できない。届かない場合は4択または自己申告を利用する。
- **今回の17問を含む全180問**で、WindowsのChrome/Edge、JISキーボード、対象アプリの版・設定・フォーカスごとの実機操作とイベント到達の確認が必要。`device_checked` は0件のまま。

## 重複・入力・競合

ID一意性、同一カテゴリ内の操作名重複、同一キー手順候補、カテゴリ・難易度配分、スキーマ、出典URL形式を自動検査。2026-11-08の同一カテゴリ内同一キー手順候補は0組。異なるカテゴリで同じキーを使う問題は対象アプリが異なるため残している。検査はコード・修飾キー・手順に基づく候補検出であり、意味が似た別操作や状況別の重複を完全に判断できない。

追加問題はすべて1段階で、キーとcode・修飾キーを入力エンジンへ渡す単体テストを実施。複数の正解の別記は現在のスキーマでは表現できず、公式資料に複数キーがある場合は1つのみを採用する。Tab・Escapeはナビゲーションに予約されるため追加していない。ブラウザー固有操作26問は `browser-reserved` タグを持ち、4択・自己申告を併用できる。

主な予約・競合候補: ChromeのCtrl+W/L/D/J/P/R/S/O/U/G、Ctrl+Shift+N/T/B/O/W/G/J/Delete/M/D/PageUp/PageDown、Alt+Left/Right/Home、F11。既存のCtrl+T/N/F/Hもブラウザーに予約される可能性がある。PowerPointのF5、Office系のCtrl+W/P/OやAlt操作、WindowsのCtrl+F、VS CodeのCtrl+Alt+矢印もブラウザー・OS・ドライバーと競合し得る。正確な取得可否は実機・環境ごとに異なるため、すべてのキーの検証済み一覧とは扱わない。

独自問題に標準IDを新規登録する操作は拒否する。既存データまたは旧形式バックアップで衝突した場合は、独自問題だけを空いている`custom-...` IDへ原子的に移し、attempts・mastery・sessionsの参照も移す。移行中の保存失敗はIndexedDBトランザクションでロールバックするため、標準問題と独自問題のどちらも上書き・削除しない。標準問題は引き続き練習・分析・復習で利用でき、再割当された独自問題と履歴も保持される。既存バックアップのversion 1形式も復元でき、再割当件数を画面に表示する。自動移行後は、衝突IDが存在した履歴の参照が独自問題側に移ったことを問題管理で確認できる。

旧revisionの回答記録および当時の採点結果は変更しない。習熟度には計算対象revisionを記録し、異なるrevisionの記録だけしかない旧習熟度は値を保持したまま`questionRevision: 0`（現行revisionとは一致しない旧データ）として復習・適応出題から除外する。新revisionの記録がある場合はその記録だけで習熟度を再計算する。分析の全体成績・日次推移は過去回答を保持し、概要と個別履歴に旧revisionであることを示す。

## サイズと人手確認

24問時の初期JS約474 kBに対し、180問を同じチャンクに含めると約612 kBで警告が出た。問題データを別チャンクに分離後、初期JS約463 kB、問題データ約149 kB（gzip約8.4 kB）、分析約391 kBでビルド警告は解消。データチャンクは初期読み込みされるため、転送量・画面描画の実測改善を保証するものではない。Playwrightの問題管理操作は成功したが、低速端末での表示性能は未測定。

1. テスト用ブラウザープロファイルを用意し、現在のデータをバックアップする。
2. 問題ごとに公式資料の記載・対象アプリ・バージョン・フォーカスと前提条件、JIS配列のキー位置を確認する。特にUS配列前提のOffice問題、数字・修飾キー・記号、OS/ブラウザー予約キーを優先する。
3. WindowsのChromeとEdge、および対象アプリの実機でショートカットを試し、入力欄へのイベント到達・4択・自己申告を確認する。元のアプリ設定や既存データを破壊しない。
4. 確認者・日時・Windows/アプリ/キーボードバージョン・結果・競合・URLを記録し、成功を確認した問題のみ `device_checked` に更新する。詳細は `docs/test-plan.md`。

## 自動検証結果（2026-11-14）

- `npm.cmd test`: 11ファイル、51件成功。
- `npm.cmd run e2e`: Chromiumで22件成功を2回。
- `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run lint`: 成功。ビルド内の問題検証は180問、全カテゴリ各30件、同一カテゴリ内同一キー手順候補0組。
- `npm.cmd audit`: 脆弱性0件。

自動テストは各出典のページ内容を検証しない。上の17問の出典は2026-11-14に公式ページの本文を直接照合した。

### 2026-11-08時点の結果（履歴）

- `npm.cmd test`: 11ファイル、44件成功。
- `npm.cmd run e2e`: 21件成功。
- `npm.cmd run e2e:pages`: 1件成功。
- `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run lint`: 成功。
- `npm.cmd audit`: 脆弱性0件。

これらの自動検証は実機でのショートカット動作や資料の内容の正確性を保証しない。
