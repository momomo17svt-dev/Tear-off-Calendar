/**
 * ホーム画面：日めくりカレンダー
 * 指で紙を破るような物理アニメーションと、その日の予定表示を組み合わせた
 * アプリのメインインターフェースです。
 */
import * as Calendar from 'expo-calendar';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNativeCalendarStore } from '@/store/nativeCalendarStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { NativeCalendarEvent } from '@/types/event';
import { getBackgroundGradient, getThemeColors } from '@/utils/theme';

// ── 画面レイアウト用の定数 ────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.88;        // カードの横幅
const CARD_HEIGHT = SCREEN_HEIGHT * 0.70;       // カードの縦幅
const IMAGE_HEADER_H = CARD_HEIGHT * 0.50;     // 背景画像がある時のヘッダーの高さ
const NO_IMAGE_HEADER_H = CARD_HEIGHT * 0.45;  // 画像がない時のヘッダーの高さ
const BINDING_H = 32;                          // カレンダー上部の「綴じ代」部分の高さ

const DAY_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const MAX_COLLAPSED_EVENTS = 3;                // 初期状態で表示する予定の最大数（これを超えると「もっと見る」）

/**
 * 曜日に応じたテキスト色を取得する
 * 日曜は赤、土曜は青、平日はテーマ色を返します。
 */
const getDayColor = (day: number, isDarkMode: boolean) => {
  if (day === 0) return '#e63946'; // Sunday
  if (day === 6) return '#2563eb'; // Saturday
  return isDarkMode ? '#FFFFFF' : '#1a1a2e';
};

/**
 * 日付オブジェクトを YYYY-MM-DD 形式の文字列に変換
 */
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * 日付オブジェクトから時刻（HH:mm）を抽出
 */
const formatTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

// ── 予定 1 件分のコンポーネント ──────────────────────────────────────────
function EventItem({ event, onPress, isDarkMode }: { event: NativeCalendarEvent; onPress: (e: NativeCalendarEvent) => void; isDarkMode: boolean }) {
  const themeColors = getThemeColors(isDarkMode);
  return (
    <TouchableOpacity
      style={[
        styles.eventTag,
        { backgroundColor: `${event.calendarColor}1A`, borderLeftColor: event.calendarColor },
      ]}
      onPress={() => onPress(event)}
      activeOpacity={0.7}
    >
      <Text style={styles.eventIcon}>📅</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.eventText, { color: themeColors.textMain }]}
          numberOfLines={1}
        >
          {event.title}
        </Text>
        {!event.isAllDay && (
          <Text style={[styles.eventTime, { color: themeColors.textSub }]}>{formatTime(event.startDate)}</Text>
        )}
      </View>
      <Text style={[styles.eventChevron, { color: themeColors.border }]}>›</Text>
    </TouchableOpacity>
  );
}

// ── 予定リストの表示コンポーネント ───────────────────────────────────────
function EventList({
  events,
  onEventPress,
  availableHeight,
  isDarkMode,
}: {
  events: NativeCalendarEvent[];
  onEventPress: (e: NativeCalendarEvent) => void;
  availableHeight: number;
  isDarkMode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const themeColors = getThemeColors(isDarkMode);

  // 予定がない時の表示
  if (events.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyIcon, { color: themeColors.emptyStateIcon }]}>📅</Text>
        <Text style={[styles.noEventsText, { color: themeColors.textSub }]}>予定はありません</Text>
        <Text style={[styles.noEventsHint, { color: themeColors.border }]}>＋ から予定を追加できます</Text>
      </View>
    );
  }

  // 表示件数の制御（折りたたみ機能）
  const visibleEvents = expanded ? events : events.slice(0, MAX_COLLAPSED_EVENTS);
  const hiddenCount = events.length - MAX_COLLAPSED_EVENTS;

  return (
    <ScrollView
      style={{ maxHeight: availableHeight - (events.length > MAX_COLLAPSED_EVENTS ? 32 : 0) }}
      contentContainerStyle={styles.eventScrollContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      {visibleEvents.map((evt) => (
        <EventItem key={evt.id} event={evt} onPress={onEventPress} isDarkMode={isDarkMode} />
      ))}

      {events.length > MAX_COLLAPSED_EVENTS && (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.expandButtonText}>
            {expanded ? '▲ 折りたたむ' : `▼ あと ${hiddenCount} 件を表示`}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── Android 用の操作メニュー（ActionSheet） ──────────────────────────────
function EventActionSheet({
  event,
  onClose,
  onEdit,
  onDelete,
  isDarkMode,
}: {
  event: NativeCalendarEvent | null;
  onClose: () => void;
  onEdit: (e: NativeCalendarEvent) => void;
  onDelete: (e: NativeCalendarEvent) => void;
  isDarkMode: boolean;
}) {
  if (!event) return null;
  const themeColors = getThemeColors(isDarkMode);
  return (
    <TouchableOpacity style={styles.sheetOverlay} onPress={onClose} activeOpacity={1}>
      <View style={[styles.sheetContainer, { backgroundColor: themeColors.cardBg }]}>
        <View style={[styles.sheetHandle, { backgroundColor: isDarkMode ? '#48484A' : '#d1d5db' }]} />
        <Text style={[styles.sheetTitle, { color: themeColors.textMain }]} numberOfLines={2}>
          📅 {event.title}
        </Text>
        <Text style={[styles.sheetDate, { color: themeColors.textSub }]}>
          {toDateStr(event.startDate)}{!event.isAllDay ? ` ${formatTime(event.startDate)}` : ''}
        </Text>
        <View style={[styles.sheetDivider, { backgroundColor: themeColors.border }]} />
        <TouchableOpacity
          style={styles.sheetAction}
          onPress={() => { onClose(); onEdit(event); }}
        >
          <Text style={styles.sheetActionIcon}>✏️</Text>
          <Text style={[styles.sheetActionText, { color: themeColors.textMain }]}>編集する</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sheetAction, styles.sheetActionDanger]}
          onPress={() => { onClose(); onDelete(event); }}
        >
          <Text style={styles.sheetActionIcon}>🗑️</Text>
          <Text style={[styles.sheetActionText, styles.sheetActionTextDanger]}>削除する</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sheetCancel, { backgroundColor: isDarkMode ? '#2C2C2E' : '#f1f5f9' }]} onPress={onClose}>
          <Text style={[styles.sheetCancelText, { color: themeColors.textSub }]}>キャンセル</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── ホーム画面メインコンポーネント ──────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  // ストアから設定とカレンダーデータを取得
  const { isBgEnabled, bgUri: fixedBgUri, bgUris, bgMode, appTheme, isDarkMode } = useSettingsStore();
  const { getEventsForDate, removeEvent } = useNativeCalendarStore();
  useNativeCalendarStore((state) => state.eventsByDate); // 更新監視用

  const themeColors = getThemeColors(isDarkMode);

  // ナビゲーションストア（日付ジャンプ用）
  const { jumpDate, setJumpDate } = useNavigationStore();

  const today = new Date();
  /**
   * カレンダーの「3枚の紙」の状態管理
   * 物理的に紙を破って「次」を出すため、常に前後1日のデータを保持します。
   */
  const [currentDateObj, setCurrentDateObj] = useState(today);
  const [prevDateObj, setPrevDateObj] = useState(() => { const d = new Date(today); d.setDate(d.getDate() - 1); return d; });
  const [nextDateObj, setNextDateObj] = useState(() => { const d = new Date(today); d.setDate(d.getDate() + 1); return d; });
  const [selectedEvent, setSelectedEvent] = useState<NativeCalendarEvent | null>(null);

  // 月間カレンダー等から日付ジャンプが要求された時の処理
  useEffect(() => {
    if (jumpDate) {
      const [y, m, d] = jumpDate.split('-').map(Number);
      setCurrentDateObj(new Date(y, m - 1, d));
      setJumpDate(null);
    }
  }, [jumpDate, setJumpDate]);

  // 画面フォーカス時に最新の予定を再フェッチ（他アプリでの変更反映用）
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        useNativeCalendarStore.getState().fetchAll();
      }
    }, [])
  );

  const pan = useRef(new Animated.ValueXY()).current; // 指の動き（y座標）を記録
  const lastDateRef = useRef(currentDateObj);

  // 日付が切り替わった際のクリーンアップと隣接日の更新
  useEffect(() => {
    if (lastDateRef.current.getTime() !== currentDateObj.getTime()) {
      lastDateRef.current = currentDateObj;
      pan.setValue({ x: 0, y: 0 }); // アニメーション座標をリセット
      setNextDateObj(() => { const d = new Date(currentDateObj); d.setDate(d.getDate() + 1); return d; });
      setPrevDateObj(() => { const d = new Date(currentDateObj); d.setDate(d.getDate() - 1); return d; });
    }
  }, [currentDateObj, pan]);

  /**
   * 紙を破るジェスチャーの制御
   */
  const panResponder = useRef(
    PanResponder.create({
      // 垂直方向に一定以上動かした場合のみジェスチャーを開始
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      
      // 指の動きに Animated 値を連動させる
      onPanResponderMove: Animated.event([null, { dy: pan.y }], { useNativeDriver: false }),
      
      onPanResponderRelease: (_, gs) => {
        // 下に 120px 以上スワイプ ➔ 「今日」の紙を破り捨てて「明日」へ
        if (gs.dy > 120) {
          Animated.timing(pan.y, { toValue: 900, duration: 260, useNativeDriver: true }).start(() => {
            setCurrentDateObj((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d; });
          });
        } 
        // 上に 120px 以上スワイプ ➔ 「昨日」の紙を引っ張って戻す
        else if (gs.dy < -120) {
          Animated.timing(pan.y, { toValue: -900, duration: 260, useNativeDriver: true }).start(() => {
            setCurrentDateObj((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d; });
          });
        } 
        // 勢いが足りなければ元の位置にバネで戻る
        else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 10 }).start();
        }
      },
    })
  ).current;

  /**
   * アニメーションの補間（Interpolation）設定
   * スワイプの深さに応じて、カードの傾き（Rotate）や透明度などを変化させます。
   */
  const currentTranslateY = pan.y.interpolate({ inputRange: [0, 900], outputRange: [0, 900], extrapolate: 'clamp' });
  const currentRotateZ = pan.y.interpolate({ inputRange: [0, 900], outputRange: ['0deg', '14deg'], extrapolate: 'clamp' });
  const prevTranslateY = pan.y.interpolate({ inputRange: [-900, 0], outputRange: [0, 900], extrapolate: 'clamp' });
  const prevRotateZ = pan.y.interpolate({ inputRange: [-900, 0], outputRange: ['0deg', '-14deg'], extrapolate: 'clamp' });

  // 背景画像のURIを取得（固定モード or 日替わりランダムモード）
  const getBgUri = (dObj: Date) => {
    if (!isBgEnabled || bgUris.length === 0) return null;
    if (bgMode === 'fixed') return fixedBgUri || bgUris[0];
    const seed = dObj.getFullYear() * 10000 + (dObj.getMonth() + 1) * 100 + dObj.getDate();
    return bgUris[seed % bgUris.length];
  };

  /**
   * 予定をタップした際のメニュー表示（iOS: 標準ActionSheet, Android: カスタム）
   */
  const handleEventPress = useCallback((evt: NativeCalendarEvent) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: evt.title,
          message: toDateStr(evt.startDate),
          options: ['キャンセル', '✏️ 編集する', '🗑️ 削除する'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        async (idx) => {
          if (idx === 1) {
            try {
              await Calendar.editEventInCalendarAsync({ id: evt.id });
            } catch {
              Alert.alert('予定が見つかりません', 'この予定はすでに削除されています。');
            }
            useNativeCalendarStore.getState().fetchAll();
          }
          if (idx === 2) handleDelete(evt);
        }
      );
    } else {
      setSelectedEvent(evt);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 削除実行
  const handleDelete = (evt: NativeCalendarEvent) => {
    Alert.alert('削除の確認', `「${evt.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeEvent(evt.id, toDateStr(evt.startDate)) },
    ]);
  };

  // 編集実行
  const handleEdit = async (evt: NativeCalendarEvent) => {
    try {
      await Calendar.editEventInCalendarAsync({ id: evt.id });
    } catch {
      Alert.alert('予定が見つかりません', 'この予定はすでに削除されています。');
    }
    useNativeCalendarStore.getState().fetchAll();
  };

  /**
   * 個別のカレンダーカードを描画する
   * 背景画像、日付情報、予定リストを一つのカードにまとめます。
   */
  const renderCard = (dObj: Date) => {
    const year = dObj.getFullYear();
    const month = dObj.getMonth() + 1;
    const date = dObj.getDate();
    const dateStr = toDateStr(dObj);
    const dayStr = DAY_OF_WEEK[dObj.getDay()];
    const todayFlag = toDateStr(dObj) === toDateStr(today);
    const dayColor = getDayColor(dObj.getDay(), isDarkMode);
    const bgUri = getBgUri(dObj);
    const events = getEventsForDate(dateStr);

    const imageH = bgUri ? IMAGE_HEADER_H : NO_IMAGE_HEADER_H;
    const eventsAreaH = CARD_HEIGHT - BINDING_H - imageH - 70;

    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    return (
      <View style={[styles.cardInner, { height: CARD_HEIGHT, backgroundColor: themeColors.cardBg }]}>

        {/* カード上部：カレンダーの「綴じ代」とパンチ穴の演出 */}
        <View style={[styles.bindingContainer, { backgroundColor: themeColors.binding, borderBottomColor: themeColors.border }]}>
          {[1, 2, 3, 4, 5, 6].map((i) => <View key={i} style={[styles.hole, { backgroundColor: isDarkMode ? '#111' : '#2c2c2c' }]} />)}
        </View>

        {/* メインエリア：背景画像（またはテーマ色）と日付表示 */}
        {bgUri ? (
          <View style={[styles.imageHeader, { height: imageH }]}>
            <Image source={{ uri: bgUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)']}
              style={[styles.imageGradient, { height: imageH * 0.65 }]}
            />
            <View style={styles.dateOnPhoto}>
              {todayFlag && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>TODAY</Text>
                </View>
              )}
              <Text style={styles.monthDayOnPhoto}>{month}月{date}日</Text>
              <Text style={styles.dayOfWeekOnPhoto}>{dayStr}曜日</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.noImageHeader, { height: imageH }]}>
            <LinearGradient colors={getBackgroundGradient(appTheme, isDarkMode)} style={StyleSheet.absoluteFill} />
            <View style={styles.dateOnNoImage}>
              {todayFlag && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>TODAY</Text>
                </View>
              )}
              <Text style={[styles.yearMonth, { color: isDarkMode ? '#bbb' : '#888' }]}>{year}年 {month}月</Text>
              <Text style={[styles.day, { color: dayColor }]}>{date}</Text>
              <Text style={[styles.dayOfWeek, { color: dayColor }]}>{dayStr}曜日</Text>
            </View>
          </View>
        )}

        {/* 下部：スケジュール表示エリア */}
        <View style={[styles.eventsSection, { flex: 1, backgroundColor: themeColors.scheduleSection }]}>
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleAccent} />
            <Text style={[styles.scheduleLabel, { color: themeColors.textSub }]}>SCHEDULE</Text>
          </View>
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <EventList
              events={events}
              onEventPress={handleEventPress}
              availableHeight={eventsAreaH}
              isDarkMode={isDarkMode}
            />
          </View>
          {/* 装飾用の英語月名と年 */}
          <Text style={[styles.monthLabel, { color: themeColors.border }]}>{MONTHS[month - 1]} {year}</Text>
        </View>

      </View>
    );
  };

  const bgGrad = getBackgroundGradient(appTheme, isDarkMode);

  /**
   * 最終的な画面の描画
   * Zインデックス（重なり順）を意識した3層構造になっています。
   */
  return (
    <LinearGradient colors={bgGrad} style={styles.container} {...panResponder.panHandlers}>
      <View style={[styles.inner, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 88 }]}>

        {/* 第1層（最背面）：明日（またはスワイプで出てくる次）のカード */}
        <Animated.View style={[styles.card, styles.absolute, styles.shadow]}>
          {renderCard(nextDateObj)}
        </Animated.View>

        {/* 第2層（前面）：今日（現在表示中）のカード。指の動きに合わせて動く */}
        <Animated.View style={[styles.card, styles.absolute, styles.shadow,
        { transform: [{ translateY: currentTranslateY }, { rotateZ: currentRotateZ }] }]}>
          {renderCard(currentDateObj)}
        </Animated.View>

        {/* 第3層（最前面）：昨日（戻す時に使う）のカード。普段は画面外に待機 */}
        <Animated.View
          style={[styles.card, styles.absolute, styles.shadow,
          { transform: [{ translateY: prevTranslateY }, { rotateZ: prevRotateZ }] }]}
          pointerEvents="none"
        >
          {renderCard(prevDateObj)}
        </Animated.View>

      </View>

      {/* Android 専用のアクションメニュー（iOSはネイティブのActionSheetを使用） */}
      {Platform.OS !== 'ios' && (
        <EventActionSheet
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isDarkMode={isDarkMode}
        />
      )}
    </LinearGradient>
  );
}

// ── スタイル定義 ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  absolute: { position: 'absolute' },
  // 本物の紙が浮いているような影の演出
  shadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },

  cardInner: { width: '100%', flexDirection: 'column' },

  // カレンダーの綴じ部分
  bindingContainer: {
    height: BINDING_H,
    backgroundColor: '#f1f3f5',
    flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0',
    paddingHorizontal: 24,
  },
  hole: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#2c2c2c',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 3, elevation: 3,
  },

  imageHeader: { width: '100%', overflow: 'hidden', position: 'relative' },
  noImageHeader: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  imageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0 },

  // 写真の上に表示される日付のスタイル
  dateOnPhoto: {
    position: 'absolute', bottom: 16, right: 16, alignItems: 'flex-end',
  },
  monthDayOnPhoto: {
    fontSize: 48, fontWeight: '700', fontStyle: 'italic', color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6, letterSpacing: -1,
  },
  dayOfWeekOnPhoto: {
    fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.88)',
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // 画像がない場合の日付のスタイル
  dateOnNoImage: { alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 20 },
  todayBadge: {
    backgroundColor: '#e63946', paddingHorizontal: 10,
    paddingVertical: 2, borderRadius: 20, marginBottom: 2,
  },
  todayBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  yearMonth: { fontSize: 14, fontWeight: '600', color: '#888', letterSpacing: 0.5 },
  day: { fontWeight: '800', fontSize: 90, letterSpacing: -2, lineHeight: 96 },
  dayOfWeek: { fontSize: 22, fontWeight: '700', marginLeft: 6 },

  // 予定表示セクション（和紙のような背景色を設定可能）
  eventsSection: {
    width: '100%', paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: '#F5EFE6',
  },
  scheduleHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 14, paddingBottom: 10,
  },
  scheduleAccent: { width: 28, height: 2, backgroundColor: '#e63946', borderRadius: 1 },
  scheduleLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 2 },
  monthLabel: {
    fontSize: 10, fontWeight: '600', color: '#bbb',
    letterSpacing: 2, textAlign: 'right', paddingTop: 4,
  },
  eventScrollContent: { paddingBottom: 4 },

  eventTag: {
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    marginBottom: 5, gap: 8,
  },
  eventIcon: { fontSize: 14 },
  eventText: { fontSize: 13, fontWeight: '600' },
  eventTime: { fontSize: 11, color: '#888', marginTop: 1 },
  eventChevron: { fontSize: 16, color: '#ccc', fontWeight: '300' },

  expandButton: { alignItems: 'center', paddingVertical: 5 },
  expandButtonText: { fontSize: 12, color: '#0a7ea4', fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  emptyIcon: { fontSize: 24, marginBottom: 2 },
  noEventsText: { fontSize: 13, color: '#aaa', fontWeight: '500' },
  noEventsHint: { fontSize: 11, color: '#ccc' },

  // モーダル・アクションシート（Android用）のスタイル
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end', zIndex: 100,
  },
  sheetContainer: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: '#d1d5db',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  sheetDate: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0', marginBottom: 8 },
  sheetAction: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderRadius: 12, paddingHorizontal: 8,
  },
  sheetActionDanger: { marginTop: 4 },
  sheetActionIcon: { fontSize: 20 },
  sheetActionText: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  sheetActionTextDanger: { color: '#e63946' },
  sheetCancel: {
    alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, backgroundColor: '#f1f5f9', marginTop: 8,
  },
  sheetCancelText: { fontSize: 16, fontWeight: '700', color: '#64748b' },
});
