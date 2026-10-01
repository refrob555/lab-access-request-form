export const REPLY_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type ReplyAction = 'approve' | 'deny' | 'other';

export type ReplyClaims = {
  reference: string;
  studentName: string;
  studentEmail: string;
  staffEmail: string;
  instructorId: string;
  instructorEmail: string;
  classLabel: string;
  instructorLabel: string;
  labLabel: string;
  dateLabel: string;
  startLabel: string;
  endLabel: string;
  leadLabel: string;
  noticeLabel: string;
  /** Epoch ms when the request was submitted. Absent on tokens sealed before this field existed. */
  submittedAt?: number;
  exp: number;
};

export type OpenReply = { ok: true; claims: ReplyClaims } | { ok: false; reason: 'invalid' | 'expired' };

export async function sealReply(claims: ReplyClaims, secret: string): Promise<string> {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = base64Url(new Uint8Array(await sign(secret, payload)));
  return `${payload}.${signature}`;
}

export async function openReply(token: string, secret: string, now = Date.now()): Promise<OpenReply> {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'invalid' };
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const valid = await verify(secret, payload, signature);
  if (!valid) return { ok: false, reason: 'invalid' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!isClaims(parsed)) return { ok: false, reason: 'invalid' };
  if (parsed.exp <= now) return { ok: false, reason: 'expired' };
  return { ok: true, claims: parsed };
}

export function isReplyAction(value: string): value is ReplyAction {
  return value === 'approve' || value === 'deny' || value === 'other';
}

function isClaims(value: unknown): value is ReplyClaims {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const strings = [
    'reference',
    'studentName',
    'studentEmail',
    'staffEmail',
    'instructorId',
    'instructorEmail',
    'classLabel',
    'instructorLabel',
    'labLabel',
    'dateLabel',
    'startLabel',
    'endLabel',
    'leadLabel',
    'noticeLabel',
  ] as const;
  if (!strings.every((key) => typeof record[key] === 'string' && (record[key] as string).length > 0 && (record[key] as string).length < 500)) {
    return false;
  }
  if ('submittedAt' in record && record.submittedAt !== undefined) {
    if (typeof record.submittedAt !== 'number' || !Number.isFinite(record.submittedAt)) return false;
  }
  return typeof record.exp === 'number' && Number.isFinite(record.exp) && /^LAB-[A-F0-9]{16}$/.test(record.reference as string);
}

/** Submit time sealed on the token, or the time implied by the 14-day expiry on older tokens. */
export function requestSubmittedAt(claims: ReplyClaims): number {
  if (typeof claims.submittedAt === 'number' && Number.isFinite(claims.submittedAt)) return claims.submittedAt;
  return claims.exp - REPLY_TTL_MS;
}

async function sign(secret: string, payload: string): Promise<ArrayBuffer> {
  const key = await hmacKey(secret);
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
}

async function verify(secret: string, payload: string, signature: string): Promise<boolean> {
  let sig: Uint8Array;
  try {
    sig = base64UrlDecode(signature);
  } catch {
    return false;
  }
  const key = await hmacKey(secret);
  const copy = new Uint8Array(sig.byteLength);
  copy.set(sig);
  return crypto.subtle.verify('HMAC', key, copy, new TextEncoder().encode(payload));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
