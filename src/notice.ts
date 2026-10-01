import { SHORT_NOTICE } from './labs.js';
import { zonedWallTime, isShortNotice } from './time.js';

export type SubmissionNotice = {
  leadLabel: string;
  noticeLabel: string;
  shortNotice: boolean;
};

/** Lead time from submission to the requested start, using the same clock as the form's 24-hour warning. */
export function submissionNotice(isoDate: string, hhmm: string, timeZone: string, submittedAt: Date): SubmissionNotice {
  const instant = zonedWallTime(isoDate, hhmm, timeZone);
  const shortNotice = isShortNotice(isoDate, hhmm, timeZone, submittedAt);
  const leadMs = instant ? instant.getTime() - submittedAt.getTime() : Number.NaN;
  return {
    leadLabel: Number.isNaN(leadMs) ? 'Unavailable' : formatLead(leadMs),
    noticeLabel: shortNotice
      ? `Not met. ${SHORT_NOTICE}`
      : 'Met. The requested start is at least 24 hours after this submission.',
    shortNotice,
  };
}

export function formatLead(ms: number): string {
  const after = ms < 0;
  const totalMinutes = Math.round(Math.abs(ms) / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (!days && !hours) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  else if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  const span = parts.join(' ');
  return after ? `${span} after the requested start` : `${span} before the requested start`;
}
