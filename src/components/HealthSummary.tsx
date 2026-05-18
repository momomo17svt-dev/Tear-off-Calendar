/**
 * ヘルスケアサマリーカード
 *
 * 日記タブの FlatList ListHeaderComponent として配置する。
 * healthStore.healthEnabled が true の iOS 端末でのみ表示される。
 */
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useHealthStore } from '@/store/healthStore';

interface Props {
  dateStr: string;
  isDarkMode: boolean;
  themeColors: {
    textMain: string;
    textSub: string;
    cardBg: string;
    border: string;
  };
  onGoToSettings: () => void;
}

interface Chip {
  emoji: string;
  label: string;
  value: string;
}

function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function HealthSummary({ dateStr, isDarkMode, themeColors, onGoToSettings }: Props) {
  const {
    healthEnabled,
    authorized,
    authError,
    loadingDates,
    showSteps,
    showSleep,
    showHeartRate,
    showActiveEnergy,
    showWeight,
    fetchForDate,
    getForDate,
  } = useHealthStore();

  // 認証済みかつ有効になったらデータを取得
  useEffect(() => {
    if (healthEnabled && authorized) {
      fetchForDate(dateStr);
    }
  }, [dateStr, healthEnabled, authorized, fetchForDate]);

  // iOS 以外 / 機能 OFF は何も表示しない
  if (Platform.OS !== 'ios' || !healthEnabled) return null;

  const isLoading = loadingDates[dateStr] ?? false;
  const data = getForDate(dateStr);

  // 未認証の場合
  if (!authorized) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: themeColors.cardBg, borderColor: themeColors.border },
        ]}
      >
        <Text style={[styles.sectionLabel, { color: themeColors.textSub }]}>
          ❤️‍🩹 ヘルスケア
        </Text>
        <TouchableOpacity onPress={onGoToSettings} activeOpacity={0.7}>
          <Text style={[styles.hint, { color: authError ? '#dc2626' : themeColors.textSub }]}>
            {authError
              ? 'ヘルスケアへのアクセスが拒否されました。設定タブから再度お試しください。'
              : 'ヘルスケアへのアクセス許可が必要です。設定タブで許可してください。'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // チップ（各メトリクス）を構築
  const chips: Chip[] = [];
  if (data) {
    if (showSteps && data.steps != null)
      chips.push({ emoji: '🏃', label: '歩数', value: `${data.steps.toLocaleString()} 歩` });
    if (showActiveEnergy && data.activeEnergy != null)
      chips.push({ emoji: '🔥', label: 'カロリー', value: `${data.activeEnergy} kcal` });
    if (showSleep && data.sleepMinutes != null)
      chips.push({ emoji: '😴', label: '睡眠', value: formatSleep(data.sleepMinutes) });
    if (showHeartRate && data.heartRateAvg != null)
      chips.push({ emoji: '❤️', label: '心拍数', value: `${data.heartRateAvg} bpm` });
    if (showWeight && data.weight != null)
      chips.push({ emoji: '⚖️', label: '体重', value: `${data.weight} kg` });
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themeColors.cardBg, borderColor: themeColors.border },
      ]}
    >
      <Text style={[styles.sectionLabel, { color: themeColors.textSub }]}>
        ❤️‍🩹 ヘルスケア
      </Text>

      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={themeColors.textSub}
          style={styles.loader}
        />
      ) : chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {chips.map((chip) => (
            <View
              key={chip.label}
              style={[
                styles.chip,
                { backgroundColor: isDarkMode ? '#2c2c2e' : '#f1f5f9' },
              ]}
            >
              <Text style={styles.chipEmoji}>{chip.emoji}</Text>
              <View>
                <Text style={[styles.chipLabel, { color: themeColors.textSub }]}>
                  {chip.label}
                </Text>
                <Text style={[styles.chipValue, { color: themeColors.textMain }]}>
                  {chip.value}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : data ? (
        <Text style={[styles.hint, { color: themeColors.textSub }]}>
          この日のデータはありません
        </Text>
      ) : (
        <Text style={[styles.hint, { color: themeColors.textSub }]}>
          データを取得中...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  loader: {
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
  hint: {
    fontSize: 13,
    paddingVertical: 2,
  },
  chipRow: {
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  chipValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
});
