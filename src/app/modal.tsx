import * as Calendar from 'expo-calendar';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  TouchableOpacity,
  Alert,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useNativeCalendarStore } from '@/store/nativeCalendarStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getWritableCalendars, toDateString } from '@/utils/nativeCalendar';
import { getThemeColors } from '@/utils/theme';

// ── 日付ピッカーモーダル（iOS/Android 共通） ──────────────────────────────
function DatePickerModal({
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
  const [tempDate, setTempDate] = useState(date);
  const themeColors = getThemeColors(isDarkMode);

  useEffect(() => {
    if (visible) setTempDate(date);
  }, [visible, date]);

  if (Platform.OS === 'ios') {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity style={styles.pickerOverlay} onPress={onClose} activeOpacity={1}>
          <View style={[styles.pickerContainer, { backgroundColor: themeColors.cardBg }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: themeColors.border }]}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.pickerCancel}>キャンセル</Text>
              </TouchableOpacity>
              <Text style={[styles.pickerTitle, { color: themeColors.textMain }]}>日付を選択</Text>
              <TouchableOpacity onPress={() => { onChange(tempDate); onClose(); }}>
                <Text style={styles.pickerDone}>完了</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              locale="ja-JP"
              onChange={(_, d) => { if (d) setTempDate(d); }}
              style={styles.iosSpinner}
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

// ── カレンダー選択ピッカー ───────────────────────────────────────────────
function CalendarPicker({
  calendars,
  selectedId,
  onSelect,
  isDarkMode,
}: {
  calendars: Calendar.Calendar[];
  selectedId: string;
  onSelect: (id: string) => void;
  isDarkMode: boolean;
}) {
  if (calendars.length === 0) return null;
  const themeColors = getThemeColors(isDarkMode);
  return (
    <View style={styles.calendarList}>
      {calendars.map((cal) => {
        const active = cal.id === selectedId;
        return (
          <TouchableOpacity
            key={cal.id}
            style={[
              styles.calendarItem,
              { backgroundColor: themeColors.cardBg, borderColor: themeColors.border },
              active && styles.calendarItemActive
            ]}
            onPress={() => onSelect(cal.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.calendarDot, { backgroundColor: cal.color }]} />
            <Text style={[styles.calendarName, { color: themeColors.textMain }, active && styles.calendarNameActive]} numberOfLines={1}>
              {cal.title}
            </Text>
            {active && <Text style={styles.calendarCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── メイン ────────────────────────────────────────────────────────────────
export default function ModalScreen() {
  const { eventId, dateStr: initialDateStr } = useLocalSearchParams<{ eventId?: string; dateStr?: string }>();
  const isEdit = Boolean(eventId);

  const { addEvent, editEvent, removeEvent } = useNativeCalendarStore();
  const { defaultCalendarId, isDarkMode } = useSettingsStore();
  const insets = useSafeAreaInsets();
  const themeColors = getThemeColors(isDarkMode);

  const today = new Date();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialDateStr) {
      const d = new Date(initialDateStr + 'T00:00:00');
      return isNaN(d.getTime()) ? today : d;
    }
    return today;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [writableCalendars, setWritableCalendars] = useState<Calendar.Calendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(defaultCalendarId ?? '');

  useEffect(() => {
    (async () => {
      const cals = await getWritableCalendars();
      setWritableCalendars(cals);
      if (!selectedCalendarId && cals.length > 0) {
        setSelectedCalendarId(cals[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEdit || !eventId) return;
    (async () => {
      try {
        const ev = await Calendar.getEventAsync(eventId);
        if (ev) {
          setTitle(ev.title ?? '');
          setNotes(ev.notes ?? '');
          setIsAllDay(ev.allDay ?? true);
          setSelectedDate(new Date(ev.startDate));
          setSelectedCalendarId(ev.calendarId);
        }
      } catch {
        useNativeCalendarStore.getState().purgeStaleEvent(eventId);
        Alert.alert(
          'イベントが見つかりません',
          'この予定はカレンダーから削除されています。',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    })();
  }, [eventId, isEdit]);

  const dateDisplayStr = toDateString(selectedDate);

  const buildStartEnd = () => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    if (isAllDay) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(9, 0, 0, 0);
      end.setHours(10, 0, 0, 0);
    }
    return { start, end };
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('入力エラー', 'タイトルを入力してください');
      return;
    }
    if (!selectedCalendarId) {
      Alert.alert('入力エラー', 'カレンダーを選択してください');
      return;
    }

    try {
      setIsSaving(true);
      const { start, end } = buildStartEnd();

      if (isEdit && eventId) {
        await editEvent(eventId, {
          title: title.trim(),
          startDate: start,
          endDate: end,
          isAllDay,
          notes: notes.trim() || null,
        });
      } else {
        await addEvent(selectedCalendarId, {
          title: title.trim(),
          startDate: start,
          endDate: end,
          isAllDay,
          notes: notes.trim() || null,
        });
      }

      router.back();
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!eventId) return;
    Alert.alert('削除の確認', `「${title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await removeEvent(eventId, dateDisplayStr);
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { backgroundColor: isDarkMode ? '#111' : '#f5f7fa' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── ヘッダー ── */}
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: isDarkMode ? '#444' : '#d1d5db' }]} />
          <Text style={[styles.headerTitle, { color: themeColors.textMain }]}>
            {isEdit ? '予定を編集' : '予定を追加'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSub }]}>
            {isEdit ? '内容を変更して保存してください' : 'ネイティブカレンダーに直接保存されます'}
          </Text>
        </View>

        {/* ── 日付 ── */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textMain }]}>📅 日付</Text>
          <TouchableOpacity
            style={[styles.datePickerButton, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.datePickerLeft}>
              <Text style={styles.datePickerIcon}>📆</Text>
              <Text style={[styles.datePickerText, { color: themeColors.textMain }]}>{dateDisplayStr}</Text>
            </View>
            <Text style={[styles.datePickerChevron, { color: themeColors.border }]}>›</Text>
          </TouchableOpacity>
        </View>

        <DatePickerModal
          visible={showPicker}
          date={selectedDate}
          onChange={(d) => setSelectedDate(d)}
          onClose={() => setShowPicker(false)}
          isDarkMode={isDarkMode}
        />

        {/* ── タイトル ── */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textMain }]}>✏️ タイトル</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border, color: themeColors.textMain }]}
            value={title}
            onChangeText={setTitle}
            placeholder="タイトルを入力..."
            placeholderTextColor={isDarkMode ? '#555' : '#bbb'}
            returnKeyType="done"
            autoFocus={!isEdit}
          />
        </View>

        {/* ── メモ ── */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textMain }]}>📝 メモ（任意）</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border, color: themeColors.textMain }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="メモを入力..."
            placeholderTextColor={isDarkMode ? '#555' : '#bbb'}
            multiline
            returnKeyType="default"
          />
        </View>

        {/* ── 終日 ── */}
        <View style={[styles.toggleRow, { backgroundColor: themeColors.cardBg }]}>
          <View>
            <Text style={[styles.toggleLabel, { color: themeColors.textMain }]}>🕐 終日イベント</Text>
            <Text style={[styles.toggleHint, { color: themeColors.textSub }]}>オフにすると 9:00〜10:00 で登録</Text>
          </View>
          <Switch
            value={isAllDay}
            onValueChange={setIsAllDay}
            trackColor={{ false: '#d1d5db', true: '#30d158' }}
            thumbColor={isAllDay ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        {/* ── カレンダー選択 ── */}
        {!isEdit && (
          <View style={[styles.formGroup, styles.toggleRowLast]}>
            <Text style={[styles.label, { color: themeColors.textMain }]}>📋 保存先カレンダー</Text>
            <CalendarPicker
              calendars={writableCalendars}
              selectedId={selectedCalendarId}
              onSelect={setSelectedCalendarId}
              isDarkMode={isDarkMode}
            />
          </View>
        )}

        {/* ── ボタン ── */}
        <View style={styles.buttonRow}>
          {isEdit ? (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: isDarkMode ? '#3D1F1F' : '#fff2f2', borderColor: isDarkMode ? '#6B2D2D' : '#fca5a5' }]}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteButtonText}>🗑️ 削除</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelButtonText, { color: themeColors.textSub }]}>キャンセル</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#0ea5e9', '#0a7ea4']} style={styles.saveGradient}>
              <Text style={styles.saveButtonText}>
                {isSaving ? '保存中...' : isEdit ? '変更を保存 ✓' : '保存する ✓'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {isEdit && (
          <TouchableOpacity
            style={[styles.cancelButtonFull, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border, marginTop: 12 }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelButtonText, { color: themeColors.textSub }]}>キャンセル</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── スタイル ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f5f7fa' },
  container: { padding: 20, paddingTop: 12 },

  header: { alignItems: 'center', marginBottom: 24 },
  handle: { width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#1a1a2e', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4, fontWeight: '500' },

  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 10, letterSpacing: 0.2 },

  datePickerButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  datePickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  datePickerIcon: { fontSize: 20 },
  datePickerText: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', letterSpacing: 0.5 },
  datePickerChevron: { fontSize: 22, color: '#94a3b8', fontWeight: '300' },

  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
  },
  pickerCancel: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  pickerDone: { fontSize: 16, color: '#0a7ea4', fontWeight: '800' },
  iosSpinner: { height: 200 },

  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 14, padding: 14, fontSize: 16, color: '#1a1a2e',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  toggleRowLast: { marginBottom: 24 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  toggleHint: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  calendarList: { gap: 8 },
  calendarItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  calendarItemActive: { borderColor: '#0a7ea4', backgroundColor: 'rgba(10,126,164,0.06)' },
  calendarDot: { width: 12, height: 12, borderRadius: 6 },
  calendarName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#334155' },
  calendarNameActive: { fontWeight: '700', color: '#0a7ea4' },
  calendarCheck: { fontSize: 15, color: '#0a7ea4', fontWeight: '800' },

  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  cancelButton: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  cancelButtonFull: {
    paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  deleteButton: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', backgroundColor: '#fff2f2',
    borderWidth: 1.5, borderColor: '#fca5a5',
  },
  deleteButtonText: { fontSize: 16, fontWeight: '600', color: '#e63946' },
  saveButton: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  saveButtonDisabled: { opacity: 0.6 },
  saveGradient: { paddingVertical: 15, alignItems: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
