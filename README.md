# WEB SHELF

登録したWebサイトのコンテンツを収集・解析・整理し、統一された読みやすいUIで閲覧できるコンテンツリーダー／アーカイブアプリです。単なるRSSリーダーやWebViewラッパーではなく、サイトごとに異なる構造のコンテンツをアプリ側で正規化して「自分だけのライブラリ」として蓄積することを目的としています。

## 主な機能

- **サイト登録**: URLを入力するとRSS/Atomフィードを自動検出し、見つからない場合はHTML構造を解析して記事一覧・本文を抽出（フォールバック方式）
- **ホーム / ライブラリ**: 新着記事の一覧、既読・お気に入り・保存状態の管理、カード/グリッド/リスト表示の切り替え
- **リーダー**: サニタイズ済みの本文表示、読書位置の自動保存・復元、画像タップでの拡大表示
- **コレクション・タグ**: 記事を自由に分類・整理
- **検索・履歴・ギャラリー**: 全文検索、閲覧履歴、画像だけをまとめて閲覧できるマソンリーグリッド
- **設定**: ライト/ダーク/システムテーマ、文字サイズ、データのエクスポート/インポート/全削除

## 技術スタック

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Prisma](https://www.prisma.io) + SQLite（ローカルファーストなデータ永続化）
- [Tailwind CSS v4](https://tailwindcss.com)
- [SWR](https://swr.vercel.app) によるクライアント側データフェッチ
- `rss-parser` / `cheerio` によるRSS・HTML・OpenGraph・JSON-LD解析
- `DOMPurify` による外部コンテンツのサニタイズ（XSS対策）

## セットアップ

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

## セキュリティ

登録されたURLへのアクセス前に、ループバック・プライベートIP・クラウドメタデータエンドポイントへのリクエストを拒否するSSRF対策を実装しています（`src/lib/fetch/ssrf.ts`）。取得したHTML本文は表示前に必ずサニタイズされます。
