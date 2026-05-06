/**
 * アプリ内で使用されるカラーおよびフォントの定義ファイル。
 * ライトモードとダークモードの各カラーパレットと、
 * プラットフォーム（iOS, Android, Web）ごとのフォント設定を管理します。
 */

import { Platform } from 'react-native';

// アプリのメインアクセントカラー（ティントカラー）
const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

/**
 * カラーパレットの定義。
 * `useThemeColor` フック等を通じて各コンポーネントで参照されます。
 */
export const Colors = {
  /** ライトモード用の設定 */
  light: {
    text: '#11181C', // 基本テキスト色
    background: '#fff', // 背景色
    tint: tintColorLight, // アクセント色
    icon: '#687076', // 標準アイコン色
    tabIconDefault: '#687076', // 未選択時のタブアイコン色
    tabIconSelected: tintColorLight, // 選択時のタブアイコン色
  },
  /** ダークモード用の設定 */
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

/**
 * プラットフォームごとのフォント定義。
 * iOS のシステムフォント、Web のフォントスタック、および Android (default) を切り替えます。
 */
export const Fonts = Platform.select({
  /** iOS: SF Pro ベースのシステムフォントデザインを指定 */
  ios: {
    /** 標準的なサンセリフ体 */
    sans: 'system-ui',
    /** セリフ体 */
    serif: 'ui-serif',
    /** 角丸デザイン（モダンな印象） */
    rounded: 'ui-rounded',
    /** 等幅フォント */
    mono: 'ui-monospace',
  },
  /** Android / Default: OS標準のフォント名を使用 */
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  /** Web: ブラウザごとのフォントスタックを指定 */
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
