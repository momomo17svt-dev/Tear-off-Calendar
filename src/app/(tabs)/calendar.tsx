import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
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
import { getThemeColors } from '@/utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_W = Math.floor(SCREEN_WIDTH / 7);

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];
const ROKUYO_LABELS = ['先勝', '友引', '先負', '仏滅', '大安', '赤口'];

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

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

type CellDay = { year: number; month: number; day: number; isCurrent: boolean };

function buildWeeks(year: number, month: number): CellDay[][] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const daysInPrev = new Date(prev.year, prev.month, 0).getDate();

  const flat: CellDay[] = [];
  for (let i = firstDow - 1; i >= 0; i--)
    flat.push({ ...prev, day: daysInPrev - i, isCurrent: false });
  for (let d = 1; d <= daysInMonth; d++)
    flat.push({ year, month, day: d, isCurrent: true });
  const rem = Math.ceil(flat.length / 7) * 7 - flat.length;
  for (let d = 1; d <= rem; d++)
    flat.push({ ...next, day: d, isCurrent: false });

  const weeks: CellDay[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

// ── 1日分のセル ──────────────────────────────────────────────────────────
const DayCell = React.memo(({
  cell,
  events,
  isToday,
  isSun,
  isSat,
  onPress,
  isDarkMode
}: {
  cell: CellDay;
  events: any[];
  isToday: boolean;
  isSun: boolean;
  isSat: boolean;
  onPress: (cell: CellDay) => void;
  isDarkMode: boolean;
}) => {
  const themeColors = getThemeColors(isDarkMode);
  const numColor = !cell.isCurrent
    ? (isDarkMode ? '#444' : '#ccc')
    : isSun ? '#e63946'
    : isSat ? '#2563eb'
    : themeColors.textMain;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        { borderRightColor: themeColors.border },
        !cell.isCurrent && (isDarkMode ? { backgroundColor: '#161618' } : styles.cellOther)
      ]}
      onPress={() => onPress(cell)}
      activeOpacity={0.7}
    >
      <View style={[styles.numWrap, isToday && styles.todayCircle]}>
        <Text style={[styles.dateNum, { color: isToday ? '#fff' : numColor }]}>
          {cell.day}
        </Text>
      </View>
      <Text style={[styles.rokuyo, { color: themeColors.textSub }]}>{getRokuyo(cell.year, cell.month, cell.day)}</Text>
      {events.slice(0, 3).map((evt, ei) => (
        <View key={ei} style={[styles.chip, { backgroundColor: evt.calendarColor ?? '#0a7ea4' }]}>
          <Text style={styles.chipText} numberOfLines={1}>{evt.title}</Text>
        </View>
      ))}
      {events.length > 3 && (
        <Text style={[styles.moreText, { color: themeColors.textSub }]}>+{events.length - 3}</Text>
      )}
    </TouchableOpacity>
  );
});

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { eventsByDate } = useNativeCalendarStore();
  const { setJumpDate } = useNavigationStore();
  const { isDarkMode } = useSettingsStore();

  const themeColors = getThemeColors(isDarkMode);

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const weeks = useMemo(() => buildWeeks(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = useCallback(() => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }, [viewMonth]);

  const handleDayPress = useCallback((cell: CellDay) => {
    setJumpDate(toDateStr(cell.year, cell.month, cell.day));
    router.navigate('/(tabs)');
  }, [setJumpDate]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.cardBg }]}>
      {/* ヘッダー */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={[styles.navArrow, { color: themeColors.textMain }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textMain }]}>{viewYear}年{viewMonth}月</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={[styles.navArrow, { color: themeColors.textMain }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 曜日ヘッダー */}
      <View style={[styles.dowRow, { backgroundColor: isDarkMode ? '#1C1C1E' : '#f8f8f8', borderBottomColor: themeColors.border }]}>
        {DAYS_JP.map((d, i) => (
          <Text key={d} style={[styles.dowLabel, i === 0 && styles.sunText, i === 6 && styles.satText, { color: (i === 0 || i === 6) ? undefined : themeColors.textSub }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* カレンダーグリッド */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={[styles.weekRow, { borderBottomColor: themeColors.border }]}>
            {week.map((cell, di) => {
              const dateStr = toDateStr(cell.year, cell.month, cell.day);
              return (
                <DayCell
                  key={di}
                  cell={cell}
                  events={eventsByDate[dateStr] ?? []}
                  isToday={dateStr === todayStr}
                  isSun={di === 0}
                  isSat={di === 6}
                  onPress={handleDayPress}
                  isDarkMode={isDarkMode}
                />
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 28, color: '#1a1a2e', lineHeight: 32 },

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
});
