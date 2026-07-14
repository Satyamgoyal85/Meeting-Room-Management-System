import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStoreSmtpSettings, saveStoreSmtpSettings, getStoreEmailLogs } from '@/lib/mock-store';
import { SmtpSettings } from '@/lib/types';

// Mock auth session
vi.mock('@/actions/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ id: 'mock-admin-id', role: 'admin' }),
}));

// Mock next/cache revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock nodemailer
const mockVerify = vi.fn();
const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockImplementation(() => ({
      verify: mockVerify,
      sendMail: mockSendMail,
    })),
  },
}));

describe('saveSmtpSettingsAction with split persistence and verification', () => {
  const MOCK_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env.SMTP_ENCRYPTION_KEY = MOCK_KEY;
    mockVerify.mockReset();
    // Set initial configuration in store
    const initialSettings: SmtpSettings = {
      server_address: 'smtp.oldworking.com',
      port: 587,
      username: 'olduser@working.com',
      password_encrypted: 'old-encrypted-pass',
      password_required: true,
      sender_email: 'notifications@dhanuka.com',
      sender_name: 'Dhanuka Meeting Room System',
      is_configured: true,
    };
    saveStoreSmtpSettings(initialSettings);
  });

  afterEach(() => {
    delete process.env.SMTP_ENCRYPTION_KEY;
  });

  it('always saves entered fields so work is retained, but sets is_configured=false when live verification fails (connection/timeout)', async () => {
    const { saveSmtpSettingsAction } = await import('@/actions/smtp');

    // Simulate connection failure (e.g. wrong port 999 or timed out)
    mockVerify.mockRejectedValue(new Error('ETIMEDOUT: Connection timed out after 10 seconds'));

    const formData = new FormData();
    formData.append('server_address', 'smtp.broken.com');
    formData.append('port', '999'); // wrong port
    formData.append('username', 'newuser@broken.com');
    formData.append('password', 'SecretPass123!');
    formData.append('password_required', 'true');
    formData.append('sender_email', 'notifications@broken.com');
    formData.append('sender_name', 'Broken System');

    const result = await saveSmtpSettingsAction(formData);

    // Should return success=false for verification, but saved=true so UI reloads settings
    expect(result.success).toBe(false);
    expect(result.saved).toBe(true);
    expect(result.error).toContain('Could not connect: connection timed out');

    // Verify configuration WAS saved to retain entered values across refresh, but marked unverified (is_configured=false)
    const stored = getStoreSmtpSettings();
    expect(stored.server_address).toBe('smtp.broken.com');
    expect(stored.port).toBe(999);
    expect(stored.username).toBe('newuser@broken.com');
    expect(stored.is_configured).toBe(false);

    // Verify failure log recorded
    const logs = getStoreEmailLogs();
    const latestLog = logs[logs.length - 1];
    expect(latestLog.event_type).toBe('gateway_verification');
    expect(latestLog.status).toBe('failed');
  });

  it('saves entered fields and sets is_configured=false when authentication fails', async () => {
    const { saveSmtpSettingsAction } = await import('@/actions/smtp');

    // Simulate authentication failure
    mockVerify.mockRejectedValue(new Error('Invalid login: 535 Authentication failed'));

    const formData = new FormData();
    formData.append('server_address', 'smtp.validserver.com');
    formData.append('port', '587');
    formData.append('username', 'wronguser@validserver.com');
    formData.append('password', 'WrongPass!');
    formData.append('password_required', 'true');
    formData.append('sender_email', 'notifications@validserver.com');
    formData.append('sender_name', 'Valid System');

    const result = await saveSmtpSettingsAction(formData);

    expect(result.success).toBe(false);
    expect(result.saved).toBe(true);
    expect(result.error).toContain('Authentication failed: invalid username or password');

    const stored = getStoreSmtpSettings();
    expect(stored.server_address).toBe('smtp.validserver.com');
    expect(stored.is_configured).toBe(false);
  });

  it('saves configuration and marks is_configured=true when live verification succeeds', async () => {
    const { saveSmtpSettingsAction } = await import('@/actions/smtp');

    // Simulate connection + auth success
    mockVerify.mockResolvedValue(true);

    const formData = new FormData();
    formData.append('server_address', 'smtp.newverified.com');
    formData.append('port', '587');
    formData.append('username', 'newuser@verified.com');
    formData.append('password', 'NewSecretPass123!');
    formData.append('password_required', 'true');
    formData.append('sender_email', 'notifications@verified.com');
    formData.append('sender_name', 'Verified System');

    const result = await saveSmtpSettingsAction(formData);

    expect(result.success).toBe(true);
    expect(result.saved).toBe(true);
    expect(result.message).toContain('SMTP configuration verified and saved successfully');

    const stored = getStoreSmtpSettings();
    expect(stored.server_address).toBe('smtp.newverified.com');
    expect(stored.port).toBe(587);
    expect(stored.username).toBe('newuser@verified.com');
    expect(stored.is_configured).toBe(true);
    expect(stored.password_encrypted).not.toBe('NewSecretPass123!');
    expect(stored.password_encrypted).toContain(':');
  });
});
