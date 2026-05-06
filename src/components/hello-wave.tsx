import Animated from 'react-native-reanimated';

/**
 * 手を振る絵文字を表示するアニメーションコンポーネント
 * 挨拶などの場面で視覚的なアクセントとして使用されます。
 */

export function HelloWave() {
  return (
    <Animated.Text
      style={{
        fontSize: 28,
        lineHeight: 32,
        marginTop: -6,
        // reanimatedを使用して、手を振るような回転アニメーションを適用します
        animationName: {
          '50%': { transform: [{ rotate: '25deg' }] },
        },
        animationIterationCount: 4,
        animationDuration: '300ms',
      }}>
      👋
    </Animated.Text>
  );
}
