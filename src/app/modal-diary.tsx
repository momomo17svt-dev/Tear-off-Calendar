/**
 * 日記の追加・編集・削除モーダル
 * - 新規作成時: dateStr パラメータの日付を初期値とする
 * - 編集時: id パラメータで既存日記を読み込む
 * - 入力フィールド: タイトル / 本文 / タグ（カンマ区切り） / 画像（複数）
 * - 日付ボタンで日付ピッカー（modal.tsx と同じ DatePickerModal を内製）
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDiaryById } from '@/db/diaries';
import { getAllTags } from '@/db/tags';
import { useDiaryStore } from '@/store/diaryStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  DIARY_IMAGE_LIMIT,
  DiaryPhotoSuggestion,
  deleteImageFile,
  ensurePhotoPermission,
  getPhotosForDate,
  pickAndStoreImages,
  presentLimitedLibraryPicker,
  storePhotoAssetAsDiaryImage,
} from '@/utils/diaryImages';
import { toDateString } from '@/utils/nativeCalendar';
import { getThemeColors } from '@/utils/theme';

/**
 * 日付ピッカーモーダル
 * iOS: 底からせり上がるスピナー / Android: 標準ダイアログ
 * （modal.tsx の DatePickerModal と同型）
 */
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

export default function ModalDiaryScreen() {
  const { id, dateStr, prefillAssetId, prefillAssetUri } = useLocalSearchParams<{
    id?: string;
    dateStr?: string;
    /** 日記タブから「この日の写真」をタップして遷移してきた時に渡される MediaLibrary アセット */
    prefillAssetId?: string;
    prefillAssetUri?: string;
  }>();
  const editingId = id ? Number(id) : null;
  const isEdit = editingId !== null && !Number.isNaN(editingId);

  const insets = useSafeAreaInsets();
  const { isDarkMode } = useSettingsStore();
  const themeColors = getThemeColors(isDarkMode);

  const { addDiary, editDiary, removeDiary } = useDiaryStore();

  // フォーム状態
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  /** 選択中のタグ。チップ群から選択／解除されるたびに更新される。重複・空文字は持たない。 */
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  /** 候補タグ（設定タブの「🏷 日記タグの管理」で登録されたマスタータグ）。 */
  const [tagCandidates, setTagCandidates] = useState<string[]>([]);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (dateStr) {
      const d = new Date(`${dateStr}T00:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [showPicker, setShowPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  // 編集モードで「保存せずに閉じた」時に既存ファイルを残せるよう、追加分のみ追跡
  const [pendingNewImageUris, setPendingNewImageUris] = useState<string[]>([]);

  // 「この日の写真」サジェスト関連
  const [suggestions, setSuggestions] = useState<DiaryPhotoSuggestion[]>([]);
  const [suggestionsState, setSuggestionsState] = useState<
    'idle' | 'loading' | 'denied' | 'granted' | 'limited' | 'empty'
  >('idle');
  // MediaLibrary のアセットID → 保存後のローカルURI のマップ。
  // 「サジェスト一覧でタップ済み」のマーク表示と、上のサムネイルを外したときの整合性に使う。
  const [assetIdToStoredUri, setAssetIdToStoredUri] = useState<Map<string, string>>(new Map());

  // 編集モード時に既存日記をロード
  useEffect(() => {
    if (!isEdit || editingId === null) return;
    (async () => {
      const d = await getDiaryById(editingId);
      if (!d) {
        Alert.alert('日記が見つかりません', 'この日記は削除された可能性があります。', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setTitle(d.title);
      setContent(d.content);
      setSelectedTags(d.tags);
      setImageUris(d.imageUris);
      const [y, m, day] = d.date.split('-').map(Number);
      setSelectedDate(new Date(y, m - 1, day));
    })();
  }, [isEdit, editingId]);

  const dateDisplayStr = useMemo(() => toDateString(selectedDate), [selectedDate]);

  // タグマスター（settings タブで管理）から候補タグをロードする。
  // 設定タブでタグを追加してきた直後にも反映できるよう、マウント時のみで十分（モーダルは毎回新規インスタンス）。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tags = await getAllTags();
        if (!cancelled) setTagCandidates(tags.map((t) => t.name));
      } catch (e) {
        console.warn('Failed to load tag candidates', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 選択中タグに含まれていない候補だけ抽出（チップ群の下段に並べる用）。 */
  const unselectedCandidates = useMemo(
    () => tagCandidates.filter((t) => !selectedTags.includes(t)),
    [tagCandidates, selectedTags]
  );

  /** タグを選択中に追加する。重複は無視。 */
  const handleSelectTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  };

  /** 選択中のタグを外す。 */
  const handleDeselectTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };

  /**
   * 「この日の写真」をフォトライブラリから取得する。
   * 日付が変わるたびに自動再取得する（依存配列に dateDisplayStr）。
   */
  const loadSuggestions = useCallback(async () => {
    setSuggestionsState('loading');
    const perm = await ensurePhotoPermission();
    if (!perm.granted) {
      setSuggestions([]);
      setSuggestionsState('denied');
      return;
    }
    const photos = await getPhotosForDate(dateDisplayStr);
    setSuggestions(photos);
    if (photos.length === 0) {
      // 権限はあるがその日の写真が無い／制限付きで該当が無い
      setSuggestionsState(perm.accessPrivileges === 'limited' ? 'limited' : 'empty');
    } else {
      setSuggestionsState(perm.accessPrivileges === 'limited' ? 'limited' : 'granted');
    }
  }, [dateDisplayStr]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  /**
   * 日記タブの「この日の写真」をタップして遷移してきた時の初期添付。
   * 新規モード時に prefillAssetUri / prefillAssetId が渡っていれば、起動直後に1回だけ取り込む。
   * 編集モード（id ありで遷移）の時は対象外。
   */
  useEffect(() => {
    if (isEdit) return;
    if (!prefillAssetUri || !prefillAssetId) return;
    let cancelled = false;
    (async () => {
      const stored = await storePhotoAssetAsDiaryImage({
        id: prefillAssetId,
        uri: prefillAssetUri,
        creationTime: 0,
      });
      if (cancelled || !stored) return;
      setImageUris((prev) => (prev.includes(stored) ? prev : [...prev, stored]));
      setPendingNewImageUris((prev) => [...prev, stored]);
      setAssetIdToStoredUri((prev) => {
        const next = new Map(prev);
        next.set(prefillAssetId, stored);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // 初回マウント時のみ実行する（params は遷移ごとに新しいモーダルインスタンスなので依存追加不要）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickImages = async () => {
    if (imageUris.length >= DIARY_IMAGE_LIMIT) {
      Alert.alert('上限に到達しました', `画像は最大 ${DIARY_IMAGE_LIMIT} 枚まで添付できます。`);
      return;
    }
    try {
      setIsPickingImage(true);
      const remaining = DIARY_IMAGE_LIMIT - imageUris.length;
      const added = await pickAndStoreImages(remaining);
      if (added.length > 0) {
        setImageUris((prev) => [...prev, ...added]);
        setPendingNewImageUris((prev) => [...prev, ...added]);
      }
    } catch (e) {
      console.error('Pick image error:', e);
      Alert.alert('エラー', '画像の追加に失敗しました');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleRemoveImage = (uri: string) => {
    Alert.alert('画像を削除', 'この画像を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          setImageUris((prev) => prev.filter((u) => u !== uri));
          // まだ保存前の追加分なら FS から即時削除
          if (pendingNewImageUris.includes(uri)) {
            deleteImageFile(uri);
            setPendingNewImageUris((prev) => prev.filter((u) => u !== uri));
          }
          // サジェスト経由で追加していたものなら、チェックマーク表示も外す
          setAssetIdToStoredUri((prev) => {
            let changed = false;
            const next = new Map(prev);
            for (const [aid, storedUri] of next) {
              if (storedUri === uri) {
                next.delete(aid);
                changed = true;
              }
            }
            return changed ? next : prev;
          });
          // 既存日記の元画像を外した場合は保存時に updateDiary が image_uris を更新するため、
          // 物理ファイルは「保存」を契機にユーザー意思を確定。ここでは UI 反映のみ。
        },
      },
    ]);
  };

  /**
   * サジェスト一覧の写真をタップしたときの処理。
   * 既に追加済みのアセットは何もしない（外したければ上のサムネイルからバツボタン）。
   */
  const handleToggleSuggestion = async (asset: DiaryPhotoSuggestion) => {
    if (assetIdToStoredUri.has(asset.id)) return; // 既に追加済み
    if (imageUris.length >= DIARY_IMAGE_LIMIT) {
      Alert.alert('上限に到達しました', `画像は最大 ${DIARY_IMAGE_LIMIT} 枚まで添付できます。`);
      return;
    }
    const stored = await storePhotoAssetAsDiaryImage(asset);
    if (!stored) {
      Alert.alert('エラー', '画像の追加に失敗しました');
      return;
    }
    setImageUris((prev) => [...prev, stored]);
    setPendingNewImageUris((prev) => [...prev, stored]);
    setAssetIdToStoredUri((prev) => {
      const next = new Map(prev);
      next.set(asset.id, stored);
      return next;
    });
  };

  /** iOS の制限付きアクセス時、写真の許可範囲を変更する OS ピッカーを表示し、再読込する。 */
  const handleOpenLimitedPicker = async () => {
    await presentLimitedLibraryPicker();
    await loadSuggestions();
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim() && imageUris.length === 0) {
      Alert.alert('入力エラー', 'タイトル・本文・画像のいずれかを入力してください。');
      return;
    }

    try {
      setIsSaving(true);
      const tags = selectedTags;
      const date = dateDisplayStr;

      if (isEdit && editingId !== null) {
        // 編集時：削除された既存ファイルがあれば物理削除する
        const original = await getDiaryById(editingId);
        if (original) {
          const removedExisting = original.imageUris.filter((u) => !imageUris.includes(u));
          await Promise.all(removedExisting.map((u) => deleteImageFile(u)));
        }
        await editDiary(editingId, {
          date,
          title: title.trim(),
          content: content.trim(),
          tags,
          imageUris,
        });
      } else {
        await addDiary({
          date,
          title: title.trim(),
          content: content.trim(),
          tags,
          imageUris,
        });
      }
      // 保存できたので「保存前の新規ファイル」は本物の保存ファイルになった
      setPendingNewImageUris([]);
      router.back();
    } catch (e) {
      console.error('Save diary error:', e);
      Alert.alert('エラー', '日記の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (editingId === null) return;
    Alert.alert('削除の確認', 'この日記を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeDiary(editingId, dateDisplayStr);
            router.back();
          } catch (e) {
            console.error('Delete diary error:', e);
            Alert.alert('エラー', '削除に失敗しました。');
          }
        },
      },
    ]);
  };

  const handleCancel = async () => {
    // 保存せずに閉じる場合、新規追加した画像ファイルはゴミになるので削除
    if (pendingNewImageUris.length > 0) {
      await Promise.all(pendingNewImageUris.map((u) => deleteImageFile(u)));
    }
    router.back();
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
            {isEdit ? '日記を編集' : '日記を書く'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSub }]}>
            {isEdit ? '内容を変更して保存してください' : '今日の気持ちを綴りましょう'}
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
            placeholder="タイトル（任意）"
            placeholderTextColor={isDarkMode ? '#555' : '#bbb'}
            returnKeyType="next"
          />
        </View>

        {/* ── 本文 ── */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textMain }]}>📝 本文</Text>
          <TextInput
            style={[styles.input, styles.contentInput, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border, color: themeColors.textMain }]}
            value={content}
            onChangeText={setContent}
            placeholder="今日あったこと、感じたこと..."
            placeholderTextColor={isDarkMode ? '#555' : '#bbb'}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* ── タグ（候補から選択） ── */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textMain }]}>
            🏷 タグ {selectedTags.length > 0 && `(${selectedTags.length})`}
          </Text>

          {/* 選択中タグ：青く点灯。タップで解除。 */}
          {selectedTags.length > 0 && (
            <View style={styles.tagChipRow}>
              {selectedTags.map((tag) => (
                <TouchableOpacity
                  key={`sel-${tag}`}
                  style={styles.tagChipSelected}
                  onPress={() => handleDeselectTag(tag)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.tagChipSelectedText}>#{tag}</Text>
                  <Text style={styles.tagChipSelectedText}> ×</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 候補タグ：未選択のもの。タップで選択。 */}
          {unselectedCandidates.length > 0 && (
            <>
              <Text style={[styles.tagCandidatesLabel, { color: themeColors.textSub }]}>
                候補から選ぶ
              </Text>
              <View style={styles.tagChipRow}>
                {unselectedCandidates.map((tag) => (
                  <TouchableOpacity
                    key={`cand-${tag}`}
                    style={[
                      styles.tagChipCandidate,
                      { backgroundColor: themeColors.cardBg, borderColor: themeColors.border },
                    ]}
                    onPress={() => handleSelectTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tagChipCandidateText, { color: themeColors.textMain }]}>
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {tagCandidates.length === 0 && selectedTags.length === 0 && (
            <Text style={[styles.tagCandidatesLabel, { color: themeColors.textSub, marginTop: 6 }]}>
              まだタグが登録されていません。設定タブの「🏷 日記タグの管理」から登録してください。
            </Text>
          )}
        </View>

        {/* ── 画像 ── */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: themeColors.textMain }]}>
            🖼 画像 ({imageUris.length}/{DIARY_IMAGE_LIMIT})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
            {imageUris.map((uri) => (
              <TouchableOpacity
                key={uri}
                onPress={() => handleRemoveImage(uri)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri }}
                  style={styles.thumb}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                />
                <View style={styles.thumbDeleteBadge}>
                  <Text style={styles.thumbDeleteText}>×</Text>
                </View>
              </TouchableOpacity>
            ))}
            {imageUris.length < DIARY_IMAGE_LIMIT && (
              <TouchableOpacity
                style={[styles.thumb, styles.thumbAdd, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}
                onPress={handlePickImages}
                disabled={isPickingImage}
                activeOpacity={0.7}
              >
                <Text style={[styles.thumbAddIcon, { color: themeColors.textSub }]}>＋</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* ── この日の写真サジェスト ── */}
        <View style={styles.formGroup}>
          <View style={styles.suggestHeader}>
            <Text style={[styles.label, { color: themeColors.textMain }]}>
              📷 この日の写真
              {suggestionsState === 'granted' || suggestionsState === 'limited'
                ? ` (${suggestions.length})`
                : ''}
            </Text>
            {suggestionsState === 'limited' && (
              <TouchableOpacity onPress={handleOpenLimitedPicker} hitSlop={6}>
                <Text style={styles.suggestActionLink}>もっと選ぶ</Text>
              </TouchableOpacity>
            )}
          </View>

          {suggestionsState === 'loading' ? (
            <Text style={[styles.suggestHint, { color: themeColors.textSub }]}>読み込み中...</Text>
          ) : suggestionsState === 'denied' ? (
            <Text style={[styles.suggestHint, { color: themeColors.textSub }]}>
              写真へのアクセスが許可されていません。設定アプリから許可してください。
            </Text>
          ) : suggestionsState === 'empty' ? (
            <Text style={[styles.suggestHint, { color: themeColors.textSub }]}>
              この日に撮影された写真はありません。
            </Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                {suggestions.map((asset) => {
                  const isAdded = assetIdToStoredUri.has(asset.id);
                  const isDisabled = !isAdded && imageUris.length >= DIARY_IMAGE_LIMIT;
                  return (
                    <TouchableOpacity
                      key={asset.id}
                      onPress={() => handleToggleSuggestion(asset)}
                      disabled={isDisabled}
                      activeOpacity={0.8}
                      style={isDisabled ? styles.suggestDisabled : undefined}
                    >
                      <Image
                        source={{ uri: asset.uri }}
                        style={styles.thumb}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={0}
                      />
                      {isAdded && (
                        <View style={styles.suggestAddedBadge}>
                          <Text style={styles.suggestAddedText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {suggestionsState === 'limited' && (
                <Text style={[styles.suggestHint, { color: themeColors.textSub, marginTop: 6 }]}>
                  制限付きアクセスのため、許可した写真のみ表示されています。
                </Text>
              )}
            </>
          )}
        </View>

        {/* ── 操作ボタン ── */}
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
              onPress={handleCancel}
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
            style={[styles.cancelButtonFull, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelButtonText, { color: themeColors.textSub }]}>キャンセル</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { padding: 20, paddingTop: 12 },

  header: { alignItems: 'center', marginBottom: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, marginTop: 4, fontWeight: '500' },

  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 10, letterSpacing: 0.2 },

  datePickerButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  datePickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  datePickerIcon: { fontSize: 20 },
  datePickerText: { fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  datePickerChevron: { fontSize: 22, fontWeight: '300' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerContainer: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerCancel: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  pickerTitle: { fontSize: 16, fontWeight: '700' },
  pickerDone: { fontSize: 16, color: '#0a7ea4', fontWeight: '800' },
  iosSpinner: { height: 200 },

  input: {
    borderWidth: 1.5, borderRadius: 14, padding: 14, fontSize: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  contentInput: { minHeight: 140, textAlignVertical: 'top' },

  thumbRow: { gap: 8, flexDirection: 'row' },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  thumbAdd: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed',
  },
  thumbAddIcon: { fontSize: 28, fontWeight: '300' },
  thumbDeleteBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  thumbDeleteText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },

  // ── タグ選択 UI ──
  tagChipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 10,
  },
  tagChipSelected: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16,
  },
  tagChipSelectedText: {
    color: '#fff', fontSize: 13, fontWeight: '700',
  },
  tagChipCandidate: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  tagChipCandidateText: {
    fontSize: 13, fontWeight: '600',
  },
  tagCandidatesLabel: {
    fontSize: 12, fontWeight: '600',
    marginTop: 2, marginBottom: 8,
    letterSpacing: 0.3,
  },

  suggestHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  suggestActionLink: {
    fontSize: 13, fontWeight: '700', color: '#0a7ea4',
  },
  suggestHint: { fontSize: 13, paddingVertical: 8 },
  suggestDisabled: { opacity: 0.4 },
  suggestAddedBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#0a7ea4', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  suggestAddedText: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 14 },

  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  cancelButton: {
    flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center',
    borderWidth: 1.5,
  },
  cancelButtonFull: {
    paddingVertical: 15, borderRadius: 14, alignItems: 'center',
    borderWidth: 1.5, marginTop: 12,
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  deleteButton: {
    flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center',
    borderWidth: 1.5,
  },
  deleteButtonText: { fontSize: 16, fontWeight: '600', color: '#e63946' },
  saveButton: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  saveButtonDisabled: { opacity: 0.6 },
  saveGradient: { paddingVertical: 15, alignItems: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
