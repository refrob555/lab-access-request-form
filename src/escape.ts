export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#39;');
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return 'your email';
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  const first = user.slice(0, 1);
  return `${first}•••@${domain}`;
}

/** Remove addresses from operator-facing text. */
export function redactEmails(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300);
}

export function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Subjects stay short and ASCII so mail filters do not treat punctuation as a signal. */
export function plainSubject(value: string): string {
  return value
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FONT = 'Arial, Helvetica, sans-serif';

export type EmailAction = { label: string; url: string; background: string; border: string };

export function emailCard(input: {
  title: string;
  paragraphs: string[];
  facts?: Array<[string, string]>;
  closing?: string[];
  actions?: EmailAction[];
  /** Shown after the plain links, so the links stay above the explanation. */
  footnote?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  reference: string;
}): string {
  const href = input.ctaUrl ? safeHttpUrl(input.ctaUrl) : '';
  const opening = input.paragraphs
    .filter((paragraph) => paragraph.trim().length > 0)
    .map((paragraph) => paragraphHtml(paragraph))
    .join('');
  const after = (input.closing ?? [])
    .filter((paragraph) => paragraph.trim().length > 0)
    .map((paragraph) => paragraphHtml(paragraph))
    .join('');
  const factRows = (input.facts ?? [])
    .filter(([, value]) => value.trim().length > 0)
    .map(
      ([label, value]) =>
        `<tr>
            <td valign="top" style="padding:6px 16px 6px 0;font-family:${FONT};font-size:14px;line-height:1.4;font-weight:bold;color:#1c1915;vertical-align:top;width:148px;">${escapeHtml(label)}</td>
            <td valign="top" style="padding:6px 0;font-family:${FONT};font-size:14px;line-height:1.4;color:#1c1915;vertical-align:top;">${escapeHtml(value).replaceAll('\n', '<br>')}</td>
          </tr>`,
    )
    .join('');
  const facts = factRows
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 12px;">${factRows}</table>`
    : '';
  const actionLinks = (input.actions ?? [])
    .map((action) => {
      const actionHref = safeHttpUrl(action.url);
      return actionHref ? textLink(actionHref, `${action.label}: ${actionHref}`) : '';
    })
    .filter((link) => link.length > 0);
  const fallback = actionLinks
    .map((link) => `<p style="margin:0 0 12px;font-family:${FONT};font-size:16px;line-height:1.5;color:#1c1915;">${link}</p>`)
    .join('\n');
  const actionButtons = (input.actions ?? [])
    .map((action) => {
      const actionHref = safeHttpUrl(action.url);
      if (!actionHref) return '';
      return `<td style="padding:0 8px 8px 0;font-family:${FONT};font-size:16px;line-height:1.2;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${escapeHtml(action.background)}" style="background:${escapeHtml(action.background)};border:1px solid ${escapeHtml(action.border)};padding:10px 16px;font-family:${FONT};font-size:16px;line-height:1.2;font-weight:bold;">
                    <a href="${escapeHtml(actionHref)}" style="color:#1c1915;text-decoration:underline;font-family:${FONT};font-size:16px;font-weight:bold;">${escapeHtml(action.label)}</a>
                  </td>
                </tr>
              </table>
            </td>`;
    })
    .join('');
  const actionTable = actionButtons
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${actionButtons}</tr></table>`
    : '';
  const button = href && actionLinks.length === 0 ? `<p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.5;">${textLink(href, input.ctaLabel ?? 'Open')}</p>` : '';
  const footnote = input.footnote?.trim() ? paragraphHtml(input.footnote) : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
</head>
<body style="margin:0;padding:0;background:#f4f6f8;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin:0 auto;background:#ffffff;font-family:${FONT};color:#1c1915;">
    <tr>
      <td style="padding:28px 32px 8px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:bold;color:#1c1915;">${escapeHtml(input.title)}</td>
    </tr>
    <tr>
      <td style="padding:8px 32px 8px;font-family:${FONT};font-size:16px;line-height:1.5;color:#1c1915;">${opening}${facts}${after}</td>
    </tr>
    <tr>
      <td align="left" style="padding:8px 32px 20px;">${actionTable}${fallback}${button}${footnote}</td>
    </tr>
    <tr>
      <td style="padding:4px 32px 28px;font-family:${FONT};font-size:13px;line-height:1.4;color:#5c564e;">${escapeHtml(input.reference)}</td>
    </tr>
  </table>
</body>
</html>`;
}

function textLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:#0B5FFF;text-decoration:underline;font-family:${FONT};font-size:16px;">${escapeHtml(label)}</a>`;
}

function paragraphHtml(paragraph: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT};font-size:16px;line-height:1.5;color:#1c1915;">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`;
}

/** Keep the href that was built. Re-serializing the URL can change the bytes SES already signed. */
function safeHttpUrl(value: string): string {
  if (!/^https?:\/\/\S+$/i.test(value)) return '';
  if (/[\s<>"']/.test(value)) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  } catch {
    return '';
  }
  return value;
}

const SMTP_LINE = 998;

/**
 * The only body transform. Compose and the Resend POST both use it.
 * A second call returns the same bytes. LF only, 7-bit ASCII, one trailing LF.
 * HTML breaks only between tags, so a later hop is not asked to reflow a 76-column wrap.
 * No line starts with "--", which would make a multipart boundary unstable.
 */
export function stabilizeEmailPart(value: string, kind: 'text' | 'html' = 'text'): string {
  const normalized = value
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\n\x20-\x7E]/g, ' ')
    .replace(/[ \t]+$/gm, '');
  const laidOut = kind === 'html' ? breakAfterTags(normalized) : normalized;
  const limited = laidOut
    .split('\n')
    .flatMap((line) => limitLine(line))
    .map((line) => (line.startsWith('--') ? ` ${line}` : line))
    .join('\n')
    .replace(/\n+$/, '');
  return `${limited}\n`;
}

/** Newline after each tag. Indentation between tags is dropped. A second pass stays put. */
function breakAfterTags(value: string): string {
  let quote: '"' | "'" | '' = '';
  let out = '';
  let skipWs = false;
  for (const ch of value) {
    if (skipWs) {
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue;
      skipWs = false;
    }
    if (ch === '\r' || ch === '\t') continue;
    if (!quote && ch === '\n') continue;
    if (!quote && (ch === '"' || ch === "'")) quote = ch;
    else if (quote && ch === quote) quote = '';
    out += ch;
    if (!quote && ch === '>') {
      out += '\n';
      skipWs = true;
    }
  }
  return out;
}

function limitLine(line: string): string[] {
  if (line.length <= SMTP_LINE) return [line];
  const cut = lastTextSpace(line, SMTP_LINE);
  if (cut <= 0) return [line];
  return [line.slice(0, cut), ...limitLine(line.slice(cut + 1))];
}

/** Break only in text, never between a tag name and its attributes. */
function lastTextSpace(line: string, limit: number): number {
  let quote: '"' | "'" | '' = '';
  let cut = -1;
  for (let index = 0; index < line.length && index <= limit; index += 1) {
    const ch = line[index] ?? '';
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    const open = line.lastIndexOf('<', index);
    const close = line.lastIndexOf('>', index);
    const inTag = open > close;
    if (ch === ' ' && index < limit && !inTag) cut = index;
  }
  return cut;
}
