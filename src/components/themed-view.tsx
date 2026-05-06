import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  /** ライトモード時の背景色（未指定時はデフォルトの背景色） */
  lightColor?: string;
  /** ダークモード時の背景色（未指定時はデフォルトの背景色） */
  darkColor?: string;
};

/**
 * テーマに応じた背景色を自動適用する View コンポーネント。
 * コンテナやセクションの背景として使用することで、ダークモード切り替えに自動対応します。
 */
export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  // 現在のテーマ（ライト/ダーク）に基づいた背景色を取得
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
