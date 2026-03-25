interface RateEntry { count: number; resetAt: number; }
export class RateLimiter {
  private store = new Map<string, RateEntry>();
  constructor(private maxRequests: number, private windowMs: number) {}
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.maxRequests) return false;
    entry.count++;
    return true;
  }
  reset(key: string): void { this.store.delete(key); }
}
export const loginLimiter = new RateLimiter(5, 60000);
export const emailCodeLimiter = new RateLimiter(1, 60000);
