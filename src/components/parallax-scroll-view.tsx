import type { PropsWithChildren, ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';

import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * ヘッダーの高さ。スクロール時の視差効果（パララックス）の基準となります。
 */
const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  /** ヘッダー部分に表示する画像や要素 */
  headerImage: ReactElement;
  /** ヘッダーの背景色（ライトモード・ダークモード用） */
  headerBackgroundColor: { dark: string; light: string };
}>;

/**
 * スクロールに応じてヘッダーが動的に変化するパララックススクロールビュー。
 * react-native-reanimated を使用して、スムーズな視差効果とズーム効果を実現しています。
 */
export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
}: Props) {
  const backgroundColor = useThemeColor({}, 'background');
  const colorScheme = useColorScheme() ?? 'light';
  
  // スクロール位置を追跡するためのリファレンスとオフセット
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  /**
   * ヘッダーのアニメーションスタイル。
   * スクロール量に応じて translateY（位置）と scale（拡大率）を補完（interpolate）します。
   */
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          // 上にスクロールするとヘッダーが少し遅れて上に移動し、下に引っ張ると位置が固定されるような効果
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
          ),
        },
        {
          // 下に引っ張った（オーバースクロール）時に、ヘッダー画像を拡大させる（ズーム効果）
          scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
        },
      ],
    };
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ backgroundColor, flex: 1 }}
      scrollEventThrottle={16} // 60fpsのスムーズなアニメーションのために16msごとにイベントを処理
    >
      {/* ヘッダー部分 */}
      <Animated.View
        style={[
          styles.header,
          { backgroundColor: headerBackgroundColor[colorScheme] },
          headerAnimatedStyle,
        ]}>
        {headerImage}
      </Animated.View>
      
      {/* コンテンツ部分 */}
      <ThemedView style={styles.content}>{children}</ThemedView>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    overflow: 'hidden', // 画像がはみ出さないように設定
  },
  content: {
    flex: 1,
    padding: 32,
    gap: 16,
    overflow: 'hidden',
  },
});
