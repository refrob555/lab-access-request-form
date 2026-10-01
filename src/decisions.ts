import { emailCard, plainSubject, stabilizeEmailPart } from './escape.js';
import { CHECK_IN } from './labs.js';
import { requestSubmittedAt, type ReplyAction, type ReplyClaims } from './reply-token.js';
import { formatElapsed, formatTimeRange } from './time.js';
import type { OutboundMessage } from './types.js';

const TITLES: Record<ReplyAction, string> = {
  approve: 'Approved',
  deny: 'Denied',
  other: 'Other',
};

const SUBJECTS: Record<ReplyAction, string> = {
  approve: 'Lab access request approved',
  deny: 'Lab access request denied',
  other: 'Lab access request update',
};

const STUDENT_APPROVAL_CLEARANCE =
  'If anyone else should show up to use the room, even if your time is approved, you agree to immediately clear the room or lab.';

export function composeDecision(input: {
  claims: ReplyClaims;
  action: ReplyAction;
  note: string;
  collegeName: string;
  replyUrl: string;
  decidedAt?: number;
}): OutboundMessage[] {
  const title = TITLES[input.action];
  const note = input.note.trim() ? input.note.trim() : 'No note was added.';
  const effect =
    input.action === 'approve'
      ? `This request is approved. ${CHECK_IN}`
      : input.action === 'deny'
        ? 'This request is denied. Do not enter the lab for this session.'
        : 'This response is Other. It is not an approval or a denial, and it is not approval to enter the lab.';
  const facts: Array<[string, string]> = [
    ['Decision', title],
    ...(typeof input.decidedAt === 'number'
      ? [['Response time', formatElapsed(input.decidedAt - requestSubmittedAt(input.claims))] as [string, string]]
      : []),
    [input.action === 'other' ? 'Message' : 'Note', note],
    ['Reference', input.claims.reference],
    ['Student', input.claims.studentName],
    ['Class', input.claims.classLabel],
    ['Instructor', input.claims.instructorLabel],
    ['Lab/trainer', input.claims.labLabel],
    ['Session', `${input.claims.dateLabel}, ${formatTimeRange(input.claims.startLabel, input.claims.endLabel)}`],
    ['Lead time', input.claims.leadLabel],
    ['24-hour notice', input.claims.noticeLabel],
  ];
  const subject = plainSubject(`${SUBJECTS[input.action]} ${input.claims.reference}`);
  const bodies = (paragraphs: string[]) => {
    const text = [
      ...paragraphs.flatMap((paragraph) => [paragraph, '']),
      ...facts.map(([label, value]) => `${label}: ${value}`),
      '',
      `Reply form: ${input.replyUrl}`,
      '',
      input.collegeName,
    ].join('\n');
    const html = emailCard({
      title,
      paragraphs,
      facts,
      ctaLabel: 'View this request',
      ctaUrl: input.replyUrl,
      reference: input.claims.reference,
    });
    return { text, html };
  };
  const shared = bodies([effect]);
  const student = input.action === 'approve' ? bodies([effect, STUDENT_APPROVAL_CLEARANCE]) : shared;
  const messages: OutboundMessage[] = [
    {
      requestId: input.claims.reference,
      role: 'instructor',
      to: input.claims.instructorEmail,
      subject,
      text: shared.text,
      html: shared.html,
    },
  ];
  if (input.claims.staffEmail.toLowerCase() !== input.claims.instructorEmail.toLowerCase()) {
    messages.push({
      requestId: input.claims.reference,
      role: 'staff',
      to: input.claims.staffEmail,
      subject,
      text: shared.text,
      html: shared.html,
    });
  }
  messages.push({
    requestId: input.claims.reference,
    role: 'student',
    to: input.claims.studentEmail,
    replyTo: input.claims.instructorEmail,
    subject,
    text: student.text,
    html: student.html,
  });
  return messages.map((message) => ({
    ...message,
    text: stabilizeEmailPart(message.text, 'text'),
    html: stabilizeEmailPart(message.html, 'html'),
  }));
}

