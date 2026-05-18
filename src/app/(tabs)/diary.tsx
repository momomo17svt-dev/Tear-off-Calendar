/**
 * 日記タブ
 * - 上部: 現在選択中の日付（navigationStore.selectedDate と連動）
 * - 検索バー: タイトル / タグでの絞り込み
 * - リスト: その日付の日記を新しい順、または検索結果
 * - FAB: 新規作成（modal-diary を選択日付付きで開く）
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiaryCard } from '@/components/DiaryCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useDiaryStore } from '@/store/diaryStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Diary } from '@/types/diary';
import {
  DiaryPhotoSuggestion,
  ensurePhotoPermission,
  getPhotosForDate,
} from '@/utils/diaryImages';
import { toDateString } from '@/utils/nativeCalendar';
import { getBackgroundGradient, getThemeColors } from '@/utils/theme';

const DAY_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * "YYYY-MM-DD" を「2026年5月17日 (土)」形式の見出しに整形する
 */
function formatDateHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  return `${y}年${m}月${d}日 (${DAY_OF_WEEK[date.getDay()]})`;
}

export default function DiaryScreen() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, appTheme } = useSettingsStore();
  const themeColors = getThemeColors(isDarkMode);
  const gradient = getBackgroundGradient(appTheme, isDarkMode);

  // ナビゲーションストアから「選択中の日付」を購読
  const selectedDate = useNavigationStore((s) => s.selectedDate);

  // 日記ストア
  const diariesByDate = useDiaryStore((s) => s.diariesByDate);
  const searchQuery = useDiaryStore((s) => s.searchQuery);
  const searchResults = useDiaryStore((s) => s.searchResults);
  const isSearching = useDiaryStore((s) => s.isSearching);
  const setSearchQuery = useDiaryStore((s) => s.setSearchQuery);
  const runSearch = useDiaryStore((s) => s.runSearch);
  const clearSearch = useDiaryStore((s) => s.clearSearch);
  const fetchAll = useDiaryStore((s) => s.fetchAll);

  // 画面復帰のたびに最新を反映（他経路で追加・編集された場合の追従用）
  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  // 検索クエリのデバウンス（300ms）
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!searchQuery.trim()) {
      // 空クエリは即時にクリア（待たない）
      runSearch();
      return;
    }
    debounceTimer.current = setTimeout(() => {
      runSearch();
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery, runSearch]);

  const isSearchMode = searchQuery.trim().length > 0;
  const listData = useMemo<Diary[]>(() => {
    if (isSearchMode) return searchResults;
    return diariesByDate[selectedDate] ?? [];
  }, [isSearchMode, searchResults, diariesByDate, selectedDate]);

  const handleNew = useCallback(() => {
    // expo-router の typed routes は新規ルート生成が dev サーバー起動時のため、ここはキャストで回避
    router.push({ pathname: '/modal-diary', params: { dateStr: selectedDate } } as unknown as Href);
  }, [selectedDate]);

  const handleCardPress = useCallback((diary: Diary) => {
    router.push({ pathname: '/modal-diary', params: { id: String(diary.id) } } as unknown as Href);
  }, []);

  const handleClearSearch = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  // ── 「この日の写真」サジェスト ──────────────────────────────
  const [suggestions, setSuggestions] = useState<DiaryPhotoSuggestion[]>([]);
  const [suggestionsState, setSuggestionsState] = useState<
    'idle' | 'loading' | 'denied' | 'granted' | 'limited' | 'empty'
  >('idle');

  /**
   * 選択日の写真を MediaLibrary から取得する。日付変更/フォーカス復帰時に呼ばれる。
   * 検索モード中はリスト表示と関心が違うので非表示にしたいが、エリア自体は残す方針。
   */
  const loadSuggestions = useCallback(async () => {
    setSuggestionsState('loading');
    const perm = await ensurePhotoPermission();
    if (!perm.granted) {
      setSuggestions([]);
      setSuggestionsState('denied');
      return;
    }
    const photos = await getPhotosForDate(selectedDate);
    setSuggestions(photos);
    if (photos.length === 0) {
      setSuggestionsState(perm.accessPrivileges === 'limited' ? 'limited' : 'empty');
    } else {
      setSuggestionsState(perm.accessPrivileges === 'limited' ? 'limited' : 'granted');
    }
  }, [selectedDate]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // 設定画面で権限を変更してきた場合に追従させるため、フォーカス復帰時にも再取得
  useFocusEffect(
    useCallback(() => {
      loadSuggestions();
    }, [loadSuggestions])
  );

  /**
   * サジェスト写真をタップ → 新規日記モーダルをその写真付きで開く
   */
  const handleSuggestionPress = useCallback(
    (asset: DiaryPhotoSuggestion) => {
      router.push({
        pathname: '/modal-diary',
        params: {
          dateStr: selectedDate,
          prefillAssetId: asset.id,
          prefillAssetUri: asset.uri,
        },
      } as unknown as Href);
    },
    [selectedDate]
  );

  /** 設定タブへの誘導（権限なし時のスタブから） */
  const handleGoToSettings = useCallback(() => {
    router.push('/(tabs)/settings' as unknown as Href);
  }, []);

  // ── 日付変更ロジック ──────────────────────────────────────────
  const setSelectedDate = useNavigationStore((s) => s.setSelectedDate);
  const setJumpDate = useNavigationStore((s) => s.setJumpDate);
  const [showDatePicker, setShowDatePicker] = useState(false);

  /** 選択日付を Date オブジェクトとして取得（ピッカーの初期値に使う） */
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  /**
   * 日付を変更する共通処理。
   * navigationStore.selectedDate を更新しつつ、ホーム画面の日付も追従させるために jumpDate もセット。
   */
  const changeSelectedDate = useCallback(
    (next: Date) => {
      const nextStr = toDateString(next);
      if (nextStr === selectedDate) return;
      setSelectedDate(nextStr);
      // ホーム画面が次回フォーカス時に同じ日付へ移動するように予約
      setJumpDate(nextStr);
    },
    [selectedDate, setSelectedDate, setJumpDate]
  );

  const handlePrevDay = useCallback(() => {
    const d = new Date(selectedDateObj);
    d.setDate(d.getDate() - 1);
    changeSelectedDate(d);
  }, [selectedDateObj, changeSelectedDate]);

  const handleNextDay = useCallback(() => {
    const d = new Date(selectedDateObj);
    d.setDate(d.getDate() + 1);
    changeSelectedDate(d);
  }, [selectedDateObj, changeSelectedDate]);

  const handlePickerChange = useCallback(
    (d: Date) => {
      changeSelectedDate(d);
    },
    [changeSelectedDate]
  );

  const handleToday = useCallback(() => {
    changeSelectedDate(new Date());
  }, [changeSelectedDate]);

  const isToday = useMemo(() => selectedDate === toDateString(new Date()), [selectedDate]);

  return (
    <View style={styles.root}>
      {/* 背景グラデーション */}
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />

      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        {/* ── ヘッダー：日付と新規ボタン ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerLabelRow}>
              <Text style={[styles.headerLabel, { color: themeColors.textSub }]}>
                {isSearchMode ? '検索結果' : isToday ? '今日の日記' : '選択中の日付'}
              </Text>
              {!isSearchMode && !isToday && (
                <TouchableOpacity onPress={handleToday} hitSlop={6}>
                  <Text style={[styles.todayLink, { color: '#0a7ea4' }]}>今日へ</Text>
                </TouchableOpacity>
              )}
            </View>
            {!isSearchMode && (
              <View style={styles.dateNavRow}>
                <TouchableOpacity
                  style={[styles.dayNavButton, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}
                  onPress={handlePrevDay}
                  activeOpacity={0.7}
                  hitSlop={6}
                >
                  <Text style={[styles.dayNavText, { color: themeColors.textMain }]}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                  style={styles.dateButton}
                >
                  <Text style={[styles.headerDate, { color: themeColors.textMain }]}>
                    {formatDateHeading(selectedDate)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dayNavButton, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}
                  onPress={handleNextDay}
                  activeOpacity={0.7}
                  hitSlop={6}
                >
                  <Text style={[styles.dayNavText, { color: themeColors.textMain }]}>›</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.newButton}
            onPress={handleNew}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#0ea5e9', '#0a7ea4']} style={styles.newButtonGradient}>
              <Text style={styles.newButtonText}>＋ 新規</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── 日付ピッカー ── */}
        <DiaryDatePicker
          visible={showDatePicker}
          date={selectedDateObj}
          onChange={handlePickerChange}
          onClose={() => setShowDatePicker(false)}
          isDarkMode={isDarkMode}
        />

        {/* ── 検索バー ── */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: themeColors.cardBg, borderColor: themeColors.border },
          ]}
        >
          <IconSymbol name="magnifyingglass" size={18} color={themeColors.textSub} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.textMain }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="タイトルやタグで検索..."
            placeholderTextColor={isDarkMode ? '#555' : '#bbb'}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} hitSlop={8}>
              <IconSymbol name="xmark.circle.fill" size={18} color={themeColors.textSub} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── リスト本体 ── */}
        <FlatList
          style={styles.list}
          data={listData}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <DiaryCard
              diary={item}
              showDate={isSearchMode}
              isDarkMode={isDarkMode}
              onPress={handleCardPress}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📖</Text>
              <Text style={[styles.emptyTitle, { color: themeColors.textMain }]}>
                {isSearchMode
                  ? isSearching
                    ? '検索中...'
                    : '一致する日記がありません'
                  : 'この日の日記はまだありません'}
              </Text>
              {!isSearchMode && (
                <Text style={[styles.emptyHint, { color: themeColors.textSub }]}>
                  右上の「＋ 新規」から書き始めましょう
                </Text>
              )}
            </View>
          }
        />

        {/* ── 下部：この日の写真エリア（検索モード時は非表示） ── */}
        {!isSearchMode && (
          <View
            style={[
              styles.photoArea,
              {
                backgroundColor: themeColors.cardBg,
                borderColor: themeColors.border,
                paddingBottom: insets.bottom + 60, // タブバー（≒60）+ セーフエリア
              },
            ]}
          >
            <Text style={[styles.photoAreaLabel, { color: themeColors.textSub }]}>
              📷 この日の写真
              {(suggestionsState === 'granted' || suggestionsState === 'limited') &&
                ` (${suggestions.length})`}
            </Text>

            {suggestionsState === 'loading' ? (
              <Text style={[styles.photoAreaHint, { color: themeColors.textSub }]}>読み込み中...</Text>
            ) : suggestionsState === 'denied' ? (
              <TouchableOpacity onPress={handleGoToSettings} activeOpacity={0.7}>
                <Text style={[styles.photoAreaHint, { color: themeColors.textSub }]}>
                  写真へのアクセスが許可されていません。
                  <Text style={styles.photoAreaLink}>設定タブで許可する</Text>
                </Text>
              </TouchableOpacity>
            ) : suggestionsState === 'empty' ? (
              <Text style={[styles.photoAreaHint, { color: themeColors.textSub }]}>
                この日に撮影された写真はありません
              </Text>
            ) : suggestions.length === 0 && suggestionsState === 'limited' ? (
              <TouchableOpacity onPress={handleGoToSettings} activeOpacity={0.7}>
                <Text style={[styles.photoAreaHint, { color: themeColors.textSub }]}>
                  この日の写真は許可範囲に含まれていません。
                  <Text style={styles.photoAreaLink}>設定タブで変更する</Text>
                </Text>
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoRow}
              >
                {suggestions.map((asset) => (
                  <TouchableOpacity
                    key={asset.id}
                    onPress={() => handleSuggestionPress(asset)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: asset.uri }}
                      style={styles.photoThumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={0}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * 日記タブ用の日付ピッカー（iOS: 底からのスピナー / Android: 標準ダイアログ）。
 * modal-diary.tsx の DatePickerModal と同型のロジックだが、状態管理がシンプルで済むため
 * このファイル内に直接定義する。
 */
function DiaryDatePicker({
  visible,
  date,
  onChange,
  onClose,
  isDarkMode,
}: {
  visible: boolean;
  date: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
  isDarkMode: boolean;
}) {
  const themeColors = getThemeColors(isDarkMode);
  const [tempDate, setTempDate] = useState(date);

  useEffect(() => {
    if (visible) setTempDate(date);
  }, [visible, date]);

  if (Platform.OS === 'ios') {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity style={pickerStyles.overlay} onPress={onClose} activeOpacity={1}>
          <View style={[pickerStyles.container, { backgroundColor: themeColors.cardBg }]}>
            <View style={[pickerStyles.header, { borderBottomColor: themeColors.border }]}>
              <TouchableOpacity onPress={onClose}>
                <Text style={pickerStyles.cancel}>キャンセル</Text>
              </TouchableOpacity>
              <Text style={[pickerStyles.title, { color: themeColors.textMain }]}>日付を選択</Text>
              <TouchableOpacity
                onPress={() => {
                  onChange(tempDate);
                  onClose();
                }}
              >
                <Text style={pickerStyles.done}>完了</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              locale="ja-JP"
              onChange={(_, d) => {
                if (d) setTempDate(d);
              }}
              style={pickerStyles.spinner}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }
  if (!visible) return null;
  return (
    <DateTimePicker
      value={tempDate}
      mode="date"
      display="default"
      onChange={(_, d) => {
        onClose();
        if (d) onChange(d);
      }}
    />
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  container: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancel: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700' },
  done: { fontSize: 16, color: '#0a7ea4', fontWeight: '800' },
  spinner: { height: 200 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: { flex: 1, paddingRight: 8 },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  todayLink: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayNavButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  dateButton: {
    flexShrink: 1,
  },
  headerDate: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  newButton: { borderRadius: 12, overflow: 'hidden' },
  newButtonGradient: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 0 : 8,
  },

  list: { flex: 1 },
  listContent: { paddingTop: 4, paddingBottom: 12 },

  empty: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center' },

  // ── 下部の「この日の写真」エリア ──
  photoArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 12,
    marginHorizontal: -16, // 親の paddingHorizontal を相殺して画面幅いっぱい
  },
  photoAreaLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  photoAreaHint: {
    fontSize: 13,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  photoAreaLink: {
    color: '#0a7ea4',
    fontWeight: '700',
  },
  photoRow: { gap: 8, paddingHorizontal: 4 },
  photoThumb: { width: 64, height: 64, borderRadius: 10 },
});
