import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Webプラットフォーム専用の useColorScheme フック。
 * 
 * 静的レンダリング（SSR/SSG）をサポートする場合、サーバー側ではユーザーのOSテーマ（ライト/ダーク）を
 * 判別できないため、クライアント側でハイドレーション（Hydration）が完了してから再計算する必要があります。
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  // コンポーネントがマウントされた（クライアント側で実行された）ことを検知
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  // ハイドレーション完了後は実際のカラースキームを返し、それまではデフォルトの 'light' を返します。
  // これにより、サーバーとクライアントでのレンダリング結果の不一致（Hydration Mismatch）を防ぎます。
  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
