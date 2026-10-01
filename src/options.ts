import { buildSlots, parseMinutes } from './time.js';
import type { AppOptions, Choice, LabChoice, Supervision } from './types.js';

export function parseOptions(raw: string, sourceName = 'config/options.json'): AppOptions {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`${sourceName} is not valid JSON. Remove comments and trailing commas.`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${sourceName} must be a JSON object.`);
  }
  const obj = data as Record<string, unknown>;
  const timezone = expectPlain(obj, 'timezone', 80, sourceName);
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new Error(`${sourceName}: "timezone" must be an IANA time zone such as America/Chicago.`);
  }

  const slotMinutes = expectInt(obj, 'slotMinutes', 5, 120, sourceName);
  const dayStart = expectTime(obj, 'dayStart', sourceName);
  const dayEnd = expectTime(obj, 'dayEnd', sourceName);
  const startMin = parseMinutes(dayStart);
  const endMin = parseMinutes(dayEnd);
  if (startMin === null || endMin === null || endMin <= startMin) {
    throw new Error(`${sourceName}: "dayEnd" must be after "dayStart".`);
  }
  const span = endMin - startMin;
  if (span % slotMinutes !== 0) {
    throw new Error(`${sourceName}: dayStart, dayEnd, and slotMinutes must line up so the closing time is a choice.`);
  }
  const maxDurationMinutes = expectInt(obj, 'maxDurationMinutes', slotMinutes, span, sourceName);
  if (maxDurationMinutes % slotMinutes !== 0) {
    throw new Error(`${sourceName}: "maxDurationMinutes" must be a multiple of "slotMinutes".`);
  }
  if (buildSlots(dayStart, dayEnd, slotMinutes, 'start').length === 0) {
    throw new Error(`${sourceName}: the day length does not produce any time slots.`);
  }

  return {
    collegeName: expectPlain(obj, 'collegeName', 80, sourceName),
    formTitle: expectPlain(obj, 'formTitle', 80, sourceName),
    intro: expectPlain(obj, 'intro', 400, sourceName),
    footerNote: expectOptionalPlain(obj, 'footerNote', 400, sourceName),
    privacyNote: expectOptionalPlain(obj, 'privacyNote', 400, sourceName),
    timezone,
    maxDaysAhead: expectInt(obj, 'maxDaysAhead', 1, 365, sourceName),
    maxDurationMinutes,
    slotMinutes,
    dayStart,
    dayEnd,
    allowedEmailDomains: parseDomains(obj.allowedEmailDomains, sourceName),
    classes: parseChoices(obj.classes, 'classes', sourceName),
    instructors: parseChoices(obj.instructors, 'instructors', sourceName),
    labs: parseLabs(obj.labs, sourceName),
  };
}

function expectPlain(obj: Record<string, unknown>, key: string, max: number, sourceName: string): string {
  const trimmed = readPlain(obj, key, max, sourceName);
  if (!trimmed) {
    throw new Error(`${sourceName}: "${key}" must be plain text up to ${max} characters.`);
  }
  return trimmed;
}

function expectOptionalPlain(obj: Record<string, unknown>, key: string, max: number, sourceName: string): string {
  if (obj[key] === undefined) return '';
  return readPlain(obj, key, max, sourceName);
}

function readPlain(obj: Record<string, unknown>, key: string, max: number, sourceName: string): string {
  const value = obj[key];
  if (typeof value !== 'string') {
    throw new Error(`${sourceName}: "${key}" must be plain text up to ${max} characters.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max || /[\u0000-\u001F]/.test(trimmed)) {
    throw new Error(`${sourceName}: "${key}" must be plain text up to ${max} characters.`);
  }
  return trimmed;
}

function expectInt(obj: Record<string, unknown>, key: string, min: number, max: number, sourceName: string): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${sourceName}: "${key}" must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function expectTime(obj: Record<string, unknown>, key: string, sourceName: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || parseMinutes(value) === null) {
    throw new Error(`${sourceName}: "${key}" must be a time like 07:00.`);
  }
  return value;
}

function parseDomains(value: unknown, sourceName: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${sourceName}: "allowedEmailDomains" must be a list of domain names.`);
  }
  return value.map((domain, index) => {
    if (typeof domain !== 'string' || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || domain.length > 253) {
      throw new Error(`${sourceName}: allowedEmailDomains[${index}] is not a domain name.`);
    }
    return domain.toLowerCase();
  });
}

function parseChoices(value: unknown, key: string, sourceName: string): Choice[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${sourceName}: "${key}" must be a non-empty list.`);
  }
  if (value.length > 200) {
    throw new Error(`${sourceName}: "${key}" has too many entries.`);
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${sourceName}: ${key}[${index}] must be an object with id and label.`);
    }
    const item = entry as Record<string, unknown>;
    const id = item.id;
    const label = item.label;
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(id)) {
      throw new Error(`${sourceName}: ${key}[${index}].id must be 1–40 letters, numbers, dots, underscores, or hyphens.`);
    }
    if (typeof label !== 'string' || !label.trim() || label.trim().length > 120 || /[\u0000-\u001F]/.test(label)) {
      throw new Error(`${sourceName}: ${key}[${index}].label must be plain text up to 120 characters.`);
    }
    if (seen.has(id)) throw new Error(`${sourceName}: duplicate ${key} id "${id}".`);
    seen.add(id);
    return { id, label: label.trim() };
  });
}

function parseLabs(value: unknown, sourceName: string): LabChoice[] {
  const choices = parseChoices(value, 'labs', sourceName);
  const entries = value as Array<Record<string, unknown>>;
  return choices.map((choice, index) => {
    const entry = entries[index] ?? {};
    const supervision = entry.supervision;
    if (supervision !== 'supervised' && supervision !== 'open') {
      throw new Error(`${sourceName}: labs[${index}].supervision must be "supervised" or "open".`);
    }
    return { ...choice, supervision: supervision as Supervision };
  });
}
