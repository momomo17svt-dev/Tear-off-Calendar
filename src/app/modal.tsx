import { router } from 'expo-router';
import { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useEventStore } from '@/store/eventStore';

const today = new Date();
const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

export default function ModalScreen() {
  const addEvent = useEventStore((state) => state.addEvent);
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayString);
  const [type, setType] = useState<'schedule' | 'birthday'>('schedule');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('入力エラー', 'タイトルを入力してください');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      Alert.alert('入力エラー', '日付は YYYY-MM-DD の形式で入力してください\n例: 2026-05-01');
      return;
    }

    try {
      setIsSaving(true);
      await addEvent({ title: title.trim(), date, type });
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
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── ヘッダー ── */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <Text style={styles.headerTitle}>予定を追加</Text>
          <Text style={styles.headerSubtitle}>スケジュールや誕生日を登録しよう</Text>
        </View>

        {/* ── 種類セレクター ── */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>種類</Text>
          <View style={styles.typeSelector}>
            {([
              { value: 'schedule', label: '📌 予定', color: '#4ecdc4', bg: 'rgba(78,205,196,0.1)' },
              { value: 'birthday', label: '🎂 誕生日', color: '#ff6b6b', bg: 'rgba(255,107,107,0.1)' },
            ] as const).map((t) => {
              const isActive = type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.typeButton,
                    { borderColor: t.color, backgroundColor: isActive ? t.color : t.bg },
                  ]}
                  onPress={() => setType(t.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeText, isActive && styles.typeTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 日付入力 ── */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>📅 日付</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#bbb"
            keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.inputHint}>例: 2026-05-01</Text>
        </View>

        {/* ── タイトル入力 ── */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>✏️ タイトル</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="タイトルを入力..."
            placeholderTextColor="#bbb"
            returnKeyType="done"
            autoFocus
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
            <LinearGradient
              colors={['#0ea5e9', '#0a7ea4']}
              style={styles.saveButtonGradient}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? '保存中...' : '保存する ✓'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  container: {
    padding: 20,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 22,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#1a1a2e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 5,
    marginLeft: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 13,
    borderWidth: 2,
    borderRadius: 14,
    alignItems: 'center',
  },
  typeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  typeTextActive: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  saveButton: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
