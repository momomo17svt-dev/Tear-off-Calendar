import { getDb } from './database';
import type { CalendarEvent, NewCalendarEvent } from '@/types/event';

export async function insertEvent(event: NewCalendarEvent): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO events (title, date, type, memo, is_annual, color_code, notify_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    event.title,
    event.date,
    event.type,
    event.memo ?? null,
    event.is_annual ?? 0,
    event.color_code ?? null,
    event.notify_time ?? null
  );
  return result.lastInsertRowId;
}

export async function updateEvent(
  id: number,
  patch: Partial<NewCalendarEvent>
): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (patch.title !== undefined) {
    fields.push('title = ?');
    values.push(patch.title);
  }
  if (patch.date !== undefined) {
    fields.push('date = ?');
    values.push(patch.date);
  }
  if (patch.type !== undefined) {
    fields.push('type = ?');
    values.push(patch.type);
  }
  if (patch.memo !== undefined) {
    fields.push('memo = ?');
    values.push(patch.memo);
  }
  if (patch.is_annual !== undefined) {
    fields.push('is_annual = ?');
    values.push(patch.is_annual);
  }
  if (patch.color_code !== undefined) {
    fields.push('color_code = ?');
    values.push(patch.color_code);
  }
  if (patch.notify_time !== undefined) {
    fields.push('notify_time = ?');
    values.push(patch.notify_time);
  }
  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE events SET ${fields.join(', ')} WHERE id = ?`,
    ...values
  );
}

export async function deleteEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM events WHERE id = ?`, id);
}

export async function getAllEvents(): Promise<CalendarEvent[]> {
  const db = await getDb();
  return db.getAllAsync<CalendarEvent>(
    `SELECT * FROM events ORDER BY date ASC, created_at ASC`
  );
}

export async function getEventsByDate(date: string): Promise<CalendarEvent[]> {
  const db = await getDb();
  // is_annual=1 のイベントは月日一致でも拾う（年に関係なく毎年表示）
  const monthDay = date.slice(5); // 'MM-DD'
  return db.getAllAsync<CalendarEvent>(
    `SELECT * FROM events
     WHERE date = ?
        OR (is_annual = 1 AND substr(date, 6, 5) = ?)
     ORDER BY type DESC, created_at ASC`,
    date,
    monthDay
  );
}

export async function getEventById(id: number): Promise<CalendarEvent | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CalendarEvent>(
    `SELECT * FROM events WHERE id = ?`,
    id
  );
  return row ?? null;
}
