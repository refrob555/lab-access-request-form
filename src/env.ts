import type { EmailMode } from './mail-mode.js';
import { readPublicUrl } from './public-url.js';
import { GMAIL_FROM, GMAIL_MAILBOX, isAppPassword, normalizeAppPassword } from './smtp.js';

export type { EmailMode } from './mail-mode.js';

export type Env = {
  emailMode: EmailMode;
  staffEmail: string;
  emailFrom: string;
  resendApiKey?: string;
  gmailAppPassword?: string;
  receiptSecret: string;
  mockToken?: string;
  deliveryReady: boolean;
  publicBaseUrl: string;
  basePath: string;
};

const DEFAULT_STAFF_EMAIL = 'coordinator@example.edu';
const TRAINLAB_FROM = 'Flexlab Use Request <noreply@trainlabhq.com>';
const MOCK_RECEIPT_SECRET = 'mock-mode-receipt-secret';
const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const FROM_RE =
  /^(?:[^<>\r\n]{1,80}<[^<>\r\n@\s]+@[^<>\r\n\s]+>|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)$/;

export type EnvSource = Record<string, string | undefined>;

export function readEnv(source: EnvSource = process.env): Env {
  const modeRaw = optional(source, 'EMAIL_MODE').toLowerCase();
  let emailMode: EmailMode;
  if (!modeRaw) {
    emailMode = 'mock';
  } else if (modeRaw === 'mock' || modeRaw === 'resend' || modeRaw === 'gmail_smtp') {
    emailMode = modeRaw;
  } else {
    throw new Error('EMAIL_MODE must be mock, gmail_smtp, or resend.');
  }

  const staffEmail = optional(source, 'STAFF_EMAIL') || DEFAULT_STAFF_EMAIL;
  if (!EMAIL_RE.test(staffEmail) || staffEmail.length > 254) {
    throw new Error('STAFF_EMAIL must be a single email address.');
  }

  const emailFrom = optional(source, 'EMAIL_FROM');
  if (emailFrom && !FROM_RE.test(emailFrom)) {
    throw new Error('EMAIL_FROM must be an email address, or a name and address like Lab Access <lab@school.edu>.');
  }

  const resendApiKey = optional(source, 'RESEND_API_KEY');
  if (resendApiKey && (/\s/.test(resendApiKey) || resendApiKey.length < 8)) {
    throw new Error('RESEND_API_KEY is not a usable token.');
  }

  const gmailRaw = optional(source, 'GMAIL_APP_PASSWORD');
  const gmailAppPassword = gmailRaw && isAppPassword(gmailRaw) ? normalizeAppPassword(gmailRaw) : undefined;

  const receiptSecret = optional(source, 'RECEIPT_SECRET');
  const mockToken = optional(source, 'MOCK_TOKEN');
  const gmailFrom = mailboxAddress(emailFrom) === GMAIL_MAILBOX ? emailFrom : GMAIL_FROM;
  const resendFrom = mailboxAddress(emailFrom) === 'noreply@trainlabhq.com' ? TRAINLAB_FROM : emailFrom;
  const resolvedFrom =
    emailMode === 'gmail_smtp' ? gmailFrom : resendFrom || (emailMode === 'mock' ? 'Lab Access <lab-access@localhost>' : '');
  const liveReady =
    emailMode === 'gmail_smtp'
      ? Boolean(gmailAppPassword && receiptSecret && resolvedFrom)
      : Boolean(emailFrom && resendApiKey && receiptSecret);
  const deliveryReady = emailMode === 'mock' || liveReady;
  const published = readPublicUrl(source);

  return {
    emailMode,
    staffEmail,
    emailFrom: resolvedFrom,
    resendApiKey: resendApiKey || undefined,
    gmailAppPassword,
    receiptSecret: receiptSecret || MOCK_RECEIPT_SECRET,
    mockToken: mockToken || undefined,
    deliveryReady,
    publicBaseUrl: published.publicBaseUrl,
    basePath: published.basePath,
  };
}

function mailboxAddress(from: string): string {
  const angled = from.match(/<([^<>\s]+)>/);
  return (angled?.[1] ?? from).trim().toLowerCase();
}

function optional(source: EnvSource, key: string): string {
  return source[key]?.trim() ?? '';
}
