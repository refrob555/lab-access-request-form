export function civilToday(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Could not resolve the current date.');
  }
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseMinutes(hhmm: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function formatTimeLabel(hhmm: string): string {
  const total = parseMinutes(hhmm);
  if (total === null) return hhmm;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** Display-only range. Stored HH:mm values become 12-hour labels; existing labels stay. */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTimeLabel(start)}–${formatTimeLabel(end)}`;
}

/** Elapsed time from submit to decision, rounded to the nearest minute. */
export function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  if (totalMinutes < 1) return 'Less than a minute';
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (mins) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 minutes';
}

export function formatLongDate(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatStamp(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date);
}

export function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

export function isWeekend(iso: string): boolean {
  const day = weekdayIndex(iso);
  return day === 0 || day === 6;
}

/** The next weekday after today. Saturday and Sunday are skipped. */
export function earliestRequestDate(todayIso: string): string {
  let cursor = addDays(todayIso, 1);
  while (isWeekend(cursor)) cursor = addDays(cursor, 1);
  return cursor;
}

export function zonedWallTime(isoDate: string, hhmm: string, timeZone: string): Date | null {
  if (!isIsoDate(isoDate) || parseMinutes(hhmm) === null) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hour, minute] = hhmm.split(':').map(Number);
  const utcGuess = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0);
  const offset = zoneOffsetMs(timeZone, new Date(utcGuess));
  let utc = utcGuess - offset;
  const adjusted = zoneOffsetMs(timeZone, new Date(utc));
  if (adjusted !== offset) utc = utcGuess - adjusted;
  return new Date(utc);
}

export function isShortNotice(isoDate: string, hhmm: string, timeZone: string, now = new Date()): boolean {
  const instant = zonedWallTime(isoDate, hhmm, timeZone);
  if (!instant) return false;
  return instant.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
}

function zoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const bag: Record<string, string> = {};
  for (const part of parts) bag[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    Number(bag.hour),
    Number(bag.minute),
    Number(bag.second),
  );
  return asUtc - date.getTime();
}

export function timeZoneLongName(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'long',
  }).formatToParts(now);
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
}

export function buildSlots(
  dayStart: string,
  dayEnd: string,
  step: number,
  which: 'start' | 'end',
): string[] {
  const start = parseMinutes(dayStart);
  const end = parseMinutes(dayEnd);
  if (start === null || end === null || step <= 0 || end <= start) return [];
  const slots: string[] = [];
  if (which === 'start') {
    for (let cursor = start; cursor + step <= end; cursor += step) {
      slots.push(formatHHMM(cursor));
    }
  } else {
    for (let cursor = start + step; cursor <= end; cursor += step) {
      slots.push(formatHHMM(cursor));
    }
  }
  return slots;
}
