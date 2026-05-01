/**
 * src/utils/nativeCalendar.ts
 *
 * iOS/Android のネイティブカレンダーとの連携ユーティリティ。
 * - 読み込み: ネイティブカレンダーから指定日のイベントを取得
 * - 書き込み: アプリのイベントをネイティブカレンダーへエクスポート
 */
import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';

/** カレンダー権限を要求し、許可済みかどうかを返す */
export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'カレンダーへのアクセス',
      'カレンダー連携にはアクセス許可が必要です。設定アプリから許可してください。'
    );
    return false;
  }
  return true;
}

/** デバイスのデフォルトカレンダー ID を取得 */
async function getDefaultCalendarId(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const defaultCal = await Calendar.getDefaultCalendarAsync();
      return defaultCal?.id ?? null;
    }
    // Android: 書き込み可能なカレンダーの最初のものを使う
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = cals.find((c) => c.allowsModifications);
    return writable?.id ?? null;
  } catch {
    return null;
  }
}

/** 指定した範囲（その日の 0:00 〜 23:59）のネイティブカレンダーイベントを取得 */
export async function fetchNativeEventsForDate(dateStr: string): Promise<
  { id: string; title: string; startDate: Date; isAllDay: boolean }[]
> {
  const ok = await requestCalendarPermission();
  if (!ok) return [];

  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const calendarIds = cals.map((c) => c.id);

  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59`);

  const events = await Calendar.getEventsAsync(calendarIds, start, end);
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    startDate: new Date(e.startDate),
    isAllDay: e.allDay ?? false,
  }));
}

/**
 * アプリのイベントをネイティブカレンダーに追加する。
 * @returns 追加したネイティブカレンダーのイベントID（失敗時は null）
 */
export async function exportEventToNativeCalendar(params: {
  title: string;
  dateStr: string; // YYYY-MM-DD
  isAllDay?: boolean;
}): Promise<string | null> {
  const ok = await requestCalendarPermission();
  if (!ok) return null;

  const calId = await getDefaultCalendarId();
  if (!calId) {
    Alert.alert('エラー', '書き込み可能なカレンダーが見つかりませんでした。');
    return null;
  }

  const date = new Date(`${params.dateStr}T09:00:00`);
  const endDate = new Date(`${params.dateStr}T10:00:00`);

  try {
    const eventId = await Calendar.createEventAsync(calId, {
      title: params.title,
      startDate: date,
      endDate: endDate,
      allDay: params.isAllDay ?? true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return eventId;
  } catch (e) {
    console.error('exportEventToNativeCalendar error:', e);
    return null;
  }
}
