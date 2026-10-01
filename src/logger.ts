import { redactEmails } from './escape.js';

export type LogFields = {
  requestId?: string;
  status?: number;
  mode?: string;
  code?: string;
  detail?: string;
  action?: string;
  outcome?: 'won' | 'already_recorded' | 'rejected';
  userAgent?: string;
  clientIp?: string;
};

export type Logger = (event: string, fields?: LogFields) => void;

const ALLOWED: Array<keyof LogFields> = ['requestId', 'status', 'mode', 'code', 'detail', 'action', 'outcome', 'userAgent', 'clientIp'];

export function defaultLogger(event: string, fields: LogFields = {}): void {
  const line: Record<string, string | number> = { event };
  for (const key of ALLOWED) {
    const value = fields[key];
    if (value === undefined || value === '') continue;
    line[key] = typeof value === 'string' ? redactEmails(value) : value;
  }
  console.log(JSON.stringify(line));
}
