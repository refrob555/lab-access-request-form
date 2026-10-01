import scheduleJson from '../config/atc-fall-2026.json' with { type: 'json' };
import roomsJson from '../config/lab-rooms.json' with { type: 'json' };
import { formatTimeRange, parseMinutes, weekdayIndex } from './time.js';

export const CONFLICT_FORM_NOTE = 'This time overlaps a scheduled ATC class. You can still submit.';
export const CONFLICT_EMAIL_NOTE = 'This request overlaps a scheduled ATC class.';
export const NO_CONFLICT_NOTE = 'No scheduled ATC classes conflict with this time.';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type Meeting = {
  subject: string;
  course: string;
  section: string;
  title: string;
  daysNumeric: number[];
  startTime: string;
  endTime: string;
  room: string;
  labRoom: string;
  tba: boolean;
};

const LAB_ROOMS = roomsJson as Record<string, string[]>;
const MEETINGS = scheduleJson.meetings as Meeting[];

export type ClassConflict = {
  line: string;
};

export function scheduleCheckReady(input: {
  labId: string;
  date: string;
  startTime: string;
  endTime: string;
}): boolean {
  const rooms = LAB_ROOMS[input.labId] ?? [];
  const day = weekdayIndex(input.date);
  const start = parseMinutes(input.startTime);
  const end = parseMinutes(input.endTime);
  return rooms.length > 0 && day >= 0 && start !== null && end !== null && end > start;
}

export function findClassConflicts(input: {
  labId: string;
  date: string;
  startTime: string;
  endTime: string;
}): ClassConflict[] {
  if (!scheduleCheckReady(input)) return [];
  const rooms = new Set(LAB_ROOMS[input.labId] ?? []);
  const day = weekdayIndex(input.date);
  const start = parseMinutes(input.startTime);
  const end = parseMinutes(input.endTime);
  if (start === null || end === null) return [];

  const lines = new Set<string>();
  for (const meeting of MEETINGS) {
    if (meeting.tba) continue;
    if (!meeting.daysNumeric.includes(day)) continue;
    const matchedRoom = rooms.has(meeting.room) ? meeting.room : rooms.has(meeting.labRoom) ? meeting.labRoom : '';
    if (!matchedRoom) continue;
    const meetingStart = parseMinutes(meeting.startTime);
    const meetingEnd = parseMinutes(meeting.endTime);
    if (meetingStart === null || meetingEnd === null) continue;
    if (!(start < meetingEnd && meetingStart < end)) continue;
    const dayLabel = DAY_LABELS[day] ?? 'Day';
    const section = `${meeting.subject}-${meeting.course}-${meeting.section}`;
    lines.add(`${section} ${meeting.title}, room ${matchedRoom}, ${dayLabel} ${formatTimeRange(meeting.startTime, meeting.endTime)}`);
  }
  return [...lines].sort().map((line) => ({ line }));
}
