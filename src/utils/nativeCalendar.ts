/**
 * ネイティブカレンダー連携ユーティリティ
 * OS標準のカレンダーAPI（expo-calendar）をラップし、
 * 権限チェック、イベントの取得・作成・更新・削除を提供します。
 */
import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';
import type { NativeCalendarEvent } from '@/types/event';

/**
 * カレンダーへのアクセス権限をリクエストする
 * @returns 許可された場合はtrue
 */
export async function requestCalendarPermission(): Promise<boolean> {
  // OS標準のパーミッションダイアログを表示（一度許可されると次回以降はスキップされる）
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    // ユーザーが拒否した、または設定で無効にしている場合はアラートを表示して設定変更を促す
    Alert.alert(
      'カレンダーへのアクセス',
      'カレンダー連携にはアクセス許可が必要です。設定アプリから許可してください。'
    );
    return false;
  }
  return true;
}

/**
 * 利用可能なカレンダー一覧を取得する
 * デバイスに登録されている全てのカレンダー（iCloud, Google, ローカル等）を取得します。
 */
export async function getAvailableCalendars(): Promise<Calendar.Calendar[]> {
  const ok = await requestCalendarPermission();
  if (!ok) return [];
  // EVENT（予定）タイプのカレンダーのみを対象にする
  return Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
}

/**
 * 書き込み可能なカレンダー一覧を取得する
 * iOSの「誕生日」など、システム的に編集不可能なカレンダーを除外します。
 */
export async function getWritableCalendars(): Promise<Calendar.Calendar[]> {
  const cals = await getAvailableCalendars();
  return cals.filter(
    (c) =>
      // 書き込み権限があるかチェック
      c.allowsModifications &&
      // iOSの場合、デフォルトの「誕生日」カレンダーはAPI経由での読み取り専用であることが多いため除外
      (Platform.OS !== 'ios' || c.type !== Calendar.CalendarType.BIRTHDAYS)
  );
}

/**
 * 指定期間内のイベントを取得し、アプリ専用の型に変換して返却する
 * @param start 取得開始日時
 * @param end 取得終了日時
 * @param calendarIds 対象とするカレンダーIDの配列（空の場合は全カレンダー）
 */
export async function fetchNativeEventsForRange(
  start: Date,
  end: Date,
  calendarIds: string[]
): Promise<NativeCalendarEvent[]> {
  const ok = await requestCalendarPermission();
  if (!ok) return [];

  // 全てのカレンダー情報を取得（イベントの色や所属カレンダー名を紐付けるため）
  const allCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  // 指定されたIDがあればそれを使用し、なければ全カレンダーを対象にする
  const ids = calendarIds.length > 0 ? calendarIds : allCals.map((c) => c.id);
  if (ids.length === 0) return [];

  // ネイティブAPIから生のイベントデータを取得（OS側で最適化されたフィルタリングが行われる）
  const raw = await Calendar.getEventsAsync(ids, start, end);

  // IDからカレンダー情報を高速に引くためのマップを作成
  const calMap = new Map(allCals.map((c) => [c.id, c]));

  // Expoの型からアプリ固有の型（NativeCalendarEvent）にマッピング
  return raw.map((e) => {
    const cal = calMap.get(e.calendarId);
    return {
      id: e.id,
      title: e.title,
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
      calendarId: e.calendarId,
      calendarName: cal?.title ?? '',
      calendarColor: cal?.color ?? '#888888',
      isAllDay: e.allDay ?? false,
      notes: e.notes ?? null,
    };
  });
}

/**
 * 新しいイベントをOSのカレンダーに作成する
 */
export async function createNativeEvent(
  calendarId: string,
  params: {
    title: string;
    startDate: Date;
    endDate: Date;
    isAllDay: boolean;
    notes?: string | null;
  }
): Promise<string | null> {
  const ok = await requestCalendarPermission();
  if (!ok) return null;
  try {
    // 新規イベントをOS側のDBへ書き込み。成功すると新しいイベントIDが返る
    return await Calendar.createEventAsync(calendarId, {
      title: params.title,
      startDate: params.startDate,
      endDate: params.endDate,
      allDay: params.isAllDay,
      notes: params.notes ?? undefined,
      // デバイスの現在のタイムゾーンを設定
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (e) {
    console.error('createNativeEvent error:', e);
    Alert.alert('エラー', 'イベントの作成に失敗しました。');
    return null;
  }
}

/**
 * 既存のイベントを更新する
 * 変更があったプロパティのみを反映させます。
 */
export async function updateNativeEvent(
  eventId: string,
  params: {
    title?: string;
    startDate?: Date;
    endDate?: Date;
    isAllDay?: boolean;
    notes?: string | null;
  }
): Promise<void> {
  try {
    // 更新が必要な項目のみを抽出したパッチオブジェクトを作成
    const patch: Partial<Calendar.Event> = {};
    if (params.title !== undefined) patch.title = params.title;
    if (params.startDate !== undefined) patch.startDate = params.startDate;
    if (params.endDate !== undefined) patch.endDate = params.endDate;
    if (params.isAllDay !== undefined) patch.allDay = params.isAllDay;
    if (params.notes !== undefined) patch.notes = params.notes ?? undefined;
    
    // OS側のイベントを部分更新
    await Calendar.updateEventAsync(eventId, patch);
  } catch (e) {
    console.error('updateNativeEvent error:', e);
    Alert.alert('エラー', 'イベントの更新に失敗しました。');
  }
}

/**
 * イベントを削除する
 */
export async function deleteNativeEvent(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch (e) {
    console.error('deleteNativeEvent error:', e);
    Alert.alert('エラー', 'イベントの削除に失敗しました。');
  }
}

/**
 * Dateオブジェクトを YYYY-MM-DD 形式の文字列に変換する
 * ストアでの日付キー（RecordのKey）や、APIへのクエリパラメータとして使用します。
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
