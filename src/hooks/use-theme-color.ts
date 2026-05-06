/**
 * テーマ（ライト/ダーク）に基づいた適切な色を解決するためのカスタムフック。
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * 現在のテーマに応じた色を返します。
 * 
 * @param props - コンポーネントのプロパティで指定されたライト/ダーク別の色。
 * @param colorName - `@/constants/theme` で定義されているカラー名（例: 'text', 'background'）。
 * 
 * 解決の優先順位:
 * 1. `props` で現在のテーマ用の色が指定されていればそれを使用。
 * 2. 指定がなければ、`Colors` 定数からデフォルトの色を取得。
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
