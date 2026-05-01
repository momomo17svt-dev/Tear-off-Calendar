import React, { useState } from 'react';
import { StyleSheet, View, Switch, Alert, Button, ScrollView, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettingsStore } from '@/store/settingsStore';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function SettingsScreen() {
  const { 
    isBgEnabled, bgUri, bgUris, bgMode, appTheme,
    setBgEnabled, setBgUri, addBgUri, removeBgUri, setBgMode, setAppTheme
  } = useSettingsStore();
  
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);

  const pickImage = async () => {
    try {
      setIsLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const sourceUri = result.assets[0].uri;
        const filename = sourceUri.split('/').pop() || `bg_${Date.now()}.jpg`;
        // eslint-disable-next-line import/namespace
        const destUri = FileSystem.documentDirectory + filename;
        
        await FileSystem.copyAsync({
          from: sourceUri,
          to: destUri,
        });

        await addBgUri(destUri);
      }
    } catch (error) {
      Alert.alert('エラー', '画像の設定に失敗しました');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (uri: string) => {
    Alert.alert(
      '確認',
      'この画像を削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => removeBgUri(uri) }
      ]
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>設定</ThemedText>

        <View style={[styles.settingRow, { zIndex: 1000 }]}>
          <ThemedText style={styles.settingLabel}>背景テーマ (背景画像なし時)</ThemedText>
          <View style={styles.customDropdownContainer}>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
            >
              <ThemedText style={styles.dropdownButtonText}>
                {appTheme === 'light-gray' ? 'グレー' : appTheme === 'corkboard' ? 'コルク' : '木目'}
              </ThemedText>
              <IconSymbol name="chevron.down" size={16} color="#333" />
            </TouchableOpacity>

            {isThemeDropdownOpen && (
              <View style={styles.dropdownList}>
                {(['light-gray', 'corkboard', 'wood'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={styles.dropdownListItem}
                    onPress={() => {
                      setAppTheme(t);
                      setIsThemeDropdownOpen(false);
                    }}
                  >
                    <ThemedText style={[styles.dropdownListText, appTheme === t && styles.dropdownListTextActive]}>
                      {t === 'light-gray' ? 'グレー' : t === 'corkboard' ? 'コルク' : '木目'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.settingRow}>
          <ThemedText style={styles.settingLabel}>背景画像を表示する</ThemedText>
          <Switch
            value={isBgEnabled}
            onValueChange={setBgEnabled}
          />
        </View>

        {isBgEnabled && (
          <>
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>表示モード</ThemedText>
              <View style={styles.modeSelector}>
                <TouchableOpacity 
                  style={[styles.modeButton, bgMode === 'fixed' && styles.modeButtonActive]}
                  onPress={() => setBgMode('fixed')}
                >
                  <ThemedText style={bgMode === 'fixed' ? styles.modeTextActive : styles.modeText}>固定</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modeButton, bgMode === 'random' && styles.modeButtonActive]}
                  onPress={() => setBgMode('random')}
                >
                  <ThemedText style={bgMode === 'random' ? styles.modeTextActive : styles.modeText}>ランダム</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.imageSection}>
              <View style={styles.imageSectionHeader}>
                <ThemedText style={styles.settingLabel}>アップロード済み画像</ThemedText>
                <Button title="画像を追加" onPress={pickImage} disabled={isLoading} />
              </View>

              {bgUris.length === 0 ? (
                <ThemedText style={styles.noImageText}>画像がありません。追加してください。</ThemedText>
              ) : (
                <View style={styles.grid}>
                  {bgUris.map((uri) => {
                    const isSelected = bgMode === 'fixed' && bgUri === uri;
                    return (
                      <TouchableOpacity 
                        key={uri} 
                        style={[styles.gridItem, isSelected && styles.gridItemSelected]}
                        onPress={() => {
                          if (bgMode === 'fixed') {
                            setBgUri(uri);
                          }
                        }}
                      >
                        <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" />
                        {isSelected && (
                          <View style={styles.checkmarkContainer}>
                            <IconSymbol name="checkmark.circle.fill" size={24} color="#fff" />
                          </View>
                        )}
                        <TouchableOpacity style={styles.deleteButton} onPress={() => handleRemove(uri)}>
                          <IconSymbol name="trash.fill" size={16} color="#fff" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  title: {
    marginBottom: 30,
    marginTop: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  settingLabel: {
    fontSize: 16,
    flexShrink: 1,
  },
  customDropdownContainer: {
    position: 'relative',
    width: 120,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginTop: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 1000,
  },
  dropdownListItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  dropdownListText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownListTextActive: {
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  modeText: {
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
  modeTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  imageSection: {
    marginTop: 30,
  },
  imageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  noImageText: {
    color: '#888',
    fontStyle: 'italic',
    marginTop: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  gridItemSelected: {
    borderColor: '#0a7ea4',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  deleteButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(255,59,48,0.8)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
