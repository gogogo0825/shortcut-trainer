import { Link } from "react-router-dom";

export function HelpPage() {
  return <section className="surface-card mx-auto max-w-2xl space-y-5 p-6">
    <h1 className="text-2xl font-bold">ヘルプ</h1>
    <h2 className="text-xl font-semibold">練習と採点</h2>
    <p>ガイド練習では正解キーを表示し、正解まで再挑戦できます。クイズでは回答前に正解を隠します。</p>
    <p>キーボード入力は回答欄にフォーカスがあるときだけ受け付けます。OSやブラウザーが予約するキー、スマートフォンなどでは4択または自己申告を利用できます。</p>
    <h2 className="text-xl font-semibold">学習データ</h2>
    <p>学習データは端末内に保存されます。問題管理からバックアップを作成できます。端末間の自動同期はありません。</p>
    <p>出典・実機確認状況は問題ごとに異なります。問題管理で確認できます。</p>
    <div className="flex flex-wrap gap-3"><Link className="button-primary" to="/practice">練習を始める</Link><Link className="button-secondary" to="/questions">問題管理</Link></div>
  </section>;
}
