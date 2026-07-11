import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Derives a consistent 32-byte master encryption key using SHA-256
 * from environment secrets (`SMTP_ENCRYPTION_KEY` or `NEXTAUTH_SECRET`).
 */
function getMasterKey(): Buffer {
  const secret = process.env.SMTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // SECURITY: Never fall back to a hardcoded key. If no environment secret is set,
    // SMTP password encryption/decryption must not proceed silently.
    throw new Error(
      '[SMTP Crypto] FATAL: Neither SMTP_ENCRYPTION_KEY nor NEXTAUTH_SECRET environment variable is set. ' +
      'Add SMTP_ENCRYPTION_KEY=<random-32-char-secret> to your .env.local to enable secure SMTP credential storage.'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext SMTP password using AES-256-GCM.
 * Output format: `ivHex:authTagHex:cipherHex`
 */
export function encryptSmtpPassword(plainText: string): string {
  if (!plainText) return '';
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[SMTP Crypto] Encryption failed:', err);
    return '';
  }
}

/**
 * Decrypts an encrypted SMTP password string formatted as `ivHex:authTagHex:cipherHex`.
 * Returns the plaintext password exclusively on the server side (`'use server'` / node actions).
 * NEVER return or expose the result of this function to any client component or API response.
 */
export function decryptSmtpPassword(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // If it wasn't encrypted (e.g. legacy or test mock plain string), return empty or handle safely
      return '';
    }
    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[SMTP Crypto] Decryption failed:', err);
    return '';
  }
}
