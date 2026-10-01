import { CONFLICT_EMAIL_NOTE, NO_CONFLICT_NOTE } from './conflicts.js';
import { emailCard, plainSubject, stabilizeEmailPart, type EmailAction } from './escape.js';
import { submissionNotice } from './notice.js';
import { formatDuration, formatStamp, formatTimeLabel } from './time.js';
import type { OutboundMessage, ValidatedLabRequest } from './types.js';

export function composeMessages(input: {
  request: ValidatedLabRequest;
  reference: string;
  staffEmail: string;
  submittedAt: Date;
  timeZone: string;
  collegeName: string;
  replyUrl: string;
  receivedUrl: string;
  conflictLines?: string[];
}): OutboundMessage[] {
  const submitted = formatStamp(input.submittedAt, input.timeZone);
  const notice = submissionNotice(input.request.date, input.request.startTime, input.timeZone, input.submittedAt);
  const facts = requestFacts(input.request, input.reference, submitted, notice.leadLabel, notice.noticeLabel);
  const conflictBlock = conflictText(input.conflictLines ?? []);
  const studentIntro = [
    `Hello ${input.request.studentName},`,
    '',
    'Your ATC Flex Labs request was received. This email is not a confirmation and does not grant access. Wait for confirmation, and check in at the ATC front desk before entering the lab.',
    '',
  ].join('\n');
  const studentOutro = [
    '',
    'The lab coordinator will review the request. Keep this reference if you need to ask about it.',
    '',
    input.collegeName,
    'Lab access request',
  ].join('\n');

  const staffIntro = ['An ATC Flex Labs access request was submitted.', ''].join('\n');
  const staffOutro = ['', `Respond to request: ${input.replyUrl}`].join('\n');
  const studentReceipt = 'The student was notified. A receipt was sent.';
  const staffActions: EmailAction[] = [
    { label: 'Respond to request', url: input.replyUrl, background: '#E7F0FF', border: '#0B5FFF' },
  ];

  const messages: OutboundMessage[] = [
    {
      requestId: input.reference,
      role: 'staff',
      to: input.staffEmail,
      subject: plainSubject(`Lab access request ${input.reference}`),
      text: `${staffIntro}${factsToText(facts)}${conflictBlock}\n\n${studentReceipt}${staffOutro}`,
      html: factsToHtml({
        heading: 'Lab access request',
        intro: 'An ATC Flex Labs access request was submitted.',
        facts,
        conflictLines: input.conflictLines ?? [],
        outro: '',
        afterConflict: studentReceipt,
        actions: staffActions,
        reference: input.reference,
      }),
    },
    {
      requestId: input.reference,
      role: 'student',
      to: input.request.studentEmail,
      replyTo: input.staffEmail,
      subject: plainSubject(`Lab access request received ${input.reference}`),
      text: `${studentIntro}${factsToText(facts)}${conflictBlock}${studentOutro}\nRequest page: ${input.receivedUrl}\n`,
      html: factsToHtml({
        heading: 'Lab access request received',
        intro: `Hello ${input.request.studentName}. Your ATC Flex Labs request was received. This email is not a confirmation and does not grant access. Wait for confirmation, and check in at the ATC front desk before entering the lab.`,
        facts,
        conflictLines: input.conflictLines ?? [],
        outro: 'The lab coordinator will review the request. Keep this reference if you need to ask about it.',
        ctaLabel: 'View this request',
        ctaUrl: input.receivedUrl,
        reference: input.reference,
      }),
    },
  ];
  return messages.map(stabilizeMessage);
}

function requestFacts(
  request: ValidatedLabRequest,
  reference: string,
  submitted: string,
  leadLabel: string,
  noticeLabel: string,
): Array<[string, string]> {
  const facts: Array<[string, string]> = [
    ['Reference', reference],
    ['Submitted', submitted],
    ['Student name', request.studentName],
    ['S-ID', request.studentId],
    ['Student email', request.studentEmail],
    ['Class', request.classLabel],
    ['Instructor', request.instructorLabel],
    ['Lab/trainer', request.labLabel],
    ['Supervision', request.supervisionRule],
    ['Date', request.dateLabel],
    ['Start time', formatTimeLabel(request.startLabel)],
    ['End time', formatTimeLabel(request.endLabel)],
    ['Duration', formatDuration(request.durationMinutes)],
    ['Lead time', leadLabel],
    ['24-hour notice', noticeLabel],
  ];
  const notes = request.notes.trim();
  if (notes) facts.push(['Notes', notes]);
  return facts;
}

function factsToText(facts: Array<[string, string]>): string {
  return facts.map(([label, value]) => `${label}: ${value}`).join('\n');
}

function conflictText(lines: string[]): string {
  if (lines.length === 0) return `\n\n${NO_CONFLICT_NOTE}`;
  return `\n\n${CONFLICT_EMAIL_NOTE}\n${lines.join('\n')}`;
}

function stabilizeMessage<T extends { text: string; html: string }>(message: T): T {
  return { ...message, text: stabilizeEmailPart(message.text, 'text'), html: stabilizeEmailPart(message.html, 'html') };
}

function factsToHtml(input: {
  heading: string;
  intro: string;
  facts: Array<[string, string]>;
  conflictLines: string[];
  outro: string;
  afterConflict?: string;
  actions?: EmailAction[];
  ctaLabel?: string;
  ctaUrl?: string;
  reference: string;
}): string {
  const conflict =
    input.conflictLines.length === 0 ? NO_CONFLICT_NOTE : `${CONFLICT_EMAIL_NOTE}\n${input.conflictLines.join('\n')}`;
  return emailCard({
    title: input.heading,
    paragraphs: [input.intro],
    facts: input.facts,
    closing: input.actions ? [conflict, ...(input.afterConflict ? [input.afterConflict] : [])] : [conflict, input.outro],
    actions: input.actions,
    footnote: input.actions ? input.outro : undefined,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    reference: input.reference,
  });
}
