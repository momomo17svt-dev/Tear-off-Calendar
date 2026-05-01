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

import { useEventStore } from '@/store/eventStore';
import type { CalendarEvent } from '@/types/event';
import { exportEventToNativeCalendar } from '@/utils/nativeCalendar';

// ── YYYY-MM-DD ヘルパー ─────────────────────────────────────────────────
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseDateStr = (s: string): Date => {
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
};

// ── カレンダーピッカーモーダル（iOS/Android 共通） ────────────────────────
function DatePickerModal({
  visible,
  date,
  onChange,
  onClose,
}: {
  visible: boolean;
  date: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
}) {
  const [tempDate, setTempDate] = useState(date);

  useEffect(() => {
    if (visible) setTempDate(date);
  }, [visible, date]);

  if (Platform.OS === 'ios') {
    // iOS: モーダル内にスピナー表示
    return (
      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity style={styles.pickerOverlay} onPress={onClose} activeOpacity={1}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.pickerCancel}>キャンセル</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>日付を選択</Text>
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

  // Android: inline ピッカー（Modal不要）
  if (!visible) return null;
  return (
    <DateTimePicker
      value={tempDate}
      mode="date"
      display="default"
      onChange={(_, d) => {
        onClose(); // Android は選択後自動で閉じる
        if (d) onChange(d);
      }}
    />
  );
}

// ── メイン ────────────────────────────────────────────────────────────────
export default function ModalScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const isEdit = Boolean(eventId);

  const { addEvent, editEvent, events } = useEventStore();
  const insets = useSafeAreaInsets();

  // 編集モード時は既存イベントを読み込む
  const existingEvent: CalendarEvent | undefined = isEdit
    ? events.find((e) => e.id === Number(eventId))
    : undefined;

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(
    existingEvent ? parseDateStr(existingEvent.date) : today
  );
  const [title, setTitle] = useState(existingEvent?.title ?? '');
  const [type, setType] = useState<'schedule' | 'birthday'>(
    existingEvent?.type ?? 'schedule'
  );
  const [isAnnual, setIsAnnual] = useState((existingEvent?.is_annual ?? 0) === 1);
  const [exportToNative, setExportToNative] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const dateStr = toDateStr(selectedDate);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('入力エラー', 'タイトルを入力してください');
      return;
    }

    try {
      setIsSaving(true);

      if (isEdit && existingEvent) {
        await editEvent(existingEvent.id, {
          title: title.trim(),
          date: dateStr,
          type,
          is_annual: isAnnual ? 1 : 0,
        });
      } else {
        await addEvent({
          title: title.trim(),
          date: dateStr,
          type,
          is_annual: isAnnual ? 1 : 0,
        });
      }

      // ネイティブカレンダーへのエクスポート
      if (exportToNative) {
        await exportEventToNativeCalendar({ title: title.trim(), dateStr });
      }

      router.back();
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── ヘッダー ── */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <Text style={styles.headerTitle}>
            {isEdit ? '予定を編集' : '予定を追加'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isEdit ? '内容を変更して保存してください' : 'スケジュールや誕生日を登録しよう'}
          </Text>
        </View>

        {/* ── 種類 ── */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>種類</Text>
          <View style={styles.typeSelector}>
            {([
              { value: 'schedule', label: '📌 予定', color: '#4ecdc4', bg: 'rgba(78,205,196,0.10)' },
              { value: 'birthday', label: '🎂 誕生日', color: '#ff6b6b', bg: 'rgba(255,107,107,0.10)' },
            ] as const).map((t) => {
              const isActive = type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeButton, { borderColor: t.color, backgroundColor: isActive ? t.color : t.bg }]}
                  onPress={() => setType(t.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeText, isActive && styles.typeTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 日付（カレンダーピッカー） ── */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>📅 日付</Text>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.datePickerLeft}>
              <Text style={styles.datePickerIcon}>📆</Text>
              <Text style={styles.datePickerText}>{dateStr}</Text>
            </View>
            <Text style={styles.datePickerChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* カレンダーピッカー */}
        <DatePickerModal
          visible={showPicker}
          date={selectedDate}
          onChange={(d) => setSelectedDate(d)}
          onClose={() => setShowPicker(false)}
        />

        {/* ── タイトル ── */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>✏️ タイトル</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="タイトルを入力..."
            placeholderTextColor="#bbb"
            returnKeyType="done"
            autoFocus={!isEdit}
          />
        </View>

        {/* ── 毎年繰り返し ── */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>🔁 毎年繰り返す</Text>
            <Text style={styles.toggleHint}>誕生日などに便利</Text>
          </View>
          <Switch
            value={isAnnual}
            onValueChange={setIsAnnual}
            trackColor={{ false: '#d1d5db', true: '#a5f3fc' }}
            thumbColor={isAnnual ? '#0a7ea4' : '#9ca3af'}
          />
        </View>

        {/* ── 端末カレンダーへエクスポート ── */}
        <View style={[styles.toggleRow, styles.toggleRowLast]}>
          <View>
            <Text style={styles.toggleLabel}>📲 端末カレンダーにも追加</Text>
            <Text style={styles.toggleHint}>保存時にデバイスのカレンダーと同期</Text>
          </View>
          <Switch
            value={exportToNative}
            onValueChange={setExportToNative}
            trackColor={{ false: '#d1d5db', true: '#a5f3fc' }}
            thumbColor={exportToNative ? '#0a7ea4' : '#9ca3af'}
          />
        </View>

        {/* ── ボタン ── */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </TouchableOpacity>

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

  // 種類ボタン
  typeSelector: { flexDirection: 'row', gap: 12 },
  typeButton: {
    flex: 1, paddingVertical: 13,
    borderWidth: 2, borderRadius: 14, alignItems: 'center',
  },
  typeText: { fontSize: 15, fontWeight: '700', color: '#475569' },
  typeTextActive: { color: '#fff' },

  // 日付ピッカー
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

  // iOS ピッカーモーダル
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

  // テキスト入力
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 14, padding: 14, fontSize: 16, color: '#1a1a2e',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },

  // トグル行
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  toggleRowLast: { marginBottom: 24 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  toggleHint: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // ボタン
  buttonRow: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  saveButton: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  saveButtonDisabled: { opacity: 0.6 },
  saveGradient: { paddingVertical: 15, alignItems: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
