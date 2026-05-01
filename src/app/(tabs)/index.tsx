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

const DAY_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const MAX_VISIBLE_EVENTS = 3; // スクロール前に表示する最大件数

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

// ── イベント1件のコンポーネント ──────────────────────────────────────────
function EventItem({
  event,
  onPress,
}: {
  event: CalendarEvent;
  onPress: (evt: CalendarEvent) => void;
}) {
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

// ── 予定リスト（多い場合はスクロール＋折りたたみ） ────────────────────────
function EventList({
  events,
  onEventPress,
}: {
  events: CalendarEvent[];
  onEventPress: (evt: CalendarEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📅</Text>
        <Text style={styles.noEventsText}>今日の予定はありません</Text>
        <Text style={styles.noEventsHint}>＋ から予定を追加できます</Text>
      </View>
    );
  }

  const visibleEvents = expanded ? events : events.slice(0, MAX_VISIBLE_EVENTS);
  const hiddenCount = events.length - MAX_VISIBLE_EVENTS;

  return (
    <View style={styles.eventListWrapper}>
      {visibleEvents.map((evt) => (
        <EventItem key={evt.id} event={evt} onPress={onEventPress} />
      ))}

      {/* 折りたたみ展開ボタン */}
      {events.length > MAX_VISIBLE_EVENTS && (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.expandButtonText}>
            {expanded
              ? '▲ 折りたたむ'
              : `▼ あと ${hiddenCount} 件を表示`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── アクションシート（Android向けのインラインシート） ─────────────────────
function EventActionSheet({
  event,
  onClose,
  onEdit,
  onDelete,
  onExport,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (evt: CalendarEvent) => void;
  onDelete: (evt: CalendarEvent) => void;
  onExport: (evt: CalendarEvent) => void;
}) {
  if (!event) return null;

  return (
    <TouchableOpacity style={styles.sheetOverlay} onPress={onClose} activeOpacity={1}>
      <View style={styles.sheetContainer}>
        {/* ハンドル */}
        <View style={styles.sheetHandle} />
        {/* タイトル */}
        <Text style={styles.sheetTitle} numberOfLines={2}>
          {event.type === 'birthday' ? '🎂' : '📌'} {event.title}
        </Text>
        <Text style={styles.sheetDate}>{event.date}</Text>

        <View style={styles.sheetDivider} />

        <TouchableOpacity
          style={styles.sheetAction}
          onPress={() => { onClose(); onEdit(event); }}
        >
          <Text style={styles.sheetActionIcon}>✏️</Text>
          <Text style={styles.sheetActionText}>編集する</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sheetAction}
          onPress={() => { onClose(); onExport(event); }}
        >
          <Text style={styles.sheetActionIcon}>📲</Text>
          <Text style={styles.sheetActionText}>端末カレンダーにエクスポート</Text>
        </TouchableOpacity>

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
  const [prevDateObj, setPrevDateObj] = useState(() => {
    const d = new Date(today); d.setDate(d.getDate() - 1); return d;
  });
  const [nextDateObj, setNextDateObj] = useState(() => {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d;
  });

  // アクションシート用
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

  // 予定タップ: iOS は ActionSheetIOS、Android はカスタムシート
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

    return (
      <View style={styles.cardInner}>
        {/* バインダー穴 */}
        <View style={styles.bindingContainer}>
          {[1,2,3,4,5,6].map((i) => <View key={i} style={styles.hole} />)}
        </View>

        {/* 画像 or グラデーションフォールバック */}
        {bgUri ? (
          <View style={styles.imageHeader}>
            <Image source={{ uri: bgUri }} style={styles.cardImage} contentFit="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.85)']}
              style={styles.imageGradient}
            />
          </View>
        ) : (
          <View style={[styles.imageHeader, styles.noImageHeader]}>
            <LinearGradient colors={getBackgroundGradient(appTheme)} style={StyleSheet.absoluteFill} />
            <Text style={styles.seasonDecor}>
              {month <= 3 ? '🌸' : month <= 6 ? '🌿' : month <= 9 ? '🌻' : '🍁'}
            </Text>
          </View>
        )}

        {/* 日付エリア */}
        <View style={[styles.dateArea, !bgUri && styles.dateAreaCompact]}>
          {todayFlag && (
            <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>TODAY</Text></View>
          )}
          <Text style={styles.yearMonth}>{`${year}年 ${month}月`}</Text>
          <View style={styles.dateRow}>
            <Text
              style={[styles.day, { color: dayColor, fontSize: bgUri ? 62 : 82 }]}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {date}
            </Text>
            <Text style={[styles.dayOfWeek, { color: dayColor }]}>({dayStr})</Text>
          </View>

          <View style={styles.divider} />

          {/* 予定リスト — スクロール対応 + タップ操作 */}
          <ScrollView
            style={styles.eventsScroll}
            contentContainerStyle={styles.eventsScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <EventList events={events} onEventPress={handleEventPress} />
          </ScrollView>
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

        {/* Layer 1: 次の日（背面） */}
        <Animated.View style={[styles.card, styles.absolute, styles.shadow]}>
          {renderCard(nextDateObj)}
        </Animated.View>

        {/* Layer 2: 今日（中間）— 下スワイプで落ちる */}
        <Animated.View style={[styles.card, styles.absolute, styles.shadow,
          { transform: [{ translateY: currentTranslateY }, { rotateZ: currentRotateZ }] }]}>
          {renderCard(currentDateObj)}
        </Animated.View>

        {/* Layer 3: 前の日（前面）— 上スワイプで出てくる */}
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

  card: { width: CARD_WIDTH, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  absolute: { position: 'absolute' },
  shadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },
  cardInner: { width: '100%' },

  // バインダー
  bindingContainer: {
    height: 32, backgroundColor: '#f1f3f5',
    flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0',
    paddingHorizontal: 24,
  },
  hole: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#2c2c2c',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 3, elevation: 3,
  },

  // 画像
  imageHeader: { width: '100%', aspectRatio: 1.6, backgroundColor: '#e0e0e0', overflow: 'hidden' },
  noImageHeader: { aspectRatio: 2.2, alignItems: 'center', justifyContent: 'center' },
  cardImage: { width: '100%', height: '100%' },
  imageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' },
  seasonDecor: { fontSize: 48, opacity: 0.5 },

  // 日付
  dateArea: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, alignItems: 'center' },
  dateAreaCompact: { paddingTop: 20, paddingBottom: 16 },
  todayBadge: {
    backgroundColor: '#e63946', paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 20, marginBottom: 4,
  },
  todayBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  yearMonth: { fontSize: 15, fontWeight: '600', color: '#888', letterSpacing: 0.5, marginBottom: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', width: '100%', paddingHorizontal: 10 },
  day: { fontWeight: '800', letterSpacing: -2, lineHeight: 95 },
  dayOfWeek: { fontSize: 22, fontWeight: '700', marginLeft: 6, flexShrink: 1 },
  divider: { width: '75%', height: 1.5, backgroundColor: '#ececec', marginVertical: 10, borderRadius: 1 },

  // 予定スクロール
  eventsScroll: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.20, // 画面高さの20%まで
  },
  eventsScrollContent: { paddingBottom: 4 },

  // 予定リスト
  eventListWrapper: { width: '100%' },
  eventTag: {
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    marginBottom: 6, gap: 8,
  },
  eventIcon: { fontSize: 15 },
  eventText: { fontSize: 14, fontWeight: '600', flex: 1 },
  eventChevron: { fontSize: 18, color: '#ccc', fontWeight: '300' },

  // 展開ボタン
  expandButton: {
    alignItems: 'center', paddingVertical: 6,
    marginTop: 2, marginBottom: 4,
  },
  expandButtonText: { fontSize: 12, color: '#0a7ea4', fontWeight: '700' },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  emptyIcon: { fontSize: 28, marginBottom: 4 },
  noEventsText: { fontSize: 14, color: '#aaa', fontWeight: '500' },
  noEventsHint: { fontSize: 12, color: '#ccc' },

  // ── Android アクションシート ──
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  sheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
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
