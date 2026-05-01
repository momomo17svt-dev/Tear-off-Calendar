export type EventType = 'birthday' | 'schedule';

export interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  type: EventType;
  memo: string | null;
  is_annual: number;
  color_code: string | null;
  notify_time: string | null;
  created_at: string;
}

export interface NewCalendarEvent {
  title: string;
  date: string;
  type: EventType;
  memo?: string | null;
  is_annual?: number;
  color_code?: string | null;
  notify_time?: string | null;
}
