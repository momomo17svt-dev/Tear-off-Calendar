import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { initDatabase } from '@/db/database';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEventStore } from '@/store/eventStore';
import { useSettingsStore } from '@/store/settingsStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await Promise.all([
          useEventStore.getState().loadEvents(),
          useSettingsStore.getState().loadSettings(),
        ]);
        setIsReady(true);
      } catch (e) {
        setInitError((e as Error).message);
      }
    })();
  }, []);

  if (initError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>DB初期化エラー: {initError}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
