import type { OutboundMessage } from './types.js';

export const GMAIL_MAILBOX = 'coordinator@example.com';
export const GMAIL_FROM = `Lab Coordinator <${GMAIL_MAILBOX}>`;
const GMAIL_HOST = 'smtp.gmail.com';
const GMAIL_PORT = 465;
const SMTP_TIMEOUT_MS = 20_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type SmtpIo = {
  read(): Promise<Uint8Array | null>;
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
};

export type SmtpReply = {
  code: number;
  text: string;
};

type LineReader = {
  readReply(): Promise<SmtpReply>;
};

export function normalizeAppPassword(raw: string): string {
  return raw.replace(/ /g, '');
}

export function isAppPassword(raw: string): boolean {
  return normalizeAppPassword(raw.trim()).length > 0;
}

export function buildRawMessage(message: OutboundMessage, from: string, sentAt = new Date()): string {
  // Same boundary for a given request and role. No random boundary for a hop to replace.
  const boundary = `lab_${message.requestId}_${message.role}`.replace(/[^A-Za-z0-9_]/g, '');
  const headers = [
    `From: ${from}`,
    `To: ${message.to}`,
    ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
    `Subject: ${message.subject}`,
    `Date: ${formatRfc5322(sentAt)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const parts = [
    part(boundary, 'text/plain', message.text),
    part(boundary, 'text/html', message.html),
    `--${boundary}--`,
    '',
  ];
  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

export async function sendSmtpMessage(
  io: SmtpIo,
  input: { username: string; password: string; fromMailbox: string; message: OutboundMessage; fromHeader: string },
): Promise<void> {
  const reader = createLineReader(io);
  const secret = normalizeAppPassword(input.password);
  try {
    await expectReply(reader, [220], 'greeting', secret);
    await writeLine(io, 'EHLO gmail.com');
    await expectReply(reader, [250], 'EHLO', secret);
    const token = bytesToBase64(encoder.encode(`\0${input.username}\0${secret}`));
    await writeLine(io, `AUTH PLAIN ${token}`);
    await expectReply(reader, [235], 'authentication', secret);
    await writeLine(io, `MAIL FROM:<${input.fromMailbox}>`);
    await expectReply(reader, [250], 'MAIL FROM', secret);
    await writeLine(io, `RCPT TO:<${input.message.to}>`);
    await expectReply(reader, [250, 251], 'RCPT TO', secret);
    await writeLine(io, 'DATA');
    await expectReply(reader, [354], 'DATA', secret);
    await io.write(encoder.encode(dotStuff(buildRawMessage(input.message, input.fromHeader))));
    await expectReply(reader, [250], 'message body', secret);
    await writeLine(io, 'QUIT');
  } finally {
    await io.close().catch(() => undefined);
  }
}

export async function openGmailSocket(): Promise<SmtpIo> {
  const { connect } = await import('cloudflare:sockets');
  const socket = connect(
    { hostname: GMAIL_HOST, port: GMAIL_PORT },
    { secureTransport: 'on', allowHalfOpen: false },
  );
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  return {
    read: async () => {
      const { value, done } = await reader.read();
      if (done || !value) return null;
      return value;
    },
    write: async (data) => {
      await writer.write(data);
    },
    close: async () => {
      await writer.close().catch(() => undefined);
      await socket.close().catch(() => undefined);
    },
  };
}

export async function sendGmailMessage(
  message: OutboundMessage,
  fromHeader: string,
  password: string,
  open: () => Promise<SmtpIo> = openGmailSocket,
): Promise<void> {
  const secret = normalizeAppPassword(password);
  const io = await withTimeout(open(), SMTP_TIMEOUT_MS, 'connect');
  await withTimeout(
    sendSmtpMessage(io, {
      username: GMAIL_MAILBOX,
      password: secret,
      fromMailbox: GMAIL_MAILBOX,
      fromHeader,
      message,
    }),
    SMTP_TIMEOUT_MS,
    'delivery',
  );
}

function part(boundary: string, contentType: string, body: string): string {
  return [
    `--${boundary}`,
    `Content-Type: ${contentType}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(bytesToBase64(encoder.encode(body))),
    '',
  ].join('\r\n');
}

function dotStuff(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/, '').split('\n');
  const stuffed = lines.map((line) => (line.startsWith('.') ? `.${line}` : line)).join('\r\n');
  return `${stuffed}\r\n.\r\n`;
}

function createLineReader(io: SmtpIo): LineReader {
  let buffer = '';

  async function readLine(): Promise<string> {
    while (true) {
      const breakAt = buffer.indexOf('\n');
      if (breakAt >= 0) {
        const line = buffer.slice(0, breakAt).replace(/\r$/, '');
        buffer = buffer.slice(breakAt + 1);
        return line;
      }
      const chunk = await io.read();
      if (!chunk || chunk.byteLength === 0) {
        throw new Error('SMTP connection closed.');
      }
      buffer += decoder.decode(chunk, { stream: true });
    }
  }

  return {
    async readReply() {
      const lines: string[] = [];
      while (true) {
        const line = await readLine();
        lines.push(line);
        const match = /^(\d{3})([ -])(.*)$/.exec(line);
        if (!match?.[1] || !match[2]) throw new Error('SMTP reply was not understood.');
        if (match[2] === ' ') return { code: Number(match[1]), text: lines.join('\n') };
      }
    },
  };
}

async function expectReply(reader: LineReader, codes: number[], step: string, secret: string): Promise<SmtpReply> {
  const reply = await reader.readReply();
  if (!codes.includes(reply.code)) {
    throw new Error(`SMTP ${step} failed: ${scrub(reply.text, secret)}`);
  }
  return reply;
}

async function writeLine(io: SmtpIo, line: string): Promise<void> {
  await io.write(encoder.encode(`${line}\r\n`));
}

function scrub(text: string, secret: string): string {
  let cleaned = text.replace(/\s+/g, ' ').slice(0, 180);
  if (secret) cleaned = cleaned.split(secret).join('[redacted]');
  return cleaned;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function wrapBase64(value: string): string {
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += 76) lines.push(value.slice(index, index + 76));
  return lines.join('\r\n');
}

function formatRfc5322(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${days[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SMTP ${step} timed out.`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
