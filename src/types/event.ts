export interface NativeCalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  isAllDay: boolean;
  notes: string | null;
}
