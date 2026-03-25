import { describe, it, expect } from '@jest/globals';
import { hashPassword, comparePassword } from '../password';
describe('password', () => {
  it('hashes and verifies password correctly', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).not.toBe('mypassword');
    expect(await comparePassword('mypassword', hash)).toBe(true);
    expect(await comparePassword('wrong', hash)).toBe(false);
  });
});
