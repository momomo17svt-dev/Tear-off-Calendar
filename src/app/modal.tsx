import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View, Button, TouchableOpacity, Alert } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useEventStore } from '@/store/eventStore';

export default function ModalScreen() {
  const addEvent = useEventStore((state) => state.addEvent);
  
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayString);
  const [type, setType] = useState<'schedule' | 'birthday'>('schedule');

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('エラー', 'タイトルを入力してください');
      return;
    }
    
    // YYYY-MM-DDの形式チェック
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      Alert.alert('エラー', '日付は YYYY-MM-DD の形式で入力してください');
      return;
    }

    try {
      await addEvent({ title: title.trim(), date, type });
      router.back();
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>予定を追加</ThemedText>

      <View style={styles.formGroup}>
        <ThemedText style={styles.label}>種類</ThemedText>
        <View style={styles.typeSelector}>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'schedule' && styles.typeButtonActive]}
            onPress={() => setType('schedule')}
          >
            <ThemedText style={type === 'schedule' ? styles.typeTextActive : styles.typeText}>予定</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeButton, type === 'birthday' && styles.typeButtonActive]}
            onPress={() => setType('birthday')}
          >
            <ThemedText style={type === 'birthday' ? styles.typeTextActive : styles.typeText}>誕生日</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formGroup}>
        <ThemedText style={styles.label}>日付 (YYYY-MM-DD)</ThemedText>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="2024-05-01"
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <View style={styles.formGroup}>
        <ThemedText style={styles.label}>タイトル</ThemedText>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="タイトルを入力"
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button title="キャンセル" onPress={() => router.back()} color="#888" />
        <Button title="保存する" onPress={handleSave} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  typeText: {
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
  typeTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});
