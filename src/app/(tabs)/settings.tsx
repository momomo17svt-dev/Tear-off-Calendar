import React, { useState, useEffect, useCallback } from 'react';
import {
  AppState,
  Dimensions,
  Linking,
  Platform,
  StyleSheet,
  View,
  Switch,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { useHealthStore } from '@/store/healthStore';
import { useNativeCalendarStore } from '@/store/nativeCalendarStore';
import { useSettingsStore } from '@/store/settingsStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getThemeColors, getBackgroundGradient } from '@/utils/theme';
import { ensurePhotoPermission, presentLimitedLibraryPicker } from '@/utils/diaryImages';
import { deleteTag, getAllTags, insertTag, renameTag, type Tag } from '@/db/tags';

/**
 * 設定画面コンポーネント
 * アプリのテーマ、表示カレンダー、背景画像などの設定を管理します。
 */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// 背景画像のサムネイル表示用アスペクト比の計算
const CARD_IMAGE_ASPECT = (SCREEN_WIDTH * 0.88) / (SCREEN_HEIGHT * 0.70 * 0.36);

/**
 * 背景テーマのプリセット定義
 */
const THEMES = [
  { key: 'washi',      label: '和紙',  emoji: '📄', colors: ['#FAF7F0', '#F0E8D8'] as [string, string] },
  { key: 'light-gray', label: 'グレー', emoji: '🩶', colors: ['#E8EDF2', '#D0D7E0'] as [string, string] },
  { key: 'corkboard',  label: 'コルク', emoji: '🪵', colors: ['#C89D7C', '#A0785A'] as [string, string] },
  { key: 'wood',       label: '木目',  emoji: '🌲', colors: ['#8D6E63', '#5D4037'] as [string, string] },
  { key: 'sakura',     label: '桜',    emoji: '🌸', colors: ['#FCEEF3', '#F9D0DF'] as [string, string] },
  { key: 'matcha',     label: '抹茶',  emoji: '🍵', colors: ['#D8EDD8', '#B8D4B0'] as [string, string] },
  { key: 'aizome',     label: '藍染',  emoji: '🫙', colors: ['#5B8DB8', '#3A6A96'] as [string, string] },
  { key: 'momiji',     label: '紅葉',  emoji: '🍁', colors: ['#EDA878', '#D4764A'] as [string, string] },
] as const;

/**
 * カードデザインのプリセット定義
 */
const CARD_STYLES = [
  { key: 'tear-off', label: '日めくり', icon: '📄' },
  { key: 'ring',     label: 'リング',   icon: '📓' },
  { key: 'polaroid', label: 'ポラロイド', icon: '📸' },
  { key: 'minimal',  label: 'ミニマル', icon: '📱' },
] as const;

export default function SettingsScreen() {
  // 設定ストアから状態とアクションを取得
  const {
    isBgEnabled, bgUri, bgUris, bgMode, appTheme,
    isDarkMode,
    selectedCalendarIds,
    cardStyle,
    setBgEnabled, setBgUri, addBgUri, removeBgUri, setBgMode, setAppTheme,
    setDarkMode,
    setSelectedCalendarIds,
    setCardStyle,
  } = useSettingsStore();

  // ネイティブカレンダー（iOS/Androidのカレンダーアプリ）の状態を取得
  const { availableCalendars, loadCalendars, fetchAll } = useNativeCalendarStore();

  // ヘルスケア連携設定
  const {
    healthEnabled, showSteps, showSleep, showHeartRate, showActiveEnergy, showWeight,
    setHealthEnabled, setShowItem,
  } = useHealthStore();

  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);

  // 日記の写真アクセス権限状態
  // 'unknown' は初回フェッチ前 / 取得失敗時のフォールバック。それ以外は MediaLibrary の生値を保持する。
  const [photoPermStatus, setPhotoPermStatus] = useState<MediaLibrary.PermissionStatus | 'unknown'>('unknown');
  const [photoAccessPrivileges, setPhotoAccessPrivileges] =
    useState<MediaLibrary.PermissionResponse['accessPrivileges']>('none');

  /**
   * 現在の写真ライブラリ権限を再フェッチして state に反映する。
   * 設定アプリから戻ってきたタイミングなどで呼び出す。
   */
  const refreshPhotoPerm = useCallback(async () => {
    try {
      const perm = await MediaLibrary.getPermissionsAsync();
      setPhotoPermStatus(perm.status);
      setPhotoAccessPrivileges(perm.accessPrivileges);
    } catch {
      setPhotoPermStatus('unknown');
      setPhotoAccessPrivileges('none');
    }
  }, []);

  // コンポーネントマウント時に利用可能なカレンダーを読み込む
  useEffect(() => {
    loadCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 写真権限の初回取得 + AppState がアクティブに戻った時の再取得（設定アプリから戻った時の追従）
  useEffect(() => {
    refreshPhotoPerm();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshPhotoPerm();
    });
    return () => sub.remove();
  }, [refreshPhotoPerm]);

  /**
   * 「アクセスを許可」ボタン押下。
   * 未確認 → OS のダイアログを出す。それ以外（denied 等）は設定アプリへ誘導する。
   */
  const handleRequestPhotoPerm = async () => {
    if (photoPermStatus === 'undetermined' || photoPermStatus === 'unknown') {
      await ensurePhotoPermission();
      await refreshPhotoPerm();
      return;
    }
    // 既に拒否済みなどでアプリからは変更不可。設定アプリへ
    await Linking.openSettings();
  };

  /** iOS の制限付きアクセス時、許可写真の選択を変更する OS ピッカーを表示する。 */
  const handleOpenLimitedPicker = async () => {
    await presentLimitedLibraryPicker();
    await refreshPhotoPerm();
  };

  // ── 日記タグマスター ──
  const [tagList, setTagList] = useState<Tag[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  /** リネーム編集中のタグ ID（null なら誰も編集中でない）。 */
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  /** マスタータグ一覧を DB から再取得して state に反映する。 */
  const refreshTags = useCallback(async () => {
    try {
      const list = await getAllTags();
      setTagList(list);
    } catch (e) {
      console.warn('refreshTags failed', e);
    }
  }, []);

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  /** 新規タグを追加する。重複・空文字は無視（insertTag 側でガード済み）。 */
  const handleAddTag = async () => {
    const name = newTagInput.trim();
    if (!name) return;
    await insertTag(name);
    setNewTagInput('');
    await refreshTags();
  };

  /** タグマスターから削除。過去日記の tags JSON は触らない（履歴保護）。 */
  const handleDeleteTag = (tag: Tag) => {
    Alert.alert(
      'タグを削除',
      `「${tag.name}」を削除しますか？\n（過去の日記についているこのタグはそのまま残ります）`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deleteTag(tag.id);
            await refreshTags();
          },
        },
      ]
    );
  };

  const handleStartRename = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  const handleCancelRename = () => {
    setEditingTagId(null);
    setEditingTagName('');
  };

  const handleCommitRename = async () => {
    if (editingTagId === null) return;
    const next = editingTagName.trim();
    if (!next) {
      handleCancelRename();
      return;
    }
    await renameTag(editingTagId, next);
    handleCancelRename();
    await refreshTags();
  };

  // 現在のモード（ライト/ダーク）に応じた色を取得
  const themeColors = getThemeColors(isDarkMode);

  /**
   * カレンダーの表示・非表示を切り替える
   * @param calendarId カレンダーID
   * @param enabled 有効にするかどうか
   */
  const handleCalendarToggle = async (calendarId: string, enabled: boolean) => {
    let next: string[];
    if (selectedCalendarIds.length === 0) {
      // 選択リストが空の場合は「すべて表示」の状態。
      // 特定のカレンダーをOFFにする場合は、他の全IDを選択状態にしてから対象を除外する
      const allIds = availableCalendars.map((c) => c.id);
      next = enabled ? allIds : allIds.filter((id) => id !== calendarId);
    } else {
      next = enabled
        ? [...selectedCalendarIds, calendarId]
        : selectedCalendarIds.filter((id) => id !== calendarId);
    }
    await setSelectedCalendarIds(next);
    await fetchAll(); // ホーム画面などのデータを更新
  };

  /**
   * 特定のカレンダーが現在有効（表示対象）かどうかを判定
   */
  const isCalendarEnabled = (calendarId: string) => {
    if (selectedCalendarIds.length === 0) return true;
    return selectedCalendarIds.includes(calendarId);
  };

  /**
   * 端末のフォトライブラリから背景画像を選択する
   */
  const pickImage = async () => {
    try {
      setIsLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const sourceUri = result.assets[0].uri;
        
        // 画像をリサイズ・圧縮してパフォーマンス（ちらつき・メモリ使用量）を改善
        const manipResult = await ImageManipulator.manipulateAsync(
          sourceUri,
          [{ resize: { width: 1080 } }], // 横幅を最大1080pxにリサイズ
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        const filename = `bg_${Date.now()}.jpg`;
        // 画像をアプリのドキュメントディレクトリに保存（永続化）
        const destUri = FileSystem.documentDirectory + filename;
        await FileSystem.copyAsync({ from: manipResult.uri, to: destUri });
        await addBgUri(destUri);
      }
    } catch {
      Alert.alert('エラー', '画像の設定に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 設定された背景画像を削除する
   */
  const handleRemove = (uri: string) => {
    Alert.alert('確認', 'この画像を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => removeBgUri(uri) },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.cardBg }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── ヘッダー ── */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: themeColors.textMain }]}>設定</Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSub }]}>カレンダーをカスタマイズ</Text>
        </View>

        {/* ── ダークモード設定 ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>🌙 ダークモード</Text>
              <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>目に優しい配色に切り替えます</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#d1d5db', true: '#30d158' }}
              thumbColor={isDarkMode ? '#ffffff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* ── 表示するカレンダーの選択 ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>📋 表示するカレンダー</Text>
          <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>ホーム画面に表示する予定のカレンダーを選択</Text>

          {availableCalendars.length === 0 ? (
            <View style={styles.calendarEmptyState}>
              <Text style={styles.calendarEmptyText}>カレンダーが見つかりません</Text>
              <Text style={styles.calendarEmptyHint}>カレンダーへのアクセス許可が必要です</Text>
            </View>
          ) : (
            <View style={styles.calendarList}>
              {availableCalendars.map((cal) => (
                <View key={cal.id} style={[styles.calendarRow, { borderBottomColor: themeColors.border }]}>
                  <View style={[styles.calendarDot, { backgroundColor: cal.color }]} />
                  <Text style={[styles.calendarName, { color: themeColors.textMain }]} numberOfLines={1}>{cal.title}</Text>
                  <Switch
                    value={isCalendarEnabled(cal.id)}
                    onValueChange={(v) => handleCalendarToggle(cal.id, v)}
                    trackColor={{ false: '#d1d5db', true: '#a5f3fc' }}
                    thumbColor={isCalendarEnabled(cal.id) ? '#0a7ea4' : '#9ca3af'}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── 日記の写真アクセス ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>📷 日記の写真アクセス</Text>
          <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>
            日記モーダルで「その日の写真」を提案するために使います
          </Text>

          {(() => {
            // ステータス文言と推奨アクションのラベルを状態から導出
            let statusLabel = '未確認';
            let statusColor = '#94a3b8';
            let primaryAction: { label: string; onPress: () => void } | null = null;
            let secondaryAction: { label: string; onPress: () => void } | null = null;

            if (photoPermStatus === 'granted' && photoAccessPrivileges === 'all') {
              statusLabel = '✓ すべての写真を許可中';
              statusColor = '#16a34a';
              secondaryAction = { label: '設定アプリで変更', onPress: () => Linking.openSettings() };
            } else if (photoPermStatus === 'granted' && photoAccessPrivileges === 'limited') {
              statusLabel = '⚠️ 制限付きアクセス（一部の写真のみ）';
              statusColor = '#d97706';
              primaryAction = { label: '写真の選択を変更', onPress: handleOpenLimitedPicker };
              secondaryAction = { label: '設定アプリで全許可にする', onPress: () => Linking.openSettings() };
            } else if (photoPermStatus === 'denied') {
              statusLabel = '✕ アクセスが許可されていません';
              statusColor = '#dc2626';
              primaryAction = { label: '設定アプリを開く', onPress: () => Linking.openSettings() };
            } else {
              // undetermined / unknown
              statusLabel = '— まだ許可をリクエストしていません';
              statusColor = '#94a3b8';
              primaryAction = { label: 'アクセスを許可', onPress: handleRequestPhotoPerm };
            }

            return (
              <>
                <Text style={[styles.photoPermStatus, { color: statusColor }]}>{statusLabel}</Text>
                <View style={styles.photoPermButtonRow}>
                  {primaryAction && (
                    <TouchableOpacity
                      style={styles.photoPermPrimaryButton}
                      onPress={primaryAction.onPress}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.photoPermPrimaryText}>{primaryAction.label}</Text>
                    </TouchableOpacity>
                  )}
                  {secondaryAction && (
                    <TouchableOpacity
                      style={[styles.photoPermSecondaryButton, { borderColor: themeColors.border }]}
                      onPress={secondaryAction.onPress}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.photoPermSecondaryText, { color: themeColors.textMain }]}>
                        {secondaryAction.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {Platform.OS === 'android' && (
                  <Text style={[styles.photoPermNote, { color: themeColors.textSub }]}>
                    Android では「制限付きアクセス」の概念はありません。
                  </Text>
                )}
              </>
            );
          })()}
        </View>

        {/* ── 日記タグの管理 ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>🏷 日記タグの管理</Text>
          <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>
            日記モーダルではここに登録したタグからのみ選択できます（タイポ防止）
          </Text>

          {/* 新規追加入力 */}
          <View style={styles.tagAddRow}>
            <TextInput
              style={[
                styles.tagAddInput,
                { backgroundColor: isDarkMode ? '#1c1c1e' : '#f8fafc', borderColor: themeColors.border, color: themeColors.textMain },
              ]}
              value={newTagInput}
              onChangeText={setNewTagInput}
              onSubmitEditing={handleAddTag}
              placeholder="新しいタグを追加..."
              placeholderTextColor={isDarkMode ? '#555' : '#bbb'}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.tagAddButton, !newTagInput.trim() && styles.tagAddButtonDisabled]}
              onPress={handleAddTag}
              disabled={!newTagInput.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.tagAddButtonText}>＋ 追加</Text>
            </TouchableOpacity>
          </View>

          {/* タグ一覧 */}
          {tagList.length === 0 ? (
            <Text style={[styles.tagEmpty, { color: themeColors.textSub }]}>
              まだタグが登録されていません。
            </Text>
          ) : (
            <View style={styles.tagList}>
              {tagList.map((tag) => {
                const isEditing = editingTagId === tag.id;
                return (
                  <View
                    key={tag.id}
                    style={[
                      styles.tagRow,
                      { borderBottomColor: themeColors.border },
                    ]}
                  >
                    {isEditing ? (
                      <>
                        <TextInput
                          style={[
                            styles.tagRenameInput,
                            { borderColor: themeColors.border, color: themeColors.textMain, backgroundColor: isDarkMode ? '#1c1c1e' : '#f8fafc' },
                          ]}
                          value={editingTagName}
                          onChangeText={setEditingTagName}
                          autoFocus
                          autoCorrect={false}
                          autoCapitalize="none"
                          onSubmitEditing={handleCommitRename}
                          returnKeyType="done"
                        />
                        <TouchableOpacity onPress={handleCommitRename} hitSlop={8}>
                          <Text style={styles.tagRowActionPrimary}>保存</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleCancelRename} hitSlop={8}>
                          <Text style={[styles.tagRowAction, { color: themeColors.textSub }]}>キャンセル</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.tagRowName, { color: themeColors.textMain }]} numberOfLines={1}>
                          #{tag.name}
                        </Text>
                        <TouchableOpacity onPress={() => handleStartRename(tag)} hitSlop={8}>
                          <Text style={styles.tagRowAction}>編集</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteTag(tag)} hitSlop={8}>
                          <Text style={styles.tagRowDelete}>削除</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── カードデザイン ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>🗂️ カードデザイン</Text>
          <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>カレンダーの形状（スタイル）を変更します</Text>

          <View style={styles.cardStyleGrid}>
            {CARD_STYLES.map((style) => {
              const isActive = cardStyle === style.key;
              return (
                <TouchableOpacity
                  key={style.key}
                  style={[styles.cardStyleButton, isActive && styles.cardStyleButtonActive]}
                  onPress={() => setCardStyle(style.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardStyleIcon}>{style.icon}</Text>
                  <Text style={[styles.cardStyleLabel, isActive && styles.cardStyleLabelActive]}>
                    {style.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 背景テーマ（グラデーション/テクスチャ） ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>🎨 背景テーマ</Text>
          <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>画像が未設定の場合に適用されます</Text>

          <View style={styles.themeGrid}>
            {THEMES.map((theme) => {
              const isActive = appTheme === theme.key;
              return (
                <TouchableOpacity
                  key={theme.key}
                  style={[styles.themeCard, isActive && styles.themeCardActive]}
                  onPress={() => setAppTheme(theme.key)}
                  activeOpacity={0.75}
                >
                  <LinearGradient
                    colors={getBackgroundGradient(theme.key, isDarkMode)}
                    style={styles.themePreview}
                  >
                    <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                  </LinearGradient>
                  <Text style={[styles.themeLabel, isActive && styles.themeLabelActive]}>
                    {theme.label}
                  </Text>
                  {isActive && (
                    <View style={styles.themeCheckmark}>
                      <IconSymbol name="checkmark.circle.fill" size={18} color="#0a7ea4" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 背景画像（ユーザー写真） ── */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>🖼️ 背景画像</Text>
              <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>カレンダーに写真を設定</Text>
            </View>
            <Switch
              value={isBgEnabled}
              onValueChange={setBgEnabled}
              trackColor={{ false: '#d1d5db', true: '#a5f3fc' }}
              thumbColor={isBgEnabled ? '#0a7ea4' : '#9ca3af'}
            />
          </View>

          {isBgEnabled && (
            <>
              {/* 表示モード選択 (固定 or ランダム) */}
              <View style={styles.modeContainer}>
                <Text style={[styles.modeLabel, { color: themeColors.textMain }]}>表示モード</Text>
                <View style={styles.modeSelector}>
                  {(['fixed', 'random'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.modeButton, bgMode === mode && styles.modeButtonActive]}
                      onPress={() => setBgMode(mode)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modeText, bgMode === mode && styles.modeTextActive]}>
                        {mode === 'fixed' ? '📌 固定' : '🎲 ランダム'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 画像グリッド表示 */}
              <View style={styles.imageSection}>
                <View style={styles.imageSectionHeader}>
                  <Text style={[styles.imageCount, { color: themeColors.textSub }]}>
                    {bgUris.length > 0 ? `${bgUris.length}枚の画像` : '画像がありません'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.addButton, isLoading && styles.addButtonDisabled]}
                    onPress={pickImage}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <IconSymbol name="plus" size={16} color="#fff" />
                        <Text style={styles.addButtonText}>追加</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {bgUris.length === 0 ? (
                  <View style={styles.emptyImageState}>
                    <Text style={styles.emptyImageIcon}>📷</Text>
                    <Text style={[styles.emptyImageText, { color: themeColors.textSub }]}>画像がありません</Text>
                    <Text style={[styles.emptyImageHint, { color: themeColors.textSub, opacity: 0.7 }]}>「追加」ボタンから写真を選んでください</Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {bgUris.map((uri) => {
                      const isSelected = bgMode === 'fixed' && bgUri === uri;
                      return (
                        <TouchableOpacity
                          key={uri}
                          style={[styles.gridItem, isSelected && styles.gridItemSelected]}
                          onPress={() => {
                            if (bgMode === 'fixed') setBgUri(uri);
                          }}
                          activeOpacity={0.85}
                        >
                          <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" />

                          {isSelected && (
                            <View style={styles.selectedOverlay}>
                              <IconSymbol
                                name="checkmark.circle.fill"
                                size={28}
                                color="#fff"
                              />
                            </View>
                          )}

                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleRemove(uri)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <IconSymbol name="xmark" size={10} color="#fff" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* ── ヘルスケア連携（iOS のみ） ── */}
        {Platform.OS === 'ios' && (
          <View style={[styles.section, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: themeColors.textMain }]}>❤️‍🩹 ヘルスケア連携</Text>
                <Text style={[styles.sectionDesc, { color: themeColors.textSub }]}>
                  日記タブにその日の歩数・睡眠などを表示します
                </Text>
              </View>
              <Switch
                value={healthEnabled}
                onValueChange={setHealthEnabled}
                trackColor={{ false: '#d1d5db', true: '#30d158' }}
                thumbColor={healthEnabled ? '#ffffff' : '#f4f3f4'}
              />
            </View>

            {healthEnabled && (
              <View style={styles.healthItemList}>
                {([
                  { key: 'showSteps',        emoji: '🏃', label: '歩数',        value: showSteps },
                  { key: 'showActiveEnergy', emoji: '🔥', label: '消費カロリー',  value: showActiveEnergy },
                  { key: 'showSleep',        emoji: '😴', label: '睡眠',        value: showSleep },
                  { key: 'showHeartRate',    emoji: '❤️', label: '心拍数',      value: showHeartRate },
                  { key: 'showWeight',       emoji: '⚖️', label: '体重',        value: showWeight },
                ] as const).map((item, idx, arr) => (
                  <View
                    key={item.key}
                    style={[
                      styles.healthItemRow,
                      { borderBottomColor: themeColors.border },
                      idx === arr.length - 1 && styles.healthItemRowLast,
                    ]}
                  >
                    <Text style={styles.healthItemEmoji}>{item.emoji}</Text>
                    <Text style={[styles.healthItemLabel, { color: themeColors.textMain }]}>
                      {item.label}
                    </Text>
                    <Switch
                      value={item.value}
                      onValueChange={(v) => setShowItem(item.key, v)}
                      trackColor={{ false: '#d1d5db', true: '#a5f3fc' }}
                      thumbColor={item.value ? '#0a7ea4' : '#9ca3af'}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── アプリ情報 ── */}
        <View style={[styles.section, styles.aboutSection, { backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Text style={[styles.appName, { color: themeColors.textMain }]}>📅 日めくりカレンダー</Text>
          <Text style={[styles.appVersion, { color: themeColors.textSub }]}>Version 1.0.0</Text>
          <Text style={[styles.appDesc, { color: themeColors.textSub }]}>
            毎日の予定を、お気に入りの写真と一緒に。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '400',
    marginBottom: 14,
  },
  // ── カレンダーセクション ──
  calendarEmptyState: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  calendarEmptyText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  calendarEmptyHint: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  calendarList: {
    gap: 6,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  calendarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  calendarName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  // ── テーマセクション ──
  themeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 0,
  },
  themeCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'visible',
    borderWidth: 2.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  themeCardActive: {
    borderColor: '#0a7ea4',
  },
  themePreview: {
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeEmoji: {
    fontSize: 24,
  },
  themeLabel: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  themeLabelActive: {
    color: '#0a7ea4',
    fontWeight: '700',
  },
  themeCheckmark: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  // ── カードスタイルセクション ──
  cardStyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  cardStyleButton: {
    width: '48%',
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cardStyleButtonActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  cardStyleIcon: {
    fontSize: 16,
  },
  cardStyleLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  cardStyleLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  // ── 表示モードセクション ──
  modeContainer: {
    marginBottom: 20,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  modeButtonActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  modeText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  imageSection: {
    marginTop: 4,
  },
  imageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  imageCount: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  addButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyImageState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyImageIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyImageText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptyImageHint: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '46%',
    aspectRatio: CARD_IMAGE_ASPECT,
    borderRadius: 12,
    overflow: 'hidden',
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
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,126,164,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── ヘルスケアセクション ──
  healthItemList: {
    marginTop: 4,
  },
  healthItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  healthItemRowLast: {
    borderBottomWidth: 0,
  },
  healthItemEmoji: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
  },
  healthItemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  // ── 日記タグ管理セクション ──
  tagAddRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  tagAddInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 14,
  },
  tagAddButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tagAddButtonDisabled: {
    opacity: 0.4,
  },
  tagAddButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tagEmpty: {
    fontSize: 13,
    paddingVertical: 8,
  },
  tagList: {
    marginTop: 4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tagRowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  tagRowAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a7ea4',
  },
  tagRowActionPrimary: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0a7ea4',
  },
  tagRowDelete: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  tagRenameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    fontSize: 14,
  },

  // ── 日記の写真アクセスセクション ──
  photoPermStatus: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  photoPermButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoPermPrimaryButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  photoPermPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  photoPermSecondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  photoPermSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoPermNote: {
    fontSize: 12,
    marginTop: 10,
  },
  aboutSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
    fontWeight: '500',
  },
  appDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
});
