# 日めくりカレンダーアプリ 要件定義・開発フロー統合資料

> **最終更新: 2026-05-17**
> フェーズ 9（日記機能の追加 / 広告レイアウト改修 / 課金フラグ仕込み）を反映。

---

## 1. アプリ概要とコア要件

写真（画像）を背景に設定でき、**端末のネイティブカレンダー（iOS標準カレンダー / Google カレンダー）** と完全に統合された、モダンな日めくりカレンダーアプリ。

### 1.1 機能要件

* **日めくり画面:** 今日の日付・曜日・ネイティブカレンダーの予定をリスト表示。スワイプ操作での日付移動。
* **予定管理:** アプリ内から予定の追加・編集・削除が可能。操作はネイティブカレンダーに直接反映される。
* **カレンダー表示選択:** 設定画面で、表示するネイティブカレンダー（iCloud / Google など）をON/OFFで選択できる。
* **背景画像設定:** 端末のアルバムから画像を選択し、背景として設定可能。設定画面で表示のON/OFF切り替え。
* **日記機能:** 任意の日付に日記（タイトル / 本文 / タグ / 複数画像）を 1 日複数件まで保存できる。タイトル / タグでの検索が可能。ホーム画面の選択日付と連動。
* **広告 / 課金:** 無料ユーザーには画面下部にバナー広告を表示。`is_premium` フラグが立つと AdBanner が `null` を返し、レイアウトが自然に詰まる（StoreKit/Billing 連携は将来実装）。
* **オフライン動作:** ネイティブカレンダーのデータ / 日記データはいずれもデバイスにローカル保存されているため、ネット接続なしで動作する（広告のみ通信が必要）。

### 1.2 廃止した要件（フェーズ6で設計変更）

| 廃止項目 | 理由 |
| :--- | :--- |
| SQLite `events` テーブル | ネイティブカレンダーを唯一のデータソースとするため不要 |
| 予定の「種類」区別（予定/誕生日） | ネイティブカレンダー側で管理するため、アプリ内での区別を廃止 |
| 毎年繰り返しフラグ（is_annual） | ネイティブカレンダーの繰り返しルールに委譲 |
| アプリ独自の「エクスポート」機能 | 書き込みがネイティブへの直接操作になったため不要 |

---

## 2. UI/UX・画面遷移設計（LINE風ボトムタブ）

モダンで「写真が主役」となるデザインを実現するため、グラスモーフィズム（すりガラス風）と透過UIを活用する。

### 2.1 画面構成（Bottom Tab Navigation）

タブ並び順は `ホーム / カレンダー / 追加 / 日記 / 設定` の 5 タブ構成。

* **[1] ホーム（日めくりカレンダー）**
  * 背景：ユーザー設定画像（フルスクリーン）。UIは透過ベース。
  * 情報パネル：固定高さカード上に日付とネイティブカレンダーの予定リストを表示。
  * カード高さは全日程で統一（予定の件数に依存しない固定レイアウト）。
  * 予定タップ → 編集・削除のアクションシートを表示（iOS: ActionSheetIOS）。
  * スワイプで日付移動。移動後の日付は `navigationStore.selectedDate` 経由で日記タブと共有。
* **[2] カレンダー（月間ビュー）**
  * 月単位のグリッド。日付タップでホームの該当日へジャンプ。
  * カード寸法はホームと共通化（`src/constants/cardLayout.ts`）。
* **[3] 追加（予定の入力）**
  * タップ時に下から入力画面（モーダル）がせり上がるUI。
  * 入力はネイティブカレンダーへ直接書き込む。日付入力はカレンダーピッカー。
  * どのカレンダー（iCloud / Google等）に追加するかを選択できる。
* **[4] 日記**
  * 選択中日付（ホームと連動 or 日付ピッカー/前後ボタンで変更可）に紐づく日記一覧。
  * タイトル / タグでの検索バー（300ms デバウンス）。
  * 「＋ 新規」ボタンで `modal-diary` を開き、タイトル / 本文 / タグ / 画像（最大 5 枚）を入力。
  * 1 日複数件の保存が可能。
* **[5] 設定**
  * 背景テーマ選択・背景画像ON/OFF・画像アップロード。
  * **ネイティブカレンダー選択:** 表示するカレンダーをON/OFFで選択できる。

※**ボトムタブ自体のデザイン:** タブバーの背景は半透明または完全透過にし、アイコンが浮き上がるスタイル。
※**広告領域:** ホーム/カレンダー画面ではタブバー直上に AdBanner を「レイアウトとして」配置（絶対配置ではない）。`is_premium=true` のときは `null` を返し、コンテンツ領域が自然に広がる。

---

## 3. システム構成・技術スタック

Windows + VS Code環境での開発を主軸とし、iOSビルドはクラウドに委譲する。

| 項目 | 技術・ライブラリ |
| :--- | :--- |
| 開発エディタ | VS Code |
| フレームワーク | React Native (Expo SDK 54) |
| **イベントデータ** | **`expo-calendar`（ネイティブカレンダー API）** |
| **日記データ** | **Expo SQLite（`diaries` テーブル）+ `expo-file-system` ローカル画像** |
| アプリ設定データ | Expo SQLite（`settings` テーブル。`is_premium` 含む） |
| 状態管理 | Zustand（`settingsStore` / `nativeCalendarStore` / `diaryStore` / `navigationStore`） |
| カレンダーキャッシュ | Zustand（起動時に過去3ヶ月〜未来12ヶ月を一括取得してメモリ保持） |
| 日記キャッシュ | Zustand（起動時に全件取得して `diariesByDate` に格納） |
| 日付ピッカー | `@react-native-community/datetimepicker` |
| 広告 | `react-native-google-mobile-ads`（ANCHORED_ADAPTIVE_BANNER）+ `expo-tracking-transparency` |
| CI/CD | GitHub Actions + EAS Build |

---

## 4. データ設計（フェーズ6以降）

### 4.1 イベントデータ（ネイティブカレンダー）

イベントは SQLite ではなく、**端末のネイティブカレンダー** に直接保存する。  
アプリは `expo-calendar` API を通じて読み書きする。

```
ネイティブカレンダー（iOS Calendar / Google Calendar）
  ↑↓  expo-calendar API
nativeCalendarStore（Zustand・メモリキャッシュ）
  ↓ 参照
ホーム画面 / 追加・編集モーダル
```

**キャッシュ戦略:**
- 起動時に対象期間（過去3ヶ月 〜 未来12ヶ月）のイベントを一括フェッチ
- アプリ上でイベントを追加・編集・削除した後はキャッシュを即時更新
- 設定でカレンダーON/OFFを変更した場合も再フェッチ

### 4.2 `settings` テーブル（SQLite・継続使用）

| key | 値の例 | 説明 |
| :--- | :--- | :--- |
| `is_bg_enabled` | `'1'` / `'0'` | 背景画像のON/OFF |
| `bg_uri` | ファイルパス文字列 | 固定背景画像のURI |
| `bg_uris` | JSON配列文字列 | アップロード済み画像一覧 |
| `bg_mode` | `'fixed'` / `'random'` | 背景表示モード |
| `app_theme` | `'light-gray'` / `'corkboard'` / `'wood'` ほか和風テーマ | 背景テーマ |
| `is_dark_mode` | `'1'` / `'0'` | ダークモード強制 |
| `selected_calendar_ids` | JSON配列文字列 | 表示するカレンダーIDリスト |
| `default_calendar_id` | カレンダーID文字列 | 予定追加時のデフォルトカレンダー |
| `last_viewed_day` | `'YYYY-MM-DD'` | ホーム画面で最後に表示した日付 |
| `last_viewed_month` | `'YYYY-MM-01'` | カレンダー画面で最後に表示した年月 |
| `card_style` | `'tear-off'` / `'ring'` / `'polaroid'` / `'minimal'` | カードデザイン |
| `is_premium` | `'1'` / `'0'` | **（新規）** 課金で広告非表示プランを購入済みか |

### 4.3 `diaries` テーブル（SQLite・フェーズ 9 で追加）

| 列名 | 型 | 説明 |
| :--- | :--- | :--- |
| `id` | INTEGER PK AUTOINCREMENT | 一意なID |
| `date` | TEXT | 対象日付（`YYYY-MM-DD`、ホーム日付キーと整合） |
| `title` | TEXT | タイトル（空文字許容） |
| `content` | TEXT | 本文（複数行可） |
| `tags` | TEXT | JSON 配列文字列（タグ） |
| `image_uris` | TEXT | JSON 配列文字列（`expo-file-system` のローカル URI） |
| `created_at` | INTEGER | 作成日時（Unix epoch ms） |
| `updated_at` | INTEGER | 最終更新日時（Unix epoch ms） |

インデックス: `idx_diaries_date`、`idx_diaries_date_created`（日付絞り込みと新しい順ソート用）。

画像は `documentDirectory/diaries/diary_<ts>_<rand>.jpg` に保存し、URI のみ DB 保持。日記削除時に物理ファイルも `FileSystem.deleteAsync({ idempotent: true })` で削除する。

---

## 5. 実装上の注意点

* **権限:** `expo-calendar` はiOS/Android共に実行時に権限ダイアログを表示する必要がある。`app.json` に `expo-calendar` プラグインと権限説明文を設定済み。
* **誕生日カレンダー（iOS）:** Appleの「誕生日」カレンダーは読み取り専用。書き込みはできないため、追加先カレンダーの選択肢から除外する。
* **画像URI:** 背景画像・日記添付画像とも `expo-file-system` でローカル保存し、URIのみを SQLite に保持する（背景は `documentDirectory` 直下 `bg_*.jpg`、日記は `documentDirectory/diaries/` 配下に分離）。
* **カード共通寸法:** ホーム/カレンダーのカードは `src/constants/cardLayout.ts` の `CARD_WIDTH = SCREEN_WIDTH * 0.89`、`CARD_HEIGHT = SCREEN_HEIGHT * 0.72` で共通化。タブ切替時の上端ジャンプ防止のため、両画面で同一値を使うこと。
* **紙めくり/月めくりアニメ:** 待機位置は `FLY_OUT_DISTANCE = SCREEN_HEIGHT + 100` を使い、iPad の縦長画面でも前後カードが完全に画面外まで出るようにする（旧 `900` ハードコードは不可）。
* **広告レイアウト:** ホーム/カレンダーの AdBanner は `position: 'absolute'` ではなく flex レイアウトに組み込む。タブバー直上に来るよう、`useBottomTabBarHeight()` の値を `paddingBottom` に渡す。
* **課金フラグ:** `useSettingsStore.isPremium` を購読することで広告の出し分けを実装。StoreKit/Billing 連携を実装する際は購入成立後に `useSettingsStore.getState().setPremium(true)` を呼べばレイアウトが自然に追従する。
