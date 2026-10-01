import { plainSubject, redactEmails, stabilizeEmailPart } from './escape.js';
import type { Env } from './env.js';
import { defaultLogger } from './logger.js';
import { sendGmailMessage, type SmtpIo } from './smtp.js';
import type { OutboundMessage } from './types.js';

export class EmailDeliveryError extends Error {
  readonly code: 'resend_failed' | 'gmail_failed' | 'mock_failed';

  constructor(code: EmailDeliveryError['code'], message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.code = code;
  }
}

export type DeliveryReport = {
  studentDelivered: boolean;
  studentError?: string;
};

export type MailTransport = {
  send(message: OutboundMessage, from: string): Promise<void>;
};

export type Mailer = {
  sendAll(messages: OutboundMessage[]): Promise<DeliveryReport>;
};

export type MockOutboxEntry = {
  requestId: string;
  delivery: 'mock';
  createdAt: string;
  messages: Array<Pick<OutboundMessage, 'role' | 'to' | 'replyTo' | 'subject' | 'text' | 'html'>>;
};

const mockOutbox: MockOutboxEntry[] = [];

export function readMockOutbox(): MockOutboxEntry[] {
  return mockOutbox.map((entry) => structuredClone(entry));
}

export function clearMockOutbox(): void {
  mockOutbox.length = 0;
}

export function createMailer(env: Env, transport?: MailTransport, openSocket?: () => Promise<SmtpIo>): Mailer {
  const failureCode = env.emailMode === 'gmail_smtp' ? 'gmail_failed' : 'resend_failed';
  const sender = transport ?? (env.emailMode === 'gmail_smtp' ? gmailTransport(env, openSocket) : resendTransport(env));
  return {
    async sendAll(messages: OutboundMessage[]): Promise<DeliveryReport> {
      const student = messages.find((message) => message.role === 'student');
      const copies = messages.filter((message) => message.role !== 'student');
      if (!student || copies.length === 0) {
        throw new EmailDeliveryError('mock_failed', 'The request messages were incomplete.');
      }
      const queue = uniqueByAddress([...copies, student]);

      if (env.emailMode === 'mock') {
        rememberMock(queue);
        return { studentDelivered: true };
      }

      if (!env.deliveryReady) {
        throw new EmailDeliveryError(failureCode, 'Email sending is not configured.');
      }

      const studentAddress = student.to.toLowerCase();
      let studentAlreadySent = false;
      for (const message of queue) {
        if (message.role !== 'student') {
          try {
            await sender.send(message, env.emailFrom);
          } catch (err) {
            throw new EmailDeliveryError(failureCode, redactError(err));
          }
          if (message.to.toLowerCase() === studentAddress) studentAlreadySent = true;
          continue;
        }
        if (studentAlreadySent) return { studentDelivered: true };
        try {
          await sender.send(message, env.emailFrom);
          return { studentDelivered: true };
        } catch (err) {
          return { studentDelivered: false, studentError: redactError(err) };
        }
      }
      return { studentDelivered: studentAlreadySent };
    },
  };
}

function uniqueByAddress(messages: OutboundMessage[]): OutboundMessage[] {
  const seen = new Set<string>();
  const unique: OutboundMessage[] = [];
  for (const message of messages) {
    const key = message.to.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(message);
  }
  return unique;
}

function rememberMock(messages: OutboundMessage[]): void {
  const requestId = messages[0]?.requestId ?? 'request';
  mockOutbox.unshift({
    requestId,
    delivery: 'mock',
    createdAt: new Date().toISOString(),
    messages: messages.map((message) => ({
      role: message.role,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })),
  });
  if (mockOutbox.length > 20) mockOutbox.length = 20;
}

function resendId(body: string): string {
  try {
    const parsed = JSON.parse(body) as { id?: unknown };
    return typeof parsed.id === 'string' && /^[A-Za-z0-9_-]+$/.test(parsed.id) ? parsed.id : '';
  } catch {
    return '';
  }
}

function redactError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Email delivery failed.';
  return redactEmails(message);
}

function gmailTransport(env: Env, openSocket?: () => Promise<SmtpIo>): MailTransport {
  return {
    async send(message: OutboundMessage, from: string): Promise<void> {
      if (!env.gmailAppPassword) throw new EmailDeliveryError('gmail_failed', 'Gmail SMTP is not configured.');
      await sendGmailMessage(message, from, env.gmailAppPassword, openSocket);
    },
  };
}

/** Fields Resend copies into MIME. No headers, tags, or attachments for it to rewrite. */
export function resendPayload(message: OutboundMessage, from: string): Record<string, string | string[]> {
  const payload: Record<string, string | string[]> = {
    from,
    to: [message.to],
    subject: plainSubject(message.subject),
    text: stabilizeEmailPart(message.text, 'text'),
    html: stabilizeEmailPart(message.html, 'html'),
  };
  if (message.replyTo) payload.reply_to = message.replyTo;
  return payload;
}

function resendTransport(env: Env): MailTransport {
  return {
    async send(message: OutboundMessage, from: string): Promise<void> {
      if (!env.resendApiKey) throw new EmailDeliveryError('resend_failed', 'Resend is not configured.');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendPayload(message, from)),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new EmailDeliveryError('resend_failed', `Email service returned status ${response.status}.`);
      }
      const id = resendId(body);
      if (id) defaultLogger('email_queued', { requestId: message.requestId, detail: `resend ${id}` });
    },
  };
}
