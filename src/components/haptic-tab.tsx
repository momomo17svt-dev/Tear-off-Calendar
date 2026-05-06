import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

/**
 * 触覚フィードバック（Haptics）付きのタブボタンコンポーネント
 * タブをタップした際に、iOS端末で軽い振動を発生させてユーザー体験を向上させます。
 */

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // iOSでは、タブを押し下げた瞬間に軽い触覚フィードバックを追加します。
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
