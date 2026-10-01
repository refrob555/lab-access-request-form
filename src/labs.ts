export const SUPERVISED_RULE =
  'Supervised at all times (staff or instructor). ATC staff must confirm nothing is already scheduled and that someone can supervise.';

export const OPEN_RULE = 'May be used without direct supervision, but it must still be arranged in advance.';

export const BUSINESS_DAY_ERROR =
  'Choose a date at least one business day ahead. Saturday and Sunday are not available.';

export const SHORT_NOTICE = 'This start time is less than 24 hours away.';

export const CHECK_IN = 'Check in at the ATC front desk before entering the lab.';

export function supervisionRule(supervision: 'supervised' | 'open'): string {
  return supervision === 'supervised' ? SUPERVISED_RULE : OPEN_RULE;
}
