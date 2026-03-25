import { describe, it, expect } from '@jest/globals';
import { RateLimiter } from '../rate-limit';
describe('RateLimiter', () => {
  it('allows requests within limit', () => {
    const limiter = new RateLimiter(3, 60000);
    expect(limiter.check('key1')).toBe(true);
    expect(limiter.check('key1')).toBe(true);
    expect(limiter.check('key1')).toBe(true);
  });
  it('blocks requests exceeding limit', () => {
    const limiter = new RateLimiter(2, 60000);
    limiter.check('key2'); limiter.check('key2');
    expect(limiter.check('key2')).toBe(false);
  });
  it('isolates keys', () => {
    const limiter = new RateLimiter(1, 60000);
    expect(limiter.check('a')).toBe(true);
    expect(limiter.check('b')).toBe(true);
    expect(limiter.check('a')).toBe(false);
  });
});
