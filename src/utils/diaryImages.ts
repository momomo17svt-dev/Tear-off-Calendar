/**
 * 日記添付画像のユーティリティ
 * - フォトライブラリから複数画像を選択 → 圧縮 → アプリの documentDirectory に永続化
 * - 削除時のファイル物理削除
 * - MediaLibrary 経由で「その日の写真」一覧を取得し、選択時にアプリへコピー
 *
 * 背景画像（settings.tsx の pickImage）と同じ方針だが、複数選択と専用サブディレクトリ（diaries/）に保存する点が異なる。
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

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

/**
 * 「その日の写真」サジェスト用の軽量アセット表現。
 * UI 側で必要な分だけを抽出する（MediaLibrary.Asset そのものを渡すと型依存が広がるため）。
 */
export type DiaryPhotoSuggestion = {
  /** MediaLibrary が割り当てる識別子。Android では UI で持っているだけ。iOS では ph:// URI のキー。 */
  id: string;
  /**
   * サムネイル表示や圧縮元として使える URI。
   * iOS は通常 `ph://`、Android は `file://`。`expo-image` は両方扱える。
   */
  uri: string;
  /** 撮影日時のミリ秒タイムスタンプ */
  creationTime: number;
};

/**
 * MediaLibrary の権限を確認・必要ならリクエストする。
 * 戻り値の `granted` は「全許可」と「制限付き許可」のどちらでも true となる。
 * 制限付きアクセスでは MediaLibrary は「ユーザーが選んだ写真」のみ列挙する。
 */
export async function ensurePhotoPermission(): Promise<{
  granted: boolean;
  accessPrivileges: MediaLibrary.PermissionResponse['accessPrivileges'];
  status: MediaLibrary.PermissionStatus;
}> {
  let perm = await MediaLibrary.getPermissionsAsync();
  if (perm.status === 'undetermined' || (!perm.granted && perm.canAskAgain)) {
    perm = await MediaLibrary.requestPermissionsAsync();
  }
  return {
    granted: perm.granted,
    accessPrivileges: perm.accessPrivileges,
    status: perm.status,
  };
}

/**
 * iOS の「制限付きアクセス」で許可範囲を変更するためのピッカーを表示する。
 * Android では何もしない（OS 側に同等の概念がない）。
 */
export async function presentLimitedLibraryPicker(): Promise<void> {
  try {
    if (typeof MediaLibrary.presentPermissionsPickerAsync === 'function') {
      await MediaLibrary.presentPermissionsPickerAsync();
    }
  } catch (e) {
    console.warn('Failed to present limited library picker', e);
  }
}

/**
 * 指定日付（YYYY-MM-DD ローカル日付）の 00:00〜翌 00:00 に撮影された写真を新しい順で取得する。
 *
 * - 権限がなければ空配列。呼び出し側で `ensurePhotoPermission()` を済ませること。
 * - 制限付きアクセスではユーザーが選んだ写真のうち該当日のみが返る。
 *
 * @param dateStr "YYYY-MM-DD"（ローカル日付）
 * @param limit  取得件数の上限（既定 60）
 */
export async function getPhotosForDate(
  dateStr: string,
  limit: number = 60
): Promise<DiaryPhotoSuggestion[]> {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return [];
  // ローカルタイムでの「その日」の範囲
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();

  try {
    const res = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      first: limit,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      createdAfter: start,
      createdBefore: end,
    });
    return res.assets.map((a) => ({
      id: a.id,
      uri: a.uri,
      creationTime: a.creationTime,
    }));
  } catch (e) {
    console.warn('Failed to fetch photos for date', dateStr, e);
    return [];
  }
}

/**
 * MediaLibrary のアセット URI を、日記用に圧縮・コピーして documentDirectory に永続化する。
 * iOS では `ph://` URI が来るが、`ImageManipulator` 経由でデコードできるためそのまま処理可能。
 *
 * @returns 保存先ローカル URI（`pickAndStoreImages` と同じ形式）。失敗時は null。
 */
export async function storePhotoAssetAsDiaryImage(
  asset: DiaryPhotoSuggestion
): Promise<string | null> {
  try {
    await ensureDiaryDir();
    const manip = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    const filename = `diary_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
    const dest = DIARY_IMAGE_DIR + filename;
    await FileSystem.copyAsync({ from: manip.uri, to: dest });
    return dest;
  } catch (e) {
    console.warn('Failed to store photo asset', asset.id, e);
    return null;
  }
}
