/**
 * 日記添付画像のユーティリティ
 * - フォトライブラリから複数画像を選択 → 圧縮 → アプリの documentDirectory に永続化
 * - 削除時のファイル物理削除
 *
 * 背景画像（settings.tsx の pickImage）と同じ方針だが、複数選択と専用サブディレクトリ（diaries/）に保存する点が異なる。
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** 日記添付画像の保存ディレクトリ（documentDirectory/diaries/） */
const DIARY_IMAGE_DIR = `${FileSystem.documentDirectory}diaries/`;

/** 1件あたりに添付できる画像枚数の上限 */
export const DIARY_IMAGE_LIMIT = 5;

/**
 * documentDirectory/diaries/ が存在しなければ作成する。
 * 既存の場合は何もしない（intermediates: true により再帰的に作成）。
 */
async function ensureDiaryDir(): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(DIARY_IMAGE_DIR, { intermediates: true });
  } catch {
    // 既に存在する場合は無視
  }
}

/**
 * フォトライブラリから画像を複数選択し、圧縮後にアプリのローカルストレージへコピーする。
 * 返り値は保存先のローカル URI 配列（DB に格納する値）。
 *
 * @param remainingSlots 残りで何枚追加できるか（既に保存済みの枚数を引いた値）
 */
export async function pickAndStoreImages(
  remainingSlots: number = DIARY_IMAGE_LIMIT
): Promise<string[]> {
  if (remainingSlots <= 0) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: Math.min(remainingSlots, DIARY_IMAGE_LIMIT),
    quality: 0.85,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return [];

  await ensureDiaryDir();

  const stored: string[] = [];
  for (const asset of result.assets) {
    try {
      // 横幅 1600px に縮小して JPEG 圧縮（背景画像より大きめで日記の細部を残す）
      const manip = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      const filename = `diary_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
      const dest = DIARY_IMAGE_DIR + filename;
      await FileSystem.copyAsync({ from: manip.uri, to: dest });
      stored.push(dest);
    } catch (e) {
      console.warn('Failed to store diary image', e);
    }
  }
  return stored;
}

/**
 * 単一の画像ファイルを削除する。既に存在しない場合もエラーにしない。
 */
export async function deleteImageFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    console.warn('Failed to delete diary image', uri, e);
  }
}
