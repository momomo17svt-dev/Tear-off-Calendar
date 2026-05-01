import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  PanResponder,
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
  ScrollView,
  ActionSheetIOS,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { useSettingsStore } from '@/store/settingsStore';
import { useEventStore } from '@/store/eventStore';
import type { CalendarEvent } from '@/types/event';
import { exportEventToNativeCalendar } from '@/utils/nativeCalendar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.88;

/**
 * カードの固定高さ。
 * 全カードをこの高さで統一することでコンテンツ量による高さ差を排除する。
 * タブバー(~83px) + SafeAreaTop + スワイプヒント(~40px) + 上下マージン を差し引いた値。
 */
const CARD_HEIGHT = SCREEN_HEIGHT * 0.70;

/**
 * 画像ヘッダーの固定高さ (アスペクト比は固定しない — 高さで管理)
 * カード高さの 36% を画像に割り当てる。
 */
const IMAGE_HEADER_H = CARD_HEIGHT * 0.36;
/** 画像なし時のフォールバックヘッダー高さ (短め) */
const NO_IMAGE_HEADER_H = CARD_HEIGHT * 0.18;

/** バインダー高さ */
const BINDING_H = 32;

/** 日付セクションの固定高さ。予定リストに侵食されない。 */
const DATE_SECTION_H = 150;

const DAY_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const MAX_COLLAPSED_EVENTS = 3;

const getBackgroundGradient = (theme: string): [string, string] => {
  switch (theme) {
    case 'corkboard': return ['#C89D7C', '#A0785A'];
    case 'wood':      return ['#8D6E63', '#5D4037'];
    default:          return ['#E8EDF2', '#D0D7E0'];
  }
};

const getDayColor = (day: number) => {
  if (day === 0) return '#e63946';
  if (day === 6) return '#2563eb';
  return '#1a1a2e';
};

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ── 予定 1 件 ────────────────────────────────────────────────────────────
function EventItem({ event, onPress }: { event: CalendarEvent; onPress: (e: CalendarEvent) => void }) {
  const isBirthday = event.type === 'birthday';
  return (
    <TouchableOpacity
      style={[
        styles.eventTag,
        {
          backgroundColor: isBirthday ? 'rgba(255,107,107,0.10)' : 'rgba(78,205,196,0.10)',
          borderLeftColor: isBirthday ? '#ff6b6b' : '#4ecdc4',
        },
      ]}
      onPress={() => onPress(event)}
      activeOpacity={0.7}
    >
      <Text style={styles.eventIcon}>{isBirthday ? '🎂' : '📌'}</Text>
      <Text
        style={[styles.eventText, { color: isBirthday ? '#c0392b' : '#16a085' }]}
        numberOfLines={1}
      >
        {event.title}
      </Text>
      <Text style={styles.eventChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── 予定リスト ────────────────────────────────────────────────────────────
function EventList({
  events,
  onEventPress,
  availableHeight,
}: {
  events: CalendarEvent[];
  onEventPress: (e: CalendarEvent) => void;
  availableHeight: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📅</Text>
        <Text style={styles.noEventsText}>予定はありません</Text>
        <Text style={styles.noEventsHint}>＋ から予定を追加できます</Text>
      </View>
    );
  }

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
        <EventItem key={evt.id} event={evt} onPress={onEventPress} />
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

// ── Android カスタムボトムシート ─────────────────────────────────────────
function EventActionSheet({
  event,
  onClose,
  onEdit,
  onDelete,
  onExport,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (e: CalendarEvent) => void;
  onDelete: (e: CalendarEvent) => void;
  onExport: (e: CalendarEvent) => void;
}) {
  if (!event) return null;
  return (
    <TouchableOpacity style={styles.sheetOverlay} onPress={onClose} activeOpacity={1}>
      <View style={styles.sheetContainer}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle} numberOfLines={2}>
          {event.type === 'birthday' ? '🎂' : '📌'} {event.title}
        </Text>
        <Text style={styles.sheetDate}>{event.date}</Text>
        <View style={styles.sheetDivider} />
        {[
          { icon: '✏️', label: '編集する', action: () => { onClose(); onEdit(event); } },
          { icon: '📲', label: '端末カレンダーにエクスポート', action: () => { onClose(); onExport(event); } },
        ].map(({ icon, label, action }) => (
          <TouchableOpacity key={label} style={styles.sheetAction} onPress={action}>
            <Text style={styles.sheetActionIcon}>{icon}</Text>
            <Text style={styles.sheetActionText}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.sheetAction, styles.sheetActionDanger]}
          onPress={() => { onClose(); onDelete(event); }}
        >
          <Text style={styles.sheetActionIcon}>🗑️</Text>
          <Text style={[styles.sheetActionText, styles.sheetActionTextDanger]}>削除する</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetCancel} onPress={onClose}>
          <Text style={styles.sheetCancelText}>キャンセル</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── メイン ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isBgEnabled, bgUri: fixedBgUri, bgUris, bgMode, appTheme } = useSettingsStore();
  const { getEventsForDate, removeEvent } = useEventStore();
  useEventStore((state) => state.events);

  const today = new Date();
  const [currentDateObj, setCurrentDateObj] = useState(today);
  const [prevDateObj, setPrevDateObj] = useState(() => { const d = new Date(today); d.setDate(d.getDate() - 1); return d; });
  const [nextDateObj, setNextDateObj] = useState(() => { const d = new Date(today); d.setDate(d.getDate() + 1); return d; });
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const lastDateRef = useRef(currentDateObj);

  useEffect(() => {
    if (lastDateRef.current.getTime() !== currentDateObj.getTime()) {
      lastDateRef.current = currentDateObj;
      pan.setValue({ x: 0, y: 0 });
      setNextDateObj(() => { const d = new Date(currentDateObj); d.setDate(d.getDate() + 1); return d; });
      setPrevDateObj(() => { const d = new Date(currentDateObj); d.setDate(d.getDate() - 1); return d; });
    }
  }, [currentDateObj, pan]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: Animated.event([null, { dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120) {
          Animated.timing(pan.y, { toValue: 900, duration: 260, useNativeDriver: true }).start(() => {
            setCurrentDateObj((prev) => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d; });
          });
        } else if (gs.dy < -120) {
          Animated.timing(pan.y, { toValue: -900, duration: 260, useNativeDriver: true }).start(() => {
            setCurrentDateObj((prev) => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d; });
          });
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 10 }).start();
        }
      },
    })
  ).current;

  const currentTranslateY = pan.y.interpolate({ inputRange: [0, 900], outputRange: [0, 900], extrapolate: 'clamp' });
  const currentRotateZ   = pan.y.interpolate({ inputRange: [0, 900], outputRange: ['0deg', '14deg'], extrapolate: 'clamp' });
  const prevTranslateY   = pan.y.interpolate({ inputRange: [-900, 0], outputRange: [0, 900], extrapolate: 'clamp' });
  const prevRotateZ      = pan.y.interpolate({ inputRange: [-900, 0], outputRange: ['0deg', '-14deg'], extrapolate: 'clamp' });

  const getBgUri = (dObj: Date) => {
    if (!isBgEnabled || bgUris.length === 0) return null;
    if (bgMode === 'fixed') return fixedBgUri || bgUris[0];
    const seed = dObj.getFullYear() * 10000 + (dObj.getMonth() + 1) * 100 + dObj.getDate();
    return bgUris[seed % bgUris.length];
  };

  const handleEventPress = useCallback((evt: CalendarEvent) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: evt.title,
          message: evt.date,
          options: ['キャンセル', '✏️ 編集する', '📲 カレンダーへ', '🗑️ 削除する'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (idx) => {
          if (idx === 1) router.push({ pathname: '/modal', params: { eventId: String(evt.id) } });
          if (idx === 2) handleExport(evt);
          if (idx === 3) handleDelete(evt);
        }
      );
    } else {
      setSelectedEvent(evt);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = (evt: CalendarEvent) => {
    Alert.alert('削除の確認', `「${evt.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeEvent(evt.id) },
    ]);
  };

  const handleExport = async (evt: CalendarEvent) => {
    const id = await exportEventToNativeCalendar({ title: evt.title, dateStr: evt.date });
    if (id) Alert.alert('完了', '端末カレンダーにエクスポートしました ✓');
  };

  const handleEdit = (evt: CalendarEvent) => {
    router.push({ pathname: '/modal', params: { eventId: String(evt.id) } });
  };

  // ────────────────────────────────────────────────────────────────────────
  // カードレンダリング
  // ────────────────────────────────────────────────────────────────────────
  const renderCard = (dObj: Date) => {
    const year  = dObj.getFullYear();
    const month = dObj.getMonth() + 1;
    const date  = dObj.getDate();
    const dateStr   = toDateStr(dObj);
    const dayStr    = DAY_OF_WEEK[dObj.getDay()];
    const todayFlag = toDateStr(dObj) === toDateStr(today);
    const dayColor  = getDayColor(dObj.getDay());
    const bgUri     = getBgUri(dObj);
    const events    = getEventsForDate(dateStr);

    // 画像の有無でヘッダー高さを切り替える
    const imageH = bgUri ? IMAGE_HEADER_H : NO_IMAGE_HEADER_H;

    // 予定リストに使える高さ = カード高さ - バインダー - 画像 - 日付セクション - 内部padding
    const eventsAreaH = CARD_HEIGHT - BINDING_H - imageH - DATE_SECTION_H - 16;

    return (
      // ── カード全体: 高さ固定・overflow:hidden ──
      <View style={[styles.cardInner, { height: CARD_HEIGHT }]}>

        {/* ① バインダー穴（固定高さ） */}
        <View style={styles.bindingContainer}>
          {[1,2,3,4,5,6].map((i) => <View key={i} style={styles.hole} />)}
        </View>

        {/* ② 画像 or フォールバック（固定高さ） */}
        {bgUri ? (
          <View style={[styles.imageHeader, { height: imageH }]}>
            <Image source={{ uri: bgUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.85)']}
              style={[styles.imageGradient, { height: imageH * 0.5 }]}
            />
          </View>
        ) : (
          <View style={[styles.noImageHeader, { height: imageH }]}>
            <LinearGradient colors={getBackgroundGradient(appTheme)} style={StyleSheet.absoluteFill} />
            <Text style={styles.seasonDecor}>
              {month <= 3 ? '🌸' : month <= 6 ? '🌿' : month <= 9 ? '🌻' : '🍁'}
            </Text>
          </View>
        )}

        {/* ③ 日付セクション（固定高さ — 予定リストに侵食されない） */}
        <View style={[styles.dateSection, { height: DATE_SECTION_H }]}>
          {todayFlag && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}
          <Text style={styles.yearMonth}>{`${year}年 ${month}月`}</Text>
          <View style={styles.dateRow}>
            <Text
              style={[styles.day, { color: dayColor }]}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {date}
            </Text>
            <Text style={[styles.dayOfWeek, { color: dayColor }]}>({dayStr})</Text>
          </View>
        </View>

        {/* ④ 仕切り線 */}
        <View style={styles.divider} />

        {/* ⑤ 予定リスト（固定高さ内でスクロール） */}
        <View style={[styles.eventsContainer, { height: eventsAreaH }]}>
          <EventList
            events={events}
            onEventPress={handleEventPress}
            availableHeight={eventsAreaH}
          />
        </View>

      </View>
    );
  };

  const bgGrad = getBackgroundGradient(appTheme);

  return (
    <LinearGradient colors={bgGrad} style={styles.container} {...panResponder.panHandlers}>
      <View style={[styles.inner, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 88 }]}>

        <View style={styles.swipeHintWrap}>
          <Text style={styles.swipeHint}>↕ スワイプで日付切り替え</Text>
        </View>

        {/* Layer 1: 次の日（背面） — 固定高さなので飛び出さない */}
        <Animated.View style={[styles.card, styles.absolute, styles.shadow]}>
          {renderCard(nextDateObj)}
        </Animated.View>

        {/* Layer 2: 今日（中間） */}
        <Animated.View style={[styles.card, styles.absolute, styles.shadow,
          { transform: [{ translateY: currentTranslateY }, { rotateZ: currentRotateZ }] }]}>
          {renderCard(currentDateObj)}
        </Animated.View>

        {/* Layer 3: 前の日（前面） */}
        <Animated.View
          style={[styles.card, styles.absolute, styles.shadow,
            { transform: [{ translateY: prevTranslateY }, { rotateZ: prevRotateZ }] }]}
          pointerEvents="none"
        >
          {renderCard(prevDateObj)}
        </Animated.View>

      </View>

      {/* Android 用アクションシート */}
      {Platform.OS !== 'ios' && (
        <EventActionSheet
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onExport={handleExport}
        />
      )}
    </LinearGradient>
  );
}

// ── スタイル ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  swipeHintWrap: {
    position: 'absolute', top: 12, alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 20, zIndex: 10,
  },
  swipeHint: { fontSize: 11, color: 'rgba(0,0,0,0.45)', fontWeight: '500', letterSpacing: 0.3 },

  // ── カード ──
  // overflow: 'hidden' + height: CARD_HEIGHT → 中身の量に依存しない固定サイズ
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,       // ← 固定高さ (全カード同一)
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',        // ← はみ出したコンテンツは見えない
  },
  absolute: { position: 'absolute' },
  shadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },

  // cardInner も同じ高さで管理
  cardInner: { width: '100%', flexDirection: 'column' },

  // ── バインダー ──
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

  // ── 画像 ──
  imageHeader: { width: '100%', overflow: 'hidden', position: 'relative' },
  noImageHeader: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  imageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  seasonDecor: { fontSize: 40, opacity: 0.5 },

  // ── 日付セクション（固定高さ） ──
  dateSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',        // ← 日付エリアも絶対に溢れない
  },
  todayBadge: {
    backgroundColor: '#e63946', paddingHorizontal: 10,
    paddingVertical: 2, borderRadius: 20, marginBottom: 2,
  },
  todayBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  yearMonth: { fontSize: 14, fontWeight: '600', color: '#888', letterSpacing: 0.5 },
  dateRow: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'center', width: '100%', paddingHorizontal: 10,
  },
  // 日付の大きさは固定 — 予定エリアとは完全に独立
  day: { fontWeight: '800', fontSize: 80, letterSpacing: -2, lineHeight: 88 },
  dayOfWeek: { fontSize: 22, fontWeight: '700', marginLeft: 6 },

  // ── 仕切り線 ──
  divider: {
    width: '80%', height: 1.5, backgroundColor: '#ececec',
    marginHorizontal: 'auto',      // 中央揃え
    alignSelf: 'center',
    borderRadius: 1,
  },

  // ── 予定エリア（固定高さ内でスクロール） ──
  eventsContainer: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 4,
    overflow: 'hidden',
  },
  eventScrollContent: { paddingBottom: 4 },

  // ── 予定タグ ──
  eventTag: {
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    marginBottom: 5, gap: 8,
  },
  eventIcon: { fontSize: 14 },
  eventText: { fontSize: 13, fontWeight: '600', flex: 1 },
  eventChevron: { fontSize: 16, color: '#ccc', fontWeight: '300' },

  // 展開ボタン
  expandButton: { alignItems: 'center', paddingVertical: 5 },
  expandButtonText: { fontSize: 12, color: '#0a7ea4', fontWeight: '700' },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  emptyIcon: { fontSize: 24, marginBottom: 2 },
  noEventsText: { fontSize: 13, color: '#aaa', fontWeight: '500' },
  noEventsHint: { fontSize: 11, color: '#ccc' },

  // ── Android アクションシート ──
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
