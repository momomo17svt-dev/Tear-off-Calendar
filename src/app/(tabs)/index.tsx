import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  PanResponder,
  Animated,
  Dimensions,
  Text,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useSettingsStore } from '@/store/settingsStore';
import { useEventStore } from '@/store/eventStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.88;

const DAY_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];

const getBackgroundColor = (theme: string): [string, string] => {
  switch (theme) {
    case 'corkboard':
      return ['#C89D7C', '#A0785A'];
    case 'wood':
      return ['#8D6E63', '#5D4037'];
    case 'light-gray':
    default:
      return ['#E8EDF2', '#D0D7E0'];
  }
};

const getDayColor = (dayIndex: number) => {
  if (dayIndex === 0) return '#e63946';
  if (dayIndex === 6) return '#2563eb';
  return '#1a1a2e';
};

const getDayAccent = (dayIndex: number) => {
  if (dayIndex === 0) return 'rgba(230,57,70,0.08)';
  if (dayIndex === 6) return 'rgba(37,99,235,0.08)';
  return 'transparent';
};

// YYYY-MM-DD 形式に変換するユーティリティ
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isBgEnabled, bgUri: fixedBgUri, bgUris, bgMode, appTheme } = useSettingsStore();
  const { getEventsForDate } = useEventStore();
  useEventStore((state) => state.events); // re-render trigger

  const today = new Date();

  const [currentDateObj, setCurrentDateObj] = useState(today);
  const [prevDateObj, setPrevDateObj] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  });
  const [nextDateObj, setNextDateObj] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  });

  const pan = useRef(new Animated.ValueXY()).current;
  const lastDateRef = useRef(currentDateObj);

  useEffect(() => {
    if (lastDateRef.current.getTime() !== currentDateObj.getTime()) {
      lastDateRef.current = currentDateObj;
      pan.setValue({ x: 0, y: 0 });

      setNextDateObj(() => {
        const d = new Date(currentDateObj);
        d.setDate(d.getDate() + 1);
        return d;
      });
      setPrevDateObj(() => {
        const d = new Date(currentDateObj);
        d.setDate(d.getDate() - 1);
        return d;
      });
    }
  }, [currentDateObj, pan]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: Animated.event([null, { dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120) {
          Animated.timing(pan.y, {
            toValue: 900,
            duration: 260,
            useNativeDriver: true,
          }).start(() => {
            setCurrentDateObj((prev) => {
              const d = new Date(prev);
              d.setDate(d.getDate() + 1);
              return d;
            });
          });
        } else if (gs.dy < -120) {
          Animated.timing(pan.y, {
            toValue: -900,
            duration: 260,
            useNativeDriver: true,
          }).start(() => {
            setCurrentDateObj((prev) => {
              const d = new Date(prev);
              d.setDate(d.getDate() - 1);
              return d;
            });
          });
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            bounciness: 10,
          }).start();
        }
      },
    })
  ).current;

  const currentTranslateY = pan.y.interpolate({
    inputRange: [0, 900],
    outputRange: [0, 900],
    extrapolate: 'clamp',
  });
  const currentRotateZ = pan.y.interpolate({
    inputRange: [0, 900],
    outputRange: ['0deg', '14deg'],
    extrapolate: 'clamp',
  });
  const prevTranslateY = pan.y.interpolate({
    inputRange: [-900, 0],
    outputRange: [0, 900],
    extrapolate: 'clamp',
  });
  const prevRotateZ = pan.y.interpolate({
    inputRange: [-900, 0],
    outputRange: ['0deg', '-14deg'],
    extrapolate: 'clamp',
  });

  const getDisplayedBgUri = (dObj: Date) => {
    if (!isBgEnabled || bgUris.length === 0) return null;
    if (bgMode === 'fixed') return fixedBgUri || bgUris[0];
    const seed =
      dObj.getFullYear() * 10000 +
      (dObj.getMonth() + 1) * 100 +
      dObj.getDate();
    return bgUris[seed % bgUris.length];
  };

  const isToday = (dObj: Date) =>
    toDateStr(dObj) === toDateStr(today);

  const renderCardContent = (dObj: Date) => {
    const year = dObj.getFullYear();
    const month = dObj.getMonth() + 1;
    const date = dObj.getDate();
    const dateStr = toDateStr(dObj);
    const dayStr = DAY_OF_WEEK[dObj.getDay()];
    const todaysEvents = getEventsForDate(dateStr);
    const bgUri = getDisplayedBgUri(dObj);
    const dayColor = getDayColor(dObj.getDay());
    const dayAccent = getDayAccent(dObj.getDay());
    const todayFlag = isToday(dObj);

    return (
      <View style={styles.cardInner}>
        {/* ── バインダー部（穴） ── */}
        <View style={styles.bindingContainer}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={styles.hole} />
          ))}
        </View>

        {/* ── 画像ヘッダー or グラデーションフォールバック ── */}
        {bgUri ? (
          <View style={styles.imageHeader}>
            <Image
              source={{ uri: bgUri }}
              style={styles.cardImage}
              contentFit="cover"
            />
            {/* 画像下部のグラデーションオーバーレイ */}
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.85)']}
              style={styles.imageGradient}
            />
          </View>
        ) : (
          <View style={[styles.imageHeader, styles.noImageHeader]}>
            <LinearGradient
              colors={getBackgroundColor(appTheme)}
              style={StyleSheet.absoluteFill}
            />
            {/* 装飾的な季節感テキスト */}
            <Text style={styles.seasonDecor}>
              {month <= 3 ? '🌸' : month <= 6 ? '🌿' : month <= 9 ? '🌻' : '🍁'}
            </Text>
          </View>
        )}

        {/* ── 日付エリア ── */}
        <View
          style={[
            styles.dateArea,
            { backgroundColor: dayAccent },
            !bgUri && styles.dateAreaCompact,
          ]}
        >
          {/* 今日バッジ */}
          {todayFlag && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}

          <Text style={styles.yearMonth}>{`${year}年 ${month}月`}</Text>

          <View style={styles.dateRow}>
            <Text
              style={[
                styles.day,
                { color: dayColor, fontSize: bgUri ? 62 : 82 },
              ]}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {date}
            </Text>
            <Text style={[styles.dayOfWeek, { color: dayColor }]}>
              ({dayStr})
            </Text>
          </View>

          <View style={styles.divider} />

          {/* ── 予定リスト ── */}
          <View style={styles.eventsContainer}>
            {todaysEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.noEventsText}>今日の予定はありません</Text>
                <Text style={styles.noEventsHint}>＋ から予定を追加できます</Text>
              </View>
            ) : (
              todaysEvents.map((evt) => (
                <View key={evt.id} style={styles.eventRow}>
                  <View
                    style={[
                      styles.eventTag,
                      {
                        backgroundColor:
                          evt.type === 'birthday'
                            ? 'rgba(255,107,107,0.12)'
                            : 'rgba(78,205,196,0.12)',
                        borderLeftColor:
                          evt.type === 'birthday' ? '#ff6b6b' : '#4ecdc4',
                      },
                    ]}
                  >
                    <Text style={styles.eventIcon}>
                      {evt.type === 'birthday' ? '🎂' : '📌'}
                    </Text>
                    <Text
                      style={[
                        styles.eventText,
                        { color: evt.type === 'birthday' ? '#c0392b' : '#16a085' },
                      ]}
                      numberOfLines={2}
                    >
                      {evt.title}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </View>
    );
  };

  const [bgGradient] = useState(getBackgroundColor(appTheme));

  return (
    <LinearGradient
      colors={bgGradient}
      style={styles.container}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.innerContainer,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 88 },
        ]}
      >
        {/* スワイプヒント */}
        <View style={styles.swipeHint}>
          <Text style={styles.swipeHintText}>↕ スワイプで日付を切り替え</Text>
        </View>

        {/* Layer 1: 次の日（裏） */}
        <Animated.View style={[styles.calendarCard, styles.absoluteCard, styles.shadowCard]}>
          {renderCardContent(nextDateObj)}
        </Animated.View>

        {/* Layer 2: 今日（中間）— 下スワイプで落ちる */}
        <Animated.View
          style={[
            styles.calendarCard,
            styles.absoluteCard,
            styles.shadowCard,
            {
              transform: [
                { translateY: currentTranslateY },
                { rotateZ: currentRotateZ },
              ],
            },
          ]}
        >
          {renderCardContent(currentDateObj)}
        </Animated.View>

        {/* Layer 3: 前の日（手前）— 上スワイプで出てくる */}
        <Animated.View
          style={[
            styles.calendarCard,
            styles.absoluteCard,
            styles.shadowCard,
            {
              transform: [
                { translateY: prevTranslateY },
                { rotateZ: prevRotateZ },
              ],
            },
          ]}
          pointerEvents="none"
        >
          {renderCardContent(prevDateObj)}
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHint: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 20,
    zIndex: 10,
  },
  swipeHintText: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.45)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  calendarCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  absoluteCard: {
    position: 'absolute',
  },
  shadowCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  cardInner: {
    width: '100%',
  },
  // ── バインダー ──
  bindingContainer: {
    height: 32,
    backgroundColor: '#f1f3f5',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 24,
  },
  hole: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2c2c2c',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 3,
  },
  // ── 画像ヘッダー ──
  imageHeader: {
    width: '100%',
    aspectRatio: 1.6,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  noImageHeader: {
    aspectRatio: 2.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  seasonDecor: {
    fontSize: 48,
    opacity: 0.5,
  },
  // ── 日付エリア ──
  dateArea: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    alignItems: 'center',
    borderRadius: 0,
  },
  dateAreaCompact: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  todayBadge: {
    backgroundColor: '#e63946',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 6,
  },
  todayBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  yearMonth: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
  day: {
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 95,
  },
  dayOfWeek: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 6,
    flexShrink: 1,
    letterSpacing: 0.5,
  },
  divider: {
    width: '75%',
    height: 1.5,
    backgroundColor: '#ececec',
    marginVertical: 14,
    borderRadius: 1,
  },
  // ── 予定 ──
  eventsContainer: {
    width: '100%',
    alignItems: 'center',
    minHeight: 60,
    paddingBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  noEventsText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '500',
  },
  noEventsHint: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 2,
  },
  eventRow: {
    width: '100%',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  eventTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  eventIcon: {
    fontSize: 16,
  },
  eventText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
});
