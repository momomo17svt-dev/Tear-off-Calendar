// Android および Web で MaterialIcons を使用するためのフォールバック。

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * SF Symbols の名前を Material Icons の名前に対応させるマッピング。
 * iOS 以外のプラットフォームでも同様のアイコンが表示されるようにします。
 * - Material Icons の一覧: https://icons.expo.fyi
 * - SF Symbols の一覧: SF Symbols アプリ (Apple公式)
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'plus.circle.fill': 'add-circle',
  'gearshape.fill': 'settings',
  'calendar': 'calendar-month',
} as IconMapping;

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * iOS ではネイティブの SF Symbols を、Android と Web では Material Icons を使用するアイコンコンポーネント。
 * これにより、プラットフォーム間で一貫した外観を保ちつつ、最適なリソース使用を実現します。
 * 
 * アイコン名は SF Symbols ベースで指定し、iOS 以外のために MAPPING で Material Icons に変換されます。
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
