import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useEffect } from 'react';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useNativeCalendarStore } from '@/store/nativeCalendarStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { AppTheme, CardStyle } from '@/types/settings';
import { getThemeColors, getBackgroundGradient } from '@/utils/theme';

/**
 * 月間カレンダー画面
 * 予定の有無を一覧で確認でき、日付を選択するとその日の詳細（日めくり画面）へ移動します。
 */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.90;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.74;
const BINDING_H = 32;
// 1セルあたりの幅（カード幅を7分割）
const CELL_W = Math.floor(CARD_WIDTH / 7);

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];
const ROKUYO_LABELS = ['先勝', '友引', '先負', '仏滅', '大安', '赤口'];

/**
 * 六曜を計算する（簡易的な計算式）
 * @param year 年
 * @param month 月
 * @param day 日
 * @returns 六曜の文字列
 */
function getRokuyo(year: number, month: number, day: number): string {
  // グレゴリオ暦 → ユリウス通日
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jd = day + Math.floor((153 * m + 2) / 5) + 365 * y
    + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  // 基準: 2000-02-05 = 旧暦 正月朔 = 先勝 (index 0)
  const refJD = 2451580;
  const lunarPeriod = 29.530589;
  const elapsed = jd - refJD;
  const months = Math.floor(elapsed / lunarPeriod);
  const dayInMonth = Math.floor(elapsed - months * lunarPeriod);
  const lMonth = ((months % 12) + 12) % 12 + 1;
  const lDay = dayInMonth + 1;
  return ROKUYO_LABELS[((lMonth + lDay - 2) % 6 + 6) % 6];
}

/**
 * 日付を YYYY-MM-DD 形式の文字列に変換
 */
function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const EMPTY_EVENTS: any[] = [];

type CellDay = { year: number; month: number; day: number; isCurrent: boolean };

/**
 * 指定された年月のカレンダーグリッド（週ごとの配列）を生成する
 */
function buildWeeks(year: number, month: number): CellDay[][] {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 月の最初の曜日
  const daysInMonth = new Date(year, month, 0).getDate(); // 月の末日
  
  // 前月・次月の情報を算出
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const daysInPrev = new Date(prev.year, prev.month, 0).getDate();

  const flat: CellDay[] = [];
  // 前月の埋め合わせ
  for (let i = firstDow - 1; i >= 0; i--)
    flat.push({ ...prev, day: daysInPrev - i, isCurrent: false });
  // 今月のメイン
  for (let d = 1; d <= daysInMonth; d++)
    flat.push({ year, month, day: d, isCurrent: true });
  // 次月の埋め合わせ
  const rem = Math.ceil(flat.length / 7) * 7 - flat.length;
  for (let d = 1; d <= rem; d++)
    flat.push({ ...next, day: d, isCurrent: false });

  // 7日ずつ分割して週ごとの二次元配列にする
  const weeks: CellDay[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

/**
 * 1日分のセルコンポーネント
 */
const DayCell = React.memo(function DayCell({
  year,
  month,
  day,
  isCurrent,
  events,
  isToday,
  isSun,
  isSat,
  onPress,
  isDarkMode
}: {
  year: number;
  month: number;
  day: number;
  isCurrent: boolean;
  events: any[];
  isToday: boolean;
  isSun: boolean;
  isSat: boolean;
  onPress: (y: number, m: number, d: number) => void;
  isDarkMode: boolean;
}) {
  const themeColors = getThemeColors(isDarkMode);
  
  // 文字色の決定（今日、土日、他月などで分岐）
  const numColor = !isCurrent
    ? (isDarkMode ? '#444' : '#ccc')
    : isSun ? '#e63946'
    : isSat ? '#2563eb'
    : themeColors.textMain;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        { borderRightColor: themeColors.border },
        !isCurrent && (isDarkMode ? { backgroundColor: '#161618' } : styles.cellOther)
      ]}
      onPress={() => onPress(year, month, day)}
      activeOpacity={0.7}
    >
      <View style={[styles.numWrap, isToday && styles.todayCircle]}>
        <Text style={[styles.dateNum, { color: isToday ? '#fff' : numColor }]}>
          {day}
        </Text>
      </View>
      {/* 六曜の表示 */}
      <Text style={[styles.rokuyo, { color: themeColors.textSub }]}>{getRokuyo(year, month, day)}</Text>
      
      {/* 予定のチップ（最大3件まで表示） */}
      {events.slice(0, 3).map((evt, ei) => (
        <View key={ei} style={[styles.chip, { backgroundColor: evt.calendarColor ?? '#0a7ea4' }]}>
          <Text style={styles.chipText} numberOfLines={1}>{evt.title}</Text>
        </View>
      ))}
      {/* 4件目以降は件数を表示 */}
      {events.length > 3 && (
        <Text style={[styles.moreText, { color: themeColors.textSub }]}>+{events.length - 3}</Text>
      )}
    </TouchableOpacity>
  );
});

// ── メモ化された月間カレンダーカードコンポーネント ──────────────────────────────
type MonthlyCardProps = {
  dObj: Date;
  themeColors: ReturnType<typeof getThemeColors>;
  appTheme: AppTheme;
  isDarkMode: boolean;
  bgUri: string | null;
  eventsByDate: Record<string, any[]>;
  todayStr: string;
  cardStyle: CardStyle;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayPress: (y: number, m: number, d: number) => void;
};

const MonthlyCard = React.memo(function MonthlyCard({
  dObj,
  themeColors,
  appTheme,
  isDarkMode,
  bgUri,
  eventsByDate,
  todayStr,
  cardStyle,
  onPrevMonth,
  onNextMonth,
  onDayPress,
}: MonthlyCardProps) {
  const viewYear = dObj.getFullYear();
  const viewMonth = dObj.getMonth() + 1;
  const weeks = buildWeeks(viewYear, viewMonth);
  const bgGrad = getBackgroundGradient(appTheme, isDarkMode);

  const isTearOff = cardStyle === 'tear-off';
  const isRing = cardStyle === 'ring';
  const isPolaroid = cardStyle === 'polaroid';
  const isMinimal = cardStyle === 'minimal';

  const cardOuterStyle = [
    styles.cardInner,
    { height: CARD_HEIGHT, backgroundColor: themeColors.cardBg },
    isPolaroid && { padding: 12, borderRadius: 8 },
    isMinimal && { borderRadius: 24, overflow: 'hidden' as const },
  ];

  const renderBinding = () => {
    if (isMinimal || isPolaroid) return null;

    if (isRing) {
      return (
        <View style={styles.ringBindingContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <View key={i} style={[styles.ringHole, { backgroundColor: isDarkMode ? '#000' : '#222' }]}>
              <View style={[styles.ringWire, { backgroundColor: isDarkMode ? '#888' : '#cbd5e1' }]} />
            </View>
          ))}
        </View>
      );
    }

    return (
      <View style={[styles.bindingContainer, { backgroundColor: themeColors.binding, borderBottomColor: themeColors.border }]}>
        {[1, 2, 3, 4, 5, 6].map((i) => <View key={i} style={[styles.hole, { backgroundColor: isDarkMode ? '#111' : '#2c2c2c' }]} />)}
      </View>
    );
  };

  return (
    <View style={cardOuterStyle}>
      {/* カード上部：カレンダーの「綴じ代」とパンチ穴の演出 */}
      {renderBinding()}

      {/* 上部画像・背景エリア */}
      <View style={[styles.topHeaderArea, { height: bgUri ? CARD_HEIGHT * 0.35 : 80 }]}>
        {bgUri ? (
          <View style={StyleSheet.absoluteFill}>
            <Image 
              source={{ uri: bgUri }} 
              style={StyleSheet.absoluteFill} 
              contentFit="cover" 
              transition={0}
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }}
            />
          </View>
        ) : (
          <LinearGradient colors={bgGrad} style={StyleSheet.absoluteFill} />
        )}
        
        {/* ヘッダー：年月表示と移動ボタン */}
        <View style={[styles.header, { paddingTop: bgUri ? 0 : 8, borderBottomColor: bgUri ? 'transparent' : themeColors.border }]}>
          <TouchableOpacity onPress={onPrevMonth} style={styles.navBtn}>
            <Text style={[styles.navArrow, { color: bgUri ? '#fff' : themeColors.textMain }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[
            styles.headerTitle, 
            { color: bgUri ? '#fff' : themeColors.textMain },
            bgUri && styles.textShadow
          ]}>
            {viewYear}年{viewMonth}月
          </Text>
          <TouchableOpacity onPress={onNextMonth} style={styles.navBtn}>
            <Text style={[styles.navArrow, { color: bgUri ? '#fff' : themeColors.textMain }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 曜日ラベルの行 */}
      <View style={[styles.dowRow, { backgroundColor: isDarkMode ? '#1C1C1E' : '#f8f8f8', borderBottomColor: themeColors.border }]}>
        {DAYS_JP.map((d, i) => (
          <Text key={d} style={[styles.dowLabel, i === 0 && styles.sunText, i === 6 && styles.satText, { color: (i === 0 || i === 6) ? undefined : themeColors.textSub }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* カレンダーのグリッド本体 (ジェスチャー競合を防ぐため通常のViewを使用) */}
      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={[styles.weekRow, { borderBottomColor: themeColors.border }]}>
            {week.map((cell, di) => {
              const dateStr = toDateStr(cell.year, cell.month, cell.day);
              return (
                <DayCell
                  key={dateStr}
                  year={cell.year}
                  month={cell.month}
                  day={cell.day}
                  isCurrent={cell.isCurrent}
                  events={eventsByDate[dateStr] || EMPTY_EVENTS}
                  isToday={dateStr === todayStr}
                  isSun={di === 0}
                  isSat={di === 6}
                  onPress={onDayPress}
                  isDarkMode={isDarkMode}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
});

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { eventsByDate } = useNativeCalendarStore();
  const { setJumpDate } = useNavigationStore();
  const { isDarkMode, isBgEnabled, bgMode, bgUri: fixedBgUri, bgUris, appTheme, lastViewedMonth, setLastViewedMonth, cardStyle } = useSettingsStore();

  const themeColors = getThemeColors(isDarkMode);

  // 背景画像のURIを取得（固定モード or 日替わりランダムモード）
  const getBgUri = (dObj: Date) => {
    if (!isBgEnabled || bgUris.length === 0) return null;
    if (bgMode === 'fixed') return fixedBgUri || bgUris[0];
    // 素数を用いたハッシュ計算で、月や日が切り替わった際にきちんとインデックスが変動するようにする
    const seed = dObj.getFullYear() * 373 + (dObj.getMonth() + 1) * 31 + dObj.getDate();
    return bgUris[seed % bgUris.length];
  };

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // アニメーション用に3つの月状態（1日のDateオブジェクト）を管理
  const [currentMonthObj, setCurrentMonthObj] = useState<Date>(() => {
    // 前回開いていた月があればそれを復元
    if (lastViewedMonth) {
      const [y, m, d] = lastViewedMonth.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [prevMonthObj, setPrevMonthObj] = useState(() => new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const [nextMonthObj, setNextMonthObj] = useState(() => new Date(today.getFullYear(), today.getMonth() + 1, 1));

  const pan = useRef(new Animated.ValueXY()).current;
  const lastMonthRef = useRef(currentMonthObj);

  // 月が切り替わった際のクリーンアップと隣接月の更新
  useEffect(() => {
    if (lastMonthRef.current.getTime() !== currentMonthObj.getTime()) {
      lastMonthRef.current = currentMonthObj;
      pan.setValue({ x: 0, y: 0 }); // アニメーション座標をリセット
      setNextMonthObj(new Date(currentMonthObj.getFullYear(), currentMonthObj.getMonth() + 1, 1));
      setPrevMonthObj(new Date(currentMonthObj.getFullYear(), currentMonthObj.getMonth() - 1, 1));
      
      // 最後に表示した月を保存
      setLastViewedMonth(toDateStr(currentMonthObj.getFullYear(), currentMonthObj.getMonth() + 1, 1));
    }
  }, [currentMonthObj, pan, setLastViewedMonth]);

  const panResponder = useRef(
    PanResponder.create({
      // 垂直方向に一定以上動かした場合のみジェスチャーを開始
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: Animated.event([null, { dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gs) => {
        // 下に 120px 以上スワイプ ➔ 「今の月」を破り捨てて「来月」へ
        if (gs.dy > 120) {
          Animated.timing(pan.y, { toValue: 900, duration: 260, useNativeDriver: true }).start(() => {
            setCurrentMonthObj(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
          });
        } 
        // 上に 120px 以上スワイプ ➔ 「先月」を引っ張って戻す
        else if (gs.dy < -120) {
          Animated.timing(pan.y, { toValue: -900, duration: 260, useNativeDriver: true }).start(() => {
            setCurrentMonthObj(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
          });
        } 
        // 勢いが足りなければ元の位置にバネで戻る
        else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 10 }).start();
        }
      },
    })
  ).current;

  // アニメーションの補間設定
  const currentTranslateY = pan.y.interpolate({ inputRange: [0, 900], outputRange: [0, 900], extrapolate: 'clamp' });
  const currentRotateZ = pan.y.interpolate({ inputRange: [0, 900], outputRange: ['0deg', '8deg'], extrapolate: 'clamp' });
  const prevTranslateY = pan.y.interpolate({ inputRange: [-900, 0], outputRange: [0, 900], extrapolate: 'clamp' });
  const prevRotateZ = pan.y.interpolate({ inputRange: [-900, 0], outputRange: ['0deg', '-8deg'], extrapolate: 'clamp' });

  // ボタン操作による月移動
  const animateToNextMonth = () => {
    Animated.timing(pan.y, { toValue: 900, duration: 260, useNativeDriver: true }).start(() => {
      setCurrentMonthObj(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    });
  };

  const animateToPrevMonth = () => {
    Animated.timing(pan.y, { toValue: -900, duration: 260, useNativeDriver: true }).start(() => {
      setCurrentMonthObj(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    });
  };

  const handleDayPress = useCallback((y: number, m: number, d: number) => {
    setJumpDate(toDateStr(y, m, d));
    router.navigate('/(tabs)');
  }, [setJumpDate]);

  const bgGrad = getBackgroundGradient(appTheme, isDarkMode);

  const isCurrentMonthView = currentMonthObj.getFullYear() === today.getFullYear() && currentMonthObj.getMonth() === today.getMonth();

  return (
    <LinearGradient colors={bgGrad} style={styles.container} {...panResponder.panHandlers}>
      <View style={[styles.inner, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 88 }]}>
        {/* 第1層（最背面）：次月 */}
        <Animated.View style={[styles.card, styles.absolute]}>
          <MonthlyCard
            dObj={nextMonthObj}
            themeColors={themeColors}
            appTheme={appTheme}
            isDarkMode={isDarkMode}
            bgUri={getBgUri(nextMonthObj)}
            eventsByDate={eventsByDate}
            todayStr={todayStr}
            cardStyle={cardStyle}
            onPrevMonth={animateToPrevMonth}
            onNextMonth={animateToNextMonth}
            onDayPress={handleDayPress}
          />
        </Animated.View>

        {/* 第2層（前面）：今月。指の動きに合わせて動く */}
        <Animated.View style={[styles.card, styles.absolute, styles.shadow,
        { transform: [{ translateY: currentTranslateY }, { rotateZ: currentRotateZ }] }]}>
          <MonthlyCard
            dObj={currentMonthObj}
            themeColors={themeColors}
            appTheme={appTheme}
            isDarkMode={isDarkMode}
            bgUri={getBgUri(currentMonthObj)}
            eventsByDate={eventsByDate}
            todayStr={todayStr}
            cardStyle={cardStyle}
            onPrevMonth={animateToPrevMonth}
            onNextMonth={animateToNextMonth}
            onDayPress={handleDayPress}
          />
        </Animated.View>

        {/* 第3層（最前面）：先月。普段は画面外に待機 */}
        <Animated.View
          style={[styles.card, styles.absolute, styles.shadow,
          { transform: [{ translateY: prevTranslateY }, { rotateZ: prevRotateZ }] }]}
          pointerEvents="none"
        >
          <MonthlyCard
            dObj={prevMonthObj}
            themeColors={themeColors}
            appTheme={appTheme}
            isDarkMode={isDarkMode}
            bgUri={getBgUri(prevMonthObj)}
            eventsByDate={eventsByDate}
            todayStr={todayStr}
            cardStyle={cardStyle}
            onPrevMonth={animateToPrevMonth}
            onNextMonth={animateToNextMonth}
            onDayPress={handleDayPress}
          />
        </Animated.View>
      </View>

      {/* 今月ではない場合に表示される「今月に戻る」ボタン */}
      {!isCurrentMonthView && (
        <TouchableOpacity
          style={[styles.todayReturnButton, { top: insets.top + 12, right: 16 }]}
          onPress={() => {
            setCurrentMonthObj(new Date(today.getFullYear(), today.getMonth(), 1));
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.todayReturnText}>今月に戻る</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

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
  cardInner: { width: '100%', flexDirection: 'column' },
  absolute: { position: 'absolute' },
  shadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },

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

  // ── 新規追加：リングノート風バインディング ──
  ringBindingContainer: {
    height: BINDING_H,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    paddingBottom: 4,
  },
  ringHole: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  ringWire: {
    width: 4,
    height: 24,
    borderRadius: 2,
    marginTop: -12,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 2,
  },

  topHeaderArea: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  navBtn: { padding: 8, paddingHorizontal: 16 },
  navArrow: { fontSize: 32, color: '#1a1a2e', lineHeight: 36 },
  textShadow: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  dowRow: {
    flexDirection: 'row', backgroundColor: '#f8f8f8',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0',
  },
  dowLabel: { width: CELL_W, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#555', paddingVertical: 5 },
  sunText: { color: '#e63946' },
  satText: { color: '#2563eb' },

  grid: { flex: 1 },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0',
  },
  cell: {
    width: CELL_W, minHeight: 76, paddingHorizontal: 2, paddingTop: 3, paddingBottom: 3,
    borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#e0e0e0',
  },
  cellOther: { backgroundColor: '#fafafa' },

  numWrap: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  todayCircle: { backgroundColor: '#e63946' },
  dateNum: { fontSize: 13, fontWeight: '600' },

  rokuyo: { fontSize: 8, color: '#aaa', marginBottom: 2, paddingLeft: 1 },

  chip: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1, marginBottom: 1 },
  chipText: { fontSize: 9, color: '#fff', fontWeight: '500' },
  moreText: { fontSize: 8, color: '#999', paddingLeft: 1 },

  // 今月へ戻るボタン
  todayReturnButton: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    zIndex: 50,
  },
  todayReturnText: {
    color: '#0a7ea4',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
