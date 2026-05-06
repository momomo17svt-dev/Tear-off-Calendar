import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  /** ライトモード時のカスタムカラー（未指定時はデフォルトのテキスト色） */
  lightColor?: string;
  /** ダークモード時のカスタムカラー（未指定時はデフォルトのテキスト色） */
  darkColor?: string;
  /** テキストのスタイルタイプ */
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

/**
 * テーマに応じたスタイルと色を自動適用するテキストコンポーネント。
 * 標準の Text コンポーネントの代わりにこれを使用することで、
 * ダークモード対応や共通のデザインシステム（タイトル、リンク等）を簡単に適用できます。
 */
export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  // 現在のテーマ（ライト/ダーク）に基づいた色を取得
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        // type に応じて定義済みのスタイルを適用
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style, // カスタムスタイルが最優先
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  /** 標準テキスト */
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  /** セミボールド（少し太め）の標準テキスト */
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  /** 大見出しスタイル */
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  /** 中見出し・サブタイトル */
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  /** リンク用スタイル */
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
