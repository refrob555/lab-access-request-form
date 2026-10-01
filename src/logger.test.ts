import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultLogger } from './logger.js';

test('the default logger drops fields outside the allow list and redacts emails', () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line?: unknown) => {
    lines.push(String(line));
  };
  try {
    defaultLogger('email_failed', {
      detail: 'mailbox ada@school.edu rejected\nBcc: other@school.edu',
      requestId: 'LAB-1',
    });
    defaultLogger('decision', {
      requestId: 'LAB-1',
      action: 'deny',
      outcome: 'won',
      userAgent: 'BatchReview/1.0 person@school.edu',
      clientIp: '203.0.113.10',
      detail: 'token=should-not-matter reply?t=abc',
    });
  } finally {
    console.log = original;
  }
  const line = lines[0] ?? '';
  assert.equal(line.includes('ada@school.edu'), false);
  assert.equal(line.includes('other@school.edu'), false);
  assert.equal(line.includes('\n'), false);
  assert.match(line, /\[redacted-email\]/);
  assert.match(line, /LAB-1/);
  const decision = lines[1] ?? '';
  assert.match(decision, /"outcome":"won"/);
  assert.match(decision, /"action":"deny"/);
  assert.match(decision, /"clientIp":"203\.0\.113\.10"/);
  assert.match(decision, /"userAgent":"BatchReview\/1\.0 \[redacted-email\]"/);
  assert.equal(decision.includes('person@school.edu'), false);
});
