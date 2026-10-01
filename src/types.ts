export const FIELD_NAMES = [
  'studentName',
  'studentId',
  'studentEmail',
  'classId',
  'instructorId',
  'labId',
  'date',
  'startTime',
  'endTime',
  'notes',
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export type FieldErrors = Partial<Record<FieldName, string>>;

export type LabRequestInput = Record<FieldName, string>;

export type ValidatedLabRequest = LabRequestInput & {
  classLabel: string;
  instructorLabel: string;
  labLabel: string;
  supervisionRule: string;
  dateLabel: string;
  startLabel: string;
  endLabel: string;
  durationMinutes: number;
};

export type EmailRole = 'staff' | 'instructor' | 'student';

export type OutboundMessage = {
  requestId: string;
  role: EmailRole;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type DeliveryKind = 'mock' | 'sent' | 'coordinator_only';

export type Choice = {
  id: string;
  label: string;
};

export type Supervision = 'supervised' | 'open';

export type LabChoice = Choice & {
  supervision: Supervision;
};

export type AppOptions = {
  collegeName: string;
  formTitle: string;
  intro: string;
  footerNote: string;
  privacyNote: string;
  timezone: string;
  maxDaysAhead: number;
  maxDurationMinutes: number;
  slotMinutes: number;
  dayStart: string;
  dayEnd: string;
  allowedEmailDomains: string[];
  classes: Choice[];
  instructors: Choice[];
  labs: LabChoice[];
};
