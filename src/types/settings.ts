/**
 * データベース保存用の設定キー
 */
export type SettingKey =
  | 'is_bg_enabled'          // 背景画像が有効か
  | 'bg_uri'                 // 現在の背景画像URI
  | 'bg_uris'                // ユーザーが選択した背景画像URIリスト
  | 'bg_mode'                // 背景の表示モード（固定・ランダム）
  | 'app_theme'               // アプリ全体のデザインテーマ
  | 'selected_calendar_ids'  // 表示対象として選択されたカレンダーID
  | 'default_calendar_id'    // 予定追加時のデフォルトカレンダーID
  | 'is_dark_mode'           // ダークモード強制設定
  | 'last_viewed_day'        // ホーム画面で最後に表示した日付
  | 'last_viewed_month'      // カレンダー画面で最後に表示した年月
  | 'card_style'             // カレンダーカードのデザインスタイル
  | 'is_premium'            // 課金で広告非表示プランを購入済みか
  | 'health_enabled'        // ヘルスケア連携 ON/OFF
  | 'health_show_steps'     // 歩数を表示するか
  | 'health_show_sleep'     // 睡眠を表示するか
  | 'health_show_heart_rate'    // 心拍数を表示するか
  | 'health_show_active_energy' // 消費カロリーを表示するか
  | 'health_show_weight';   // 体重を表示するか

/**
 * SQLite データベースに保存される設定データの1行分
 */
export interface SettingRow {
  key: SettingKey;
  value: string | null;
}

/**
 * アプリの見た目を変更するデザインテーマの種類
 */
export type AppTheme = 'light-gray' | 'corkboard' | 'wood'
  | 'washi' | 'sakura' | 'matcha' | 'aizome' | 'momiji';

/**
 * カレンダーカードのデザイン（形状・レイアウト）スタイル
 */
export type CardStyle = 'tear-off' | 'ring' | 'polaroid' | 'minimal';

/**
 * アプリケーション内蔵のステートとして扱う設定オブジェクトの型
 */
export interface AppSettings {
  /** 背景画像機能が有効か */
  isBgEnabled: boolean;
  /** 現在表示中の背景画像URI */
  bgUri: string | null;
  /** 登録されている背景画像URIのリスト */
  bgUris: string[];
  /** 背景画像の切り替えモード */
  bgMode: 'fixed' | 'random';
  /** 選択されているデザインテーマ */
  appTheme: AppTheme;
  /** ダークモードが有効か */
  isDarkMode: boolean;
  /** 表示対象に選択されているネイティブカレンダーのIDリスト */
  selectedCalendarIds: string[];
  /** 予定作成時にデフォルトで選択されるカレンダーID */
  defaultCalendarId: string | null;
  /** ホーム画面で最後に表示した日付 (YYYY-MM-DD) */
  lastViewedDay: string | null;
  /** カレンダー画面で最後に表示した年月 (YYYY-MM-01) */
  lastViewedMonth: string | null;
  /** カレンダーカードのスタイル */
  cardStyle: CardStyle;
  /** 課金で広告非表示プランを購入済みか（true なら広告を非表示） */
  isPremium: boolean;
}
