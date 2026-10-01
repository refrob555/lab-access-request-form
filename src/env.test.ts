import assert from 'node:assert/strict';
import test from 'node:test';
import { readEnv } from './env.js';

test('mock mode is the default and the staff inbox is preset', () => {
  const env = readEnv({});
  assert.equal(env.emailMode, 'mock');
  assert.equal(env.deliveryReady, true);
  assert.equal(env.staffEmail, 'coordinator@example.edu');
  assert.match(env.emailFrom, /lab-access@localhost/);
  assert.equal(env.publicBaseUrl, 'https://forms.trainlabhq.com/atcflexlabaccess');
  assert.equal(env.basePath, '/atcflexlabaccess');
});

test('live mode stays closed until every email setting is present, without echoing secrets', () => {
  const incomplete = readEnv({ EMAIL_MODE: 'resend', RESEND_API_KEY: 're_supersecretkey' });
  assert.equal(incomplete.emailMode, 'resend');
  assert.equal(incomplete.deliveryReady, false);

  assert.throws(
    () => readEnv({ EMAIL_MODE: 'resend', RESEND_API_KEY: 're_supersecretkey', EMAIL_FROM: 'bad\nfrom' }),
    (err: unknown) => {
      const message = err instanceof Error ? err.message : '';
      assert.equal(message.includes('re_supersecretkey'), false);
      assert.match(message, /EMAIL_FROM/);
      return true;
    },
  );

  const ready = readEnv({
    EMAIL_MODE: 'resend',
    EMAIL_FROM: 'Lab Access <lab@school.edu>',
    RESEND_API_KEY: 're_live_key_value',
    RECEIPT_SECRET: 'receipt-secret-value',
  });
  assert.equal(ready.deliveryReady, true);
  assert.equal(ready.emailFrom, 'Lab Access <lab@school.edu>');

  const trainlab = readEnv({
    EMAIL_MODE: 'resend',
    EMAIL_FROM: 'ATC Flex Labs <noreply@trainlabhq.com>',
    RESEND_API_KEY: 're_live_key_value',
    RECEIPT_SECRET: 'receipt-secret-value',
  });
  assert.equal(trainlab.emailFrom, 'Flexlab Use Request <noreply@trainlabhq.com>');
});

test('unsupported EMAIL_MODE is rejected', () => {
  assert.throws(() => readEnv({ EMAIL_MODE: 'smtp' }), /EMAIL_MODE must be mock, gmail_smtp, or resend/);
});

test('gmail smtp stays closed until the app password and receipt secret exist', () => {
  const waiting = readEnv({
    EMAIL_MODE: 'gmail_smtp',
    EMAIL_FROM: 'onboarding@resend.dev',
    STAFF_EMAIL: 'coordinator@example.edu',
    RECEIPT_SECRET: 'receipt-secret-value',
  });
  assert.equal(waiting.deliveryReady, false);
  assert.equal(waiting.emailFrom, 'Lab Coordinator <coordinator@example.com>');
  assert.equal(waiting.staffEmail, 'coordinator@example.edu');
  assert.equal(waiting.gmailAppPassword, undefined);

  const spaced = readEnv({
    EMAIL_MODE: 'gmail_smtp',
    GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
    RECEIPT_SECRET: 'receipt-secret-value',
  });
  assert.equal(spaced.deliveryReady, true);
  assert.equal(spaced.gmailAppPassword, 'abcdefghijklmnop');
  assert.equal(spaced.emailFrom, 'Lab Coordinator <coordinator@example.com>');

  const shortPassword = readEnv({
    EMAIL_MODE: 'gmail_smtp',
    GMAIL_APP_PASSWORD: 'abc def ghijk',
    RECEIPT_SECRET: 'receipt-secret-value',
  });
  assert.equal(shortPassword.deliveryReady, true);
  assert.equal(shortPassword.gmailAppPassword, 'abcdefghijk');
  assert.equal(shortPassword.gmailAppPassword?.length, 11);

  const blank = readEnv({
    EMAIL_MODE: 'gmail_smtp',
    GMAIL_APP_PASSWORD: '   ',
    RECEIPT_SECRET: 'receipt-secret-value',
  });
  assert.equal(blank.deliveryReady, false);
  assert.equal(blank.gmailAppPassword, undefined);
});
