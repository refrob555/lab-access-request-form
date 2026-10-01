import type { ReplyAction } from './reply-token.js';

export type StoredDecision = ReplyAction | 'need-info';

export type DecisionRecord = {
  action: StoredDecision;
  note: string;
  studentDelivered: boolean | null;
  /** Epoch ms when this confirm claimed the decision. Absent on records written before this field. */
  decidedAt?: number;
};

export type ClaimResult =
  | { won: true; claimId: string; record: DecisionRecord }
  | { won: false; record: DecisionRecord };

export type DecisionStore = {
  get(reference: string): Promise<DecisionRecord | null>;
  put(reference: string, action: ReplyAction, note?: string, studentDelivered?: boolean | null): Promise<void>;
  claim(reference: string, action: ReplyAction, note?: string): Promise<ClaimResult>;
  complete(reference: string, claimId: string, studentDelivered: boolean): Promise<void>;
  release(reference: string, claimId: string): Promise<void>;
};

export type KvBinding = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

const TTL_SECONDS = 14 * 24 * 60 * 60;

/** How long a confirm may hold the decision before mail finishes. A second confirm loses until this expires. */
export const DECISION_CLAIM_LEASE_MS = 120_000;

type MemoryRow = DecisionRecord & {
  claimId: string;
  pending: boolean;
  claimedAt: number;
};

export function memoryDecisionStore(): DecisionStore {
  const saved = new Map<string, MemoryRow>();
  let tail: Promise<void> = Promise.resolve();
  const exclusive = <T>(fn: () => T): Promise<T> => {
    const run = tail.then(fn);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  return {
    get(reference) {
      return exclusive(() => finalized(saved.get(reference)));
    },
    put(reference, action, note = '', studentDelivered = null) {
      return exclusive(() => {
        saved.set(reference, { action, note, studentDelivered, claimId: 'seeded', pending: false, claimedAt: 0 });
      });
    },
    claim(reference, action, note = '') {
      return exclusive(() => takeClaim(saved, reference, action, note));
    },
    complete(reference, claimId, studentDelivered) {
      return exclusive(() => {
        const row = saved.get(reference);
        if (!row || row.claimId !== claimId) return;
        saved.set(reference, { ...row, studentDelivered, pending: false });
      });
    },
    release(reference, claimId) {
      return exclusive(() => {
        const row = saved.get(reference);
        if (!row || row.claimId !== claimId || !row.pending) return;
        saved.delete(reference);
      });
    },
  };
}

export function kvDecisionStore(kv: KvBinding): DecisionStore {
  return {
    async get(reference) {
      return parseRecord(await kv.get(key(reference)));
    },
    async put(reference, action, note = '', studentDelivered = null) {
      await kv.put(key(reference), JSON.stringify({ action, note, studentDelivered }), { expirationTtl: TTL_SECONDS });
    },
    async claim() {
      throw new Error('decision_lock_required');
    },
    async complete() {
      throw new Error('decision_lock_required');
    },
    async release() {
      throw new Error('decision_lock_required');
    },
  };
}

export function parseRecord(value: string | null): DecisionRecord | null {
  if (!value) return null;
  if (isStoredDecision(value)) return { action: value, note: '', studentDelivered: null };
  try {
    const parsed = JSON.parse(value) as { action?: unknown; note?: unknown; studentDelivered?: unknown; decidedAt?: unknown };
    if (!isStoredDecision(parsed.action)) return null;
    const decidedAt = typeof parsed.decidedAt === 'number' && Number.isFinite(parsed.decidedAt) ? parsed.decidedAt : undefined;
    return {
      action: parsed.action,
      note: typeof parsed.note === 'string' ? parsed.note : '',
      studentDelivered: typeof parsed.studentDelivered === 'boolean' ? parsed.studentDelivered : null,
      ...(decidedAt === undefined ? {} : { decidedAt }),
    };
  } catch {
    return null;
  }
}

export function finalized(row: MemoryRow | DecisionRecord | undefined): DecisionRecord | null {
  if (!row) return null;
  if ('pending' in row && row.pending) return null;
  const claimedAt = 'claimedAt' in row && typeof row.claimedAt === 'number' && row.claimedAt > 0 ? row.claimedAt : undefined;
  const decidedAt = claimedAt ?? (typeof row.decidedAt === 'number' && row.decidedAt > 0 ? row.decidedAt : undefined);
  return {
    action: row.action,
    note: row.note,
    studentDelivered: row.studentDelivered,
    ...(typeof decidedAt === 'number' ? { decidedAt } : {}),
  };
}

function takeClaim(saved: Map<string, MemoryRow>, reference: string, action: ReplyAction, note: string): ClaimResult {
  const existing = saved.get(reference);
  const recorded = finalized(existing);
  if (recorded) return { won: false, record: recorded };
  if (existing && holding(existing)) {
    return { won: false, record: { action: existing.action, note: existing.note, studentDelivered: null, decidedAt: existing.claimedAt } };
  }
  const claimId = crypto.randomUUID();
  const decidedAt = Date.now();
  const record: DecisionRecord = { action, note, studentDelivered: null, decidedAt };
  saved.set(reference, { ...record, claimId, pending: true, claimedAt: decidedAt });
  return { won: true, claimId, record };
}

function holding(row: MemoryRow): boolean {
  return row.pending && Date.now() - row.claimedAt < DECISION_CLAIM_LEASE_MS;
}

function isStoredDecision(value: unknown): value is StoredDecision {
  return value === 'approve' || value === 'deny' || value === 'other' || value === 'need-info';
}

function key(reference: string): string {
  return `decision:${reference}`;
}

export function decisionKey(reference: string): string {
  return key(reference);
}

export { TTL_SECONDS as DECISION_TTL_SECONDS };
