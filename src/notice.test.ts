import assert from 'node:assert/strict';
import test from 'node:test';
import { SHORT_NOTICE } from './labs.js';
import { submissionNotice } from './notice.js';

test('lead time uses the same 24-hour check as the form', () => {
  const now = new Date('2026-10-06T16:00:00Z');
  const soon = submissionNotice('2026-10-07', '07:00', 'America/Chicago', now);
  assert.equal(soon.shortNotice, true);
  assert.equal(soon.leadLabel, '20 hours before the requested start');
  assert.equal(soon.noticeLabel, `Not met. ${SHORT_NOTICE}`);

  const later = submissionNotice('2026-10-07', '16:00', 'America/Chicago', now);
  assert.equal(later.shortNotice, false);
  assert.equal(later.leadLabel, '1 day 5 hours before the requested start');
  assert.equal(later.noticeLabel, 'Met. The requested start is at least 24 hours after this submission.');
});
