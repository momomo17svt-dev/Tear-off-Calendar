import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';
import type { NativeCalendarEvent } from '@/types/event';

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

export async function getAvailableCalendars(): Promise<Calendar.Calendar[]> {
  const ok = await requestCalendarPermission();
  if (!ok) return [];
  return Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
}

export async function getWritableCalendars(): Promise<Calendar.Calendar[]> {
  const cals = await getAvailableCalendars();
  return cals.filter(
    (c) =>
      c.allowsModifications &&
      (Platform.OS !== 'ios' || c.type !== Calendar.CalendarType.BIRTHDAYS)
  );
}

export async function fetchNativeEventsForRange(
  start: Date,
  end: Date,
  calendarIds: string[]
): Promise<NativeCalendarEvent[]> {
  const ok = await requestCalendarPermission();
  if (!ok) return [];

  const allCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const ids = calendarIds.length > 0 ? calendarIds : allCals.map((c) => c.id);

  const raw = await Calendar.getEventsAsync(ids, start, end);

  const calMap = new Map(allCals.map((c) => [c.id, c]));

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
    return await Calendar.createEventAsync(calendarId, {
      title: params.title,
      startDate: params.startDate,
      endDate: params.endDate,
      allDay: params.isAllDay,
      notes: params.notes ?? undefined,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (e) {
    console.error('createNativeEvent error:', e);
    Alert.alert('エラー', 'イベントの作成に失敗しました。');
    return null;
  }
}

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
    const patch: Partial<Calendar.Event> = {};
    if (params.title !== undefined) patch.title = params.title;
    if (params.startDate !== undefined) patch.startDate = params.startDate;
    if (params.endDate !== undefined) patch.endDate = params.endDate;
    if (params.isAllDay !== undefined) patch.allDay = params.isAllDay;
    if (params.notes !== undefined) patch.notes = params.notes ?? undefined;
    await Calendar.updateEventAsync(eventId, patch);
  } catch (e) {
    console.error('updateNativeEvent error:', e);
    Alert.alert('エラー', 'イベントの更新に失敗しました。');
  }
}

export async function deleteNativeEvent(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch (e) {
    console.error('deleteNativeEvent error:', e);
    Alert.alert('エラー', 'イベントの削除に失敗しました。');
  }
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
