import { BlurView } from 'expo-blur';
import * as Calendar from 'expo-calendar';
import { Tabs, router } from 'expo-router';
import React, { useCallback } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNativeCalendarStore } from '@/store/nativeCalendarStore';

/**
 * タブナビゲーションのレイアウト
 * アプリの下部に常駐するメニューバーを定義し、主要な3画面の切り替えを管理します。
 */
export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { fetchAll } = useNativeCalendarStore();

  /**
   * 「予定追加」ボタンが押された時のアクション
   * OSごとに最適なユーザー体験（UX）を提供するため、処理を分岐しています。
   */
  const handleAddPress = useCallback(async () => {
    if (Platform.OS === 'ios') {
      // iOS: システム標準のイベント作成UIを直接呼び出し、使い慣れた操作感を提供
      await Calendar.createEventInCalendarAsync();
      // モーダルが閉じられた後、新規作成された予定を反映するためにデータを再取得
      await fetchAll();
    } else {
      // Android: Expoライブラリの制限によりカスタム画面（/modal）へ遷移
      router.push('/modal');
    }
  }, [fetchAll]);

  return (
    <Tabs
      screenOptions={{
        // アクティブなタブの色をテーマに合わせて設定
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        // 全てのタブボタンに触覚フィードバック（Haptic）を付与
        tabBarButton: HapticTab,
        // タブバーを背景画像の上に浮かせるためのスタイル設定
        tabBarStyle: Platform.select({
          ios: {
            // iOSは完全に透明にし、背後のBlurViewで高級感のあるぼかしを表現
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
          },
          android: {
            // Androidはわずかに透過させた白/黒の背景色を設定
            position: 'absolute',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderTopWidth: 0,
            elevation: 0,
          },
          default: {
            position: 'absolute',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderTopWidth: 0,
            elevation: 0,
          },
        }),
        // iOS専用：タブバーの背後をリアルタイムでぼかす（すりガラス効果）
        tabBarBackground: Platform.OS === 'ios' ? () => (
          <BlurView
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            intensity={80}
            style={StyleSheet.absoluteFill}
          />
        ) : undefined,
      }}>
      {/* 1. ホーム（日めくりカレンダー） */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      {/* 2. 月間カレンダー */}
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'カレンダー',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      {/* 3. 特殊な「追加」ボタン（画面遷移せず、ネイティブまたはカスタムUIを起動） */}
      <Tabs.Screen
        name="add"
        options={{
          title: '追加',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="plus.circle.fill" color={color} />,
        }}
        listeners={{
          tabPress: (e) => {
            // 通常の画面遷移をキャンセルし、独自の関数を実行
            e.preventDefault();
            handleAddPress();
          },
        }}
      />
      {/* 4. 日記タブ */}
      <Tabs.Screen
        name="diary"
        options={{
          title: '日記',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
        }}
      />
      {/* 5. 設定画面 */}
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
