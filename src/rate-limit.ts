export type RateLimiter = {
  allow(ip: string, now?: number): boolean;
};

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(ip: string, now = Date.now()): boolean {
      const recent = (hits.get(ip) ?? []).filter((stamp) => now - stamp < windowMs);
      if (recent.length >= max) {
        hits.set(ip, recent);
        return false;
      }
      recent.push(now);
      hits.set(ip, recent);
      if (hits.size > 5000) {
        const oldest = hits.keys().next().value;
        if (oldest) hits.delete(oldest);
      }
      return true;
    },
  };
}
