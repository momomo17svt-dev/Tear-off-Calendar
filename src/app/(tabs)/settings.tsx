import React, { useState, useEffect } from 'react';
import {
  Dimensions,
  StyleSheet,
  View,
  Switch,
  Alert,
  ScrollView,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_IMAGE_ASPECT = (SCREEN_WIDTH * 0.88) / (SCREEN_HEIGHT * 0.70 * 0.36);
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useSettingsStore } from '@/store/settingsStore';
import { useNativeCalendarStore } from '@/store/nativeCalendarStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getThemeColors, getBackgroundGradient } from '@/utils/theme';

const THEMES = [
  { key: 'washi',      label: '和紙',  emoji: '📄', colors: ['#FAF7F0', '#F0E8D8'] as [string, string] },
  { key: 'light-gray', label: 'グレー', emoji: '🩶', colors: ['#E8EDF2', '#D0D7E0'] as [string, string] },
  { key: 'corkboard',  label: 'コルク', emoji: '🪵', colors: ['#C89D7C', '#A0785A'] as [string, string] },
  { key: 'wood',       label: '木目',  emoji: '🌲', colors: ['#8D6E63', '#5D4037'] as [string, string] },
  { key: 'sakura',     label: '桜',    emoji: '🌸', colors: ['#FCEEF3', '#F9D0DF'] as [string, string] },
  { key: 'matcha',     label: '抹茶',  emoji: '🍵', colors: ['#D8EDD8', '#B8D4B0'] as [string, string] },
  { key: 'aizome',     label: '藍染',  emoji: '🫙', colors: ['#5B8DB8', '#3A6A96'] as [string, string] },
  { key: 'momiji',     label: '紅葉',  emoji: '🍁', colors: ['#EDA878', '#D4764A'] as [string, string] },
] as const;

export default function SettingsScreen() {
  const {
    isBgEnabled, bgUri, bgUris, bgMode, appTheme,
    isDarkMode,
    selectedCalendarIds,
    setBgEnabled, setBgUri, addBgUri, removeBgUri, setBgMode, setAppTheme,
    setDarkMode,
    setSelectedCalendarIds,
  } = useSettingsStore();

  const { availableCalendars, loadCalendars, fetchAll } = useNativeCalendarStore();

  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCalendars();
  }, []);

  const themeColors = getThemeColors(isDarkMode);

  const handleCalendarToggle = async (calendarId: string, enabled: boolean) => {
    let next: string[];
    if (selectedCalendarIds.length === 0) {
      // 空 = 全表示。OFFにする場合は他の全IDを選択状態にしてから対象を除外
      const allIds = availableCalendars.map((c) => c.id);
      next = enabled ? allIds : allIds.filter((id) => id !== calendarId);
    } else {
      next = enabled
        ? [...selectedCalendarIds, calendarId]
        : selectedCalendarIds.filter((id) => id !== calendarId);
    }
    await setSelectedCalendarIds(next);
    await fetchAll();
  };

  const isCalendarEnabled = (calendarId: string) => {
    if (selectedCalendarIds.length === 0) return true;
    return selectedCalendarIds.includes(calendarId);
  };

  const pickImage = async () => {
    try {
      setIsLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const sourceUri = result.assets[0].uri;
        const filename = `bg_${Date.now()}.jpg`;
        // eslint-disable-next-line import/namespace
        const destUri = FileSystem.documentDirectory + filename;
        await FileSystem.copyAsync({ from: sourceUri, to: destUri });
        await addBgUri(destUri);
      }
    } catch {
      Alert.alert('エラー', '画像の設定に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = (uri: string) => {
    Alert.alert('確認', 'この画像を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeBgUri(uri) },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.cardBg }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── ヘッダー ── */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: themeColors.textMain }]}>設定</Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSub }]}>カレンダーをカスタマイズ</Text>
        </View>

        {/* ── ダークモード ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>🌙 ダークモード</Text>
              <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>目に優しい配色に切り替えます</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#d1d5db', true: '#30d158' }}
              thumbColor={isDarkMode ? '#ffffff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* ── 表示するカレンダー ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>📋 表示するカレンダー</Text>
          <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>ホーム画面に表示する予定のカレンダーを選択</Text>

          {availableCalendars.length === 0 ? (
            <View style={styles.calendarEmptyState}>
              <Text style={styles.calendarEmptyText}>カレンダーが見つかりません</Text>
              <Text style={styles.calendarEmptyHint}>カレンダーへのアクセス許可が必要です</Text>
            </View>
          ) : (
            <View style={styles.calendarList}>
              {availableCalendars.map((cal) => (
                <View key={cal.id} style={[styles.calendarRow, { borderBottomColor: themeColors.border }]}>
                  <View style={[styles.calendarDot, { backgroundColor: cal.color }]} />
                  <Text style={[styles.calendarName, { color: themeColors.textMain }]} numberOfLines={1}>{cal.title}</Text>
                  <Switch
                    value={isCalendarEnabled(cal.id)}
                    onValueChange={(v) => handleCalendarToggle(cal.id, v)}
                    trackColor={{ false: '#d1d5db', true: '#a5f3fc' }}
                    thumbColor={isCalendarEnabled(cal.id) ? '#0a7ea4' : '#9ca3af'}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── 背景テーマ ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>🎨 背景テーマ</Text>
          <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>画像が未設定の場合に適用されます</Text>

          <View style={styles.themeGrid}>
            {THEMES.map((theme) => {
              const isActive = appTheme === theme.key;
              return (
                <TouchableOpacity
                  key={theme.key}
                  style={[styles.themeCard, isActive && styles.themeCardActive]}
                  onPress={() => setAppTheme(theme.key)}
                  activeOpacity={0.75}
                >
                  <LinearGradient
                    colors={getBackgroundGradient(theme.key, isDarkMode)}
                    style={styles.themePreview}
                  >
                    <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                  </LinearGradient>
                  <Text style={[styles.themeLabel, isActive && styles.themeLabelActive]}>
                    {theme.label}
                  </Text>
                  {isActive && (
                    <View style={styles.themeCheckmark}>
                      <IconSymbol name="checkmark.circle.fill" size={18} color="#0a7ea4" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 背景画像 ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>🖼️ 背景画像</Text>
              <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>カレンダーに写真を設定</Text>
            </View>
            <Switch
              value={isBgEnabled}
              onValueChange={setBgEnabled}
              trackColor={{ false: '#d1d5db', true: '#a5f3fc' }}
              thumbColor={isBgEnabled ? '#0a7ea4' : '#9ca3af'}
            />
          </View>

          {isBgEnabled && (
            <>
              {/* 表示モード */}
              <View style={styles.modeContainer}>
                <Text style={[styles.modeLabel, { color: themeColors.textMain }]}>表示モード</Text>
                <View style={styles.modeSelector}>
                  {(['fixed', 'random'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.modeButton, bgMode === mode && styles.modeButtonActive]}
                      onPress={() => setBgMode(mode)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modeText, bgMode === mode && styles.modeTextActive]}>
                        {mode === 'fixed' ? '📌 固定' : '🎲 ランダム'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 画像グリッド */}
              <View style={styles.imageSection}>
                <View style={styles.imageSectionHeader}>
                  <Text style={[styles.imageCount, { color: themeColors.textSub }]}>
                    {bgUris.length > 0 ? `${bgUris.length}枚の画像` : '画像がありません'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.addButton, isLoading && styles.addButtonDisabled]}
                    onPress={pickImage}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <IconSymbol name="plus" size={16} color="#fff" />
                        <Text style={styles.addButtonText}>追加</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {bgUris.length === 0 ? (
                  <View style={styles.emptyImageState}>
                    <Text style={styles.emptyImageIcon}>📷</Text>
                    <Text style={[styles.emptyImageText, { color: themeColors.textSub }]}>画像がありません</Text>
                    <Text style={[styles.emptyImageHint, { color: themeColors.textSub, opacity: 0.7 }]}>「追加」ボタンから写真を選んでください</Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {bgUris.map((uri) => {
                      const isSelected = bgMode === 'fixed' && bgUri === uri;
                      return (
                        <TouchableOpacity
                          key={uri}
                          style={[styles.gridItem, isSelected && styles.gridItemSelected]}
                          onPress={() => {
                            if (bgMode === 'fixed') setBgUri(uri);
                          }}
                          activeOpacity={0.85}
                        >
                          <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" />

                          {isSelected && (
                            <View style={styles.selectedOverlay}>
                              <IconSymbol
                                name="checkmark.circle.fill"
                                size={28}
                                color="#fff"
                              />
                            </View>
                          )}

                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleRemove(uri)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <IconSymbol name="xmark" size={10} color="#fff" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* ── アプリ情報 ── */}
        <View style={[styles.section, styles.aboutSection, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Text style={[styles.appName, { color: themeColors.textMain }]}>📅 日めくりカレンダー</Text>
          <Text style={[styles.appVersion, { color: themeColors.textSub }]}>Version 1.0.0</Text>
          <Text style={[styles.appDesc, { color: themeColors.textSub }]}>
            毎日の予定を、お気に入りの写真と一緒に。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '400',
    marginBottom: 14,
  },
  // ── カレンダー ──
  calendarEmptyState: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  calendarEmptyText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  calendarEmptyHint: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  calendarList: {
    gap: 6,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  calendarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  calendarName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  // ── テーマ ──
  themeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 0,
  },
  themeCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'visible',
    borderWidth: 2.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  themeCardActive: {
    borderColor: '#0a7ea4',
  },
  themePreview: {
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeEmoji: {
    fontSize: 24,
  },
  themeLabel: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  themeLabelActive: {
    color: '#0a7ea4',
    fontWeight: '700',
  },
  themeCheckmark: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  // ── 表示モード ──
  modeContainer: {
    marginBottom: 20,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  modeButtonActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  modeText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  imageSection: {
    marginTop: 4,
  },
  imageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  imageCount: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  addButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyImageState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyImageIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyImageText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptyImageHint: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '46%',
    aspectRatio: CARD_IMAGE_ASPECT,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  gridItemSelected: {
    borderColor: '#0a7ea4',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,126,164,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
    fontWeight: '500',
  },
  appDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
});
