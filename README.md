# 日めくりカレンダーアプリ (Tear-off Calendar)

写真を背景にした日めくりカレンダーと、端末ネイティブカレンダーの予定管理、写真付きの日記機能を一体化したモバイルアプリ。React Native (Expo SDK 54) で iOS / Android に対応。

## 主な機能

- **日めくりホーム画面** — 紙をめくるアニメーションで日付を移動。背景画像は固定 / 日替わりランダムから選択可能。
- **月間カレンダー** — 月ごとのグリッド表示。六曜表示、日付タップで該当日のホームへジャンプ。
- **予定管理** — 端末ネイティブカレンダー（iOS Calendar / Google Calendar）に直接読み書き。
- **日記機能** — 1 日複数件、タイトル / 本文 / タグ / 画像（最大 5 枚）を保存。タイトル・タグ検索対応。ホーム画面の選択日付と連動。
- **テーマ / 背景** — 和紙・桜・抹茶など複数の和風テーマと、ダークモードに対応。
- **広告 / 課金** — 無料時のみ AdMob バナーを表示。`is_premium` フラグで非表示に切替可能。

## 開発環境

| 項目 | 内容 |
| :--- | :--- |
| フレームワーク | React Native (Expo SDK 54) |
| 言語 | TypeScript |
| 状態管理 | Zustand |
| データ永続化 | Expo SQLite + expo-file-system |
| ルーティング | Expo Router (File-based) |
| CI/CD | GitHub Actions + EAS Build |

## セットアップ

```bash
npm install
npx expo start --tunnel
```

Windows + iPhone での動作確認はトンネルモードを推奨（LAN モードはファイアウォール / Wi-Fi 帯域問題で繋がりにくい）。

AdMob のネイティブモジュールは Expo Go では動かないため、`npm run ios` / `npm run android` で Dev Build を使うのが確実。

## ドキュメント

- 要件定義: [requirements.md](./requirements.md)
- 進捗管理: [PROGRESS.md](./PROGRESS.md)
- AIアシスタント向け行動指針: [claude.md](./claude.md)

## ディレクトリ構成（抜粋）

```
src/
├─ app/                # Expo Router の画面
│  ├─ (tabs)/          # タブ画面（ホーム / カレンダー / 追加 / 日記 / 設定）
│  ├─ modal.tsx        # 予定追加・編集モーダル
│  └─ modal-diary.tsx  # 日記追加・編集モーダル
├─ components/         # 共通 UI コンポーネント
├─ constants/
│  ├─ cardLayout.ts    # ホーム/カレンダー共通のカード寸法
│  └─ theme.ts
├─ db/                 # SQLite DAL（settings / diaries）
├─ store/              # Zustand ストア
├─ types/              # 型定義
└─ utils/              # ネイティブカレンダー操作、日記画像、テーマ など
```
