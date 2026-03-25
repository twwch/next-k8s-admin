import { describe, it, expect } from '@jest/globals';

describe('crypto', () => {
  it('encrypts and decrypts text correctly', async () => {
    const { encrypt, decrypt } = await import('../crypto');
    const plaintext = 'my-secret-kubeconfig-content';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for same input (random IV)', async () => {
    const { encrypt } = await import('../crypto');
    const plaintext = 'same-text';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });
});
