/**
 * Unit Tests: SMTP Crypto
 * Tests the AES-256-GCM encrypt/decrypt cycle for SMTP password storage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock process.env before importing the module
describe('SMTP Crypto (smtp-crypto.ts)', () => {
  const MOCK_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  describe('with SMTP_ENCRYPTION_KEY set', () => {
    beforeEach(() => {
      process.env.SMTP_ENCRYPTION_KEY = MOCK_KEY;
    });

    afterEach(() => {
      delete process.env.SMTP_ENCRYPTION_KEY;
      delete process.env.NEXTAUTH_SECRET;
      // Clear module cache to re-import with fresh env
      vi.resetModules();
    });

    it('encrypts and decrypts a password correctly (round-trip)', async () => {
      const { encryptSmtpPassword, decryptSmtpPassword } = await import('@/lib/smtp-crypto');
      const plaintext = 'MySecureSmtp@Pass123!';
      const encrypted = encryptSmtpPassword(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':'); // format: ivHex:authTagHex:cipherHex
      const decrypted = decryptSmtpPassword(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const { encryptSmtpPassword } = await import('@/lib/smtp-crypto');
      const plaintext = 'samepassword';
      const enc1 = encryptSmtpPassword(plaintext);
      const enc2 = encryptSmtpPassword(plaintext);
      expect(enc1).not.toBe(enc2); // Different IVs = different outputs
    });

    it('returns empty string for empty plaintext', async () => {
      const { encryptSmtpPassword } = await import('@/lib/smtp-crypto');
      expect(encryptSmtpPassword('')).toBe('');
    });

    it('returns empty string when decrypting empty string', async () => {
      const { decryptSmtpPassword } = await import('@/lib/smtp-crypto');
      expect(decryptSmtpPassword('')).toBe('');
    });

    it('returns empty string when decrypting malformed ciphertext', async () => {
      const { decryptSmtpPassword } = await import('@/lib/smtp-crypto');
      expect(decryptSmtpPassword('not-valid-encrypted-data')).toBe('');
    });
  });

  describe('without any encryption key set', () => {
    beforeEach(() => {
      delete process.env.SMTP_ENCRYPTION_KEY;
      delete process.env.NEXTAUTH_SECRET;
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('returns empty string when encrypting without key (error is caught and logged)', async () => {
      vi.resetModules();
      const { encryptSmtpPassword } = await import('@/lib/smtp-crypto');
      // The function catches the internal getMasterKey error and returns '' to avoid crashes.
      // The caller must check for empty string to detect configuration failure.
      const result = encryptSmtpPassword('somepassword');
      expect(result).toBe('');
    });

    it('returns empty string when decrypting without key (error is caught and logged)', async () => {
      vi.resetModules();
      const { decryptSmtpPassword } = await import('@/lib/smtp-crypto');
      // Same catch-and-return-empty pattern for decryption
      const result = decryptSmtpPassword('abc:def:ghi');
      expect(result).toBe('');
    });
  });

  describe('with NEXTAUTH_SECRET as fallback', () => {
    beforeEach(() => {
      delete process.env.SMTP_ENCRYPTION_KEY;
      process.env.NEXTAUTH_SECRET = MOCK_KEY;
    });

    afterEach(() => {
      delete process.env.NEXTAUTH_SECRET;
      vi.resetModules();
    });

    it('encrypts and decrypts correctly using NEXTAUTH_SECRET fallback', async () => {
      const { encryptSmtpPassword, decryptSmtpPassword } = await import('@/lib/smtp-crypto');
      const plaintext = 'TestPassword99';
      const encrypted = encryptSmtpPassword(plaintext);
      const decrypted = decryptSmtpPassword(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });
});
