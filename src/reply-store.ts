import type { KvBinding } from './decision-store.js';
import { openReply, REPLY_TTL_MS, sealReply, type OpenReply, type ReplyClaims } from './reply-token.js';

const TTL_SECONDS = Math.floor(REPLY_TTL_MS / 1000);
const SHORT_ID = /^[A-Za-z0-9_-]{22}$/;

export type ReplyTokenStore = {
  save(claims: ReplyClaims, secret: string): Promise<string>;
  open(token: string, secret: string, now?: number): Promise<OpenReply>;
};

export function memoryReplyStore(): ReplyTokenStore {
  const saved = new Map<string, string>();
  return {
    async save(claims, secret) {
      const id = newShortId();
      saved.set(id, await sealReply(claims, secret));
      return id;
    },
    async open(token, secret, now) {
      return openStored(token, secret, async (id) => saved.get(id) ?? null, now);
    },
  };
}

export function kvReplyStore(kv: KvBinding): ReplyTokenStore {
  return {
    async save(claims, secret) {
      const id = newShortId();
      await kv.put(replyKey(id), await sealReply(claims, secret), { expirationTtl: TTL_SECONDS });
      return id;
    },
    async open(token, secret, now) {
      return openStored(token, secret, (id) => kv.get(replyKey(id)), now);
    },
  };
}

async function openStored(
  token: string,
  secret: string,
  read: (id: string) => Promise<string | null>,
  now?: number,
): Promise<OpenReply> {
  if (token.includes('.')) return openReply(token, secret, now);
  if (!SHORT_ID.test(token)) return { ok: false, reason: 'invalid' };
  const sealed = await read(token);
  if (!sealed) return { ok: false, reason: 'invalid' };
  return openReply(sealed, secret, now);
}

function replyKey(id: string): string {
  return `reply:${id}`;
}

function newShortId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
