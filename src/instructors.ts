import instructorEmails from '../config/instructor-emails.json' with { type: 'json' };

const EMAILS = instructorEmails as Record<string, string>;

export function instructorAddress(instructorId: string): string | undefined {
  const email = EMAILS[instructorId];
  return email || undefined;
}
