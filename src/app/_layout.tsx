import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

import { initDatabase } from '@/db/database';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNativeCalendarStore } from '@/store/nativeCalendarStore';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Expo Router の静的設定
 * アプリ起動時やディープリンク時に解決すべきアンカー（基点）を (tabs) に設定します。
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * アプリ全体のルートレイアウト・コンポーネント
 * 
 * 役割：
 * 1. 起動時の初期化シーケンス（DB接続、ストアのハイドレーション、外部API同期）の制御。
 * 2. グローバルな Context Provider（Theme, Navigation）の注入。
 * 3. 準備完了までのローディング状態（スプラッシュ画面）の管理。
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        /**
         * ── 初期化シーケンス ──
         * 画面がマウントされる前に必要なリソースを順番に準備します。
         */
        
        // 0. 広告トラッキングの許可リクエストと広告SDKの初期化
        if (!isExpoGo) {
          const { requestTrackingPermissionsAsync } = require('expo-tracking-transparency');
          const mobileAds = require('react-native-google-mobile-ads').default;
          
          const { status } = await requestTrackingPermissionsAsync();
          // トラッキングの許可・拒否に関わらずSDKは初期化する必要があります
          await mobileAds().initialize();
        }

        // 1. SQLiteデータベースの初期化（テーブル作成とシードデータの投入）
        await initDatabase();
        
        // 2. ユーザー設定の読み込み（DBからZustandストアの状態を復元）
        await useSettingsStore.getState().loadSettings();
        
        // 3. カレンダー関連の初期化を並列実行して高速化
        await Promise.all([
          useNativeCalendarStore.getState().loadCalendars(), // 端末内のカレンダー一覧を取得
          useNativeCalendarStore.getState().fetchAll(),      // 直近の予定データを一括フェッチ
        ]);
        
        // 全ての準備が整ったことを通知
        setIsReady(true);
      } catch (e) {
        // 初期化フェーズで致命的なエラーが発生した場合の状態保持
        setInitError((e as Error).message);
      }
    })();
  }, []);

  /**
   * コンディショナル・レンダリング
   * アプリの状態に応じて表示を切り替えます。
   */

  // エラー発生時：ユーザーにトラブルを通知する最小限のUIを返す
  if (initError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>DB初期化エラー: {initError}</Text>
      </View>
    );
  }

  // 準備中：ActivityIndicatorを表示（実際にはここでSplash Screenを表示し続けることが多い）
  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // 正常系：アプリのメインツリー（Navigation Stack）をマウント
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* (tabs): アプリのメイン拠点。下部タブバーを持ち、主要な画面（ホーム、カレンダー、設定）を管理します */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* modal: 予定の追加や詳細表示など、特定の操作時に下から重なって表示される一時的な画面 */}
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#c00',
    textAlign: 'center',
  },
});
