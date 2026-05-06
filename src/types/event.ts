/**
 * ネイティブカレンダーから取得するイベント（予定）情報の型定義。
 * iOS/Android のカレンダーイベントをアプリ内で統一して扱うために使用します。
 */
export interface NativeCalendarEvent {
  /** イベントの一意なID */
  id: string;
  /** イベントのタイトル */
  title: string;
  /** 開始日時 */
  startDate: Date;
  /** 終了日時 */
  endDate: Date;
  /** 所属するカレンダーのID */
  calendarId: string;
  /** 所属するカレンダーの表示名 */
  calendarName: string;
  /** カレンダーの色（16進数形式など） */
  calendarColor: string;
  /** 終日イベントかどうかのフラグ */
  isAllDay: boolean;
  /** メモ（任意項目、ない場合は null） */
  notes: string | null;
}
