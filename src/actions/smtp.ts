'use server';

import { getSession } from '@/actions/auth';
import { getStoreSmtpSettings, saveStoreSmtpSettings, addMockAuditLog, addMockEmailLog } from '@/lib/mock-store';
import { encryptSmtpPassword, decryptSmtpPassword } from '@/lib/smtp-crypto';
import { SmtpSettings } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';
import { getTestEmailHtml } from '@/lib/email-templates';

/**
 * Server action to fetch current SMTP configuration for the Admin UI.
 * Enforces backend RLS: only admins can view.
 * Never returns the raw encrypted or plaintext password back to the UI.
 */
export async function getSmtpSettingsAction(): Promise<{
  success?: boolean;
  error?: string;
  settings?: SmtpSettings & { password_placeholder?: string };
}> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required to access SMTP settings.' };
  }

  const stored = getStoreSmtpSettings();
  const safeSettings = {
    ...stored,
    password_placeholder: stored.password_encrypted ? '••••••••' : '',
    password_encrypted: undefined, // strip from frontend response
  };

  return { success: true, settings: safeSettings };
}

/**
 * Server action to save and encrypt SMTP settings.
 */
export async function saveSmtpSettingsAction(formData: FormData): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required to modify SMTP settings.' };
  }

  const server_address = formData.get('server_address')?.toString().trim() || '';
  const portStr = formData.get('port')?.toString() || '587';
  const port = parseInt(portStr, 10) || 587;
  const username = formData.get('username')?.toString().trim() || '';
  const passwordInput = formData.get('password')?.toString() || '';
  const password_required = formData.get('password_required')?.toString() === 'true';
  const sender_email = formData.get('sender_email')?.toString().trim() || '';
  const sender_name = formData.get('sender_name')?.toString().trim() || 'Dhanuka Meeting Room System';

  if (!server_address || !sender_email) {
    return { error: 'SMTP Server Address and Sender Email Address are required fields.' };
  }

  if (password_required && !username) {
    return { error: 'SMTP Username is required when authentication is enabled.' };
  }

  const existing = getStoreSmtpSettings();
  let password_encrypted = '';

  if (password_required) {
    if (passwordInput && passwordInput !== '••••••••') {
      // Admin typed a new password -> encrypt before storing at rest
      password_encrypted = encryptSmtpPassword(passwordInput);
    } else if (existing.password_encrypted) {
      // Admin kept the existing masked password
      password_encrypted = existing.password_encrypted;
    } else {
      return { error: 'SMTP Password is required when authentication is enabled.' };
    }
  }

  const updatedSettings: SmtpSettings = {
    server_address,
    port,
    username: password_required ? username : '',
    password_encrypted,
    password_required,
    sender_email,
    sender_name,
    is_configured: true,
    updated_at: new Date().toISOString(),
    updated_by: session.id,
  };

  saveStoreSmtpSettings(updatedSettings);

  // Log configuration change in audit log (NEVER log sensitive credentials or values)
  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'smtp_settings_updated',
    performed_by: session.id,
    target_id: null,
    details: {
      action: 'save_settings',
      server_address,
      port,
      password_required,
      sender_email,
      sender_name,
      timestamp: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });

  revalidatePath('/admin');
  return { success: true, message: 'SMTP settings saved securely with server-side encryption.' };
}

/**
 * Server action to clear all SMTP settings.
 */
export async function clearSmtpSettingsAction(): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
}> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  saveStoreSmtpSettings({
    server_address: '',
    port: 587,
    username: '',
    password_encrypted: '',
    password_required: true,
    sender_email: 'notifications@dhanuka.com',
    sender_name: 'Dhanuka Meeting Room System',
    is_configured: false,
  });

  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'smtp_settings_updated',
    performed_by: session.id,
    target_id: null,
    details: {
      action: 'clear_settings',
      timestamp: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });

  revalidatePath('/admin');
  return { success: true, message: 'SMTP settings cleared. All automated email triggers disabled.' };
}

/**
 * Server action to send a verification test email using active or form-level SMTP settings.
 */
export async function sendTestEmailAction(
  testEmail: string,
  customConfig?: {
    server_address: string;
    port: number;
    username: string;
    password?: string;
    password_required: boolean;
    sender_email: string;
    sender_name: string;
  }
): Promise<{ success?: boolean; error?: string; message?: string }> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required to send test emails.' };
  }

  if (!testEmail || !testEmail.includes('@')) {
    return { error: 'Please enter a valid recipient email address for testing.' };
  }

  let serverAddress = '';
  let port = 587;
  let username = '';
  let plainPassword = '';
  let passwordRequired = true;
  let senderEmail = '';
  let senderName = '';

  if (customConfig && customConfig.server_address) {
    serverAddress = customConfig.server_address;
    port = customConfig.port || 587;
    username = customConfig.username || '';
    passwordRequired = customConfig.password_required;
    senderEmail = customConfig.sender_email || 'notifications@dhanuka.com';
    senderName = customConfig.sender_name || 'Dhanuka Meeting Room System';

    if (customConfig.password && customConfig.password !== '••••••••') {
      plainPassword = customConfig.password;
    } else {
      const active = getStoreSmtpSettings();
      plainPassword = active.password_encrypted ? decryptSmtpPassword(active.password_encrypted) : '';
    }
  } else {
    const active = getStoreSmtpSettings();
    if (!active.is_configured || !active.server_address) {
      return { error: 'SMTP configuration not set up or not saved yet.' };
    }
    serverAddress = active.server_address;
    port = active.port;
    username = active.username;
    passwordRequired = active.password_required;
    senderEmail = active.sender_email;
    senderName = active.sender_name;
    plainPassword = active.password_encrypted ? decryptSmtpPassword(active.password_encrypted) : '';
  }

  if (passwordRequired && !plainPassword) {
    return { error: 'Missing SMTP password. Please re-enter your password to run test send.' };
  }

  try {
    const transportConfig: any = {
      host: serverAddress,
      port,
      secure: port === 465, // true for 465, false for other ports
    };

    if (passwordRequired && username) {
      transportConfig.auth = {
        user: username,
        pass: plainPassword,
      };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    // Verify connection first or send directly
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: testEmail,
      subject: '[Dhanuka Test] SMTP Configuration Verification',
      html: getTestEmailHtml(testEmail),
    });

    addMockEmailLog({
      id: crypto.randomUUID(),
      recipient: testEmail,
      subject: '[Dhanuka Test] SMTP Configuration Verification',
      event_type: 'test_verification',
      status: 'sent',
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Test verification email sent successfully to ${testEmail} (Message ID: ${info.messageId || 'DELIVERED'})`,
    };
  } catch (err: any) {
    console.error('[SMTP Test Send Error]:', err);
    const errMsg = err.message || 'SMTP Connection / Authentication failed';

    addMockEmailLog({
      id: crypto.randomUUID(),
      recipient: testEmail,
      subject: '[Dhanuka Test] SMTP Configuration Verification',
      event_type: 'test_verification',
      status: 'failed',
      error_message: errMsg,
      created_at: new Date().toISOString(),
    });

    return {
      success: false,
      error: `SMTP Error: ${errMsg}`,
    };
  }
}

/**
 * Phase 4: Non-blocking reliable email notification sender.
 * If SMTP is not configured or if sending fails, it NEVER blocks or throws errors to the underlying action.
 * Includes basic retry logic (1 retry after 500ms for transient errors) and logs all attempts to email audit history.
 */
export async function sendNotificationEmail({
  to,
  subject,
  html,
  eventType,
}: {
  to?: string | null;
  subject: string;
  html: string;
  eventType: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'No valid recipient email address provided' };
  }

  const settings = getStoreSmtpSettings();
  if (!settings.is_configured || !settings.server_address) {
    // Silently log and skip without blocking or crashing application logic
    addMockEmailLog({
      id: crypto.randomUUID(),
      recipient: to,
      subject,
      event_type: eventType,
      status: 'failed',
      error_message: 'SMTP settings not configured on server',
      created_at: new Date().toISOString(),
    });
    return { success: false, error: 'SMTP settings not configured on server' };
  }

  const plainPassword = settings.password_encrypted ? decryptSmtpPassword(settings.password_encrypted) : '';
  if (settings.password_required && !plainPassword) {
    addMockEmailLog({
      id: crypto.randomUUID(),
      recipient: to,
      subject,
      event_type: eventType,
      status: 'failed',
      error_message: 'Stored SMTP password could not be decrypted or is empty',
      created_at: new Date().toISOString(),
    });
    return { success: false, error: 'Stored SMTP password could not be decrypted or is empty' };
  }

  const transportConfig: any = {
    host: settings.server_address,
    port: settings.port,
    secure: settings.port === 465,
  };

  if (settings.password_required && settings.username) {
    transportConfig.auth = {
      user: settings.username,
      pass: plainPassword,
    };
  }

  const transporter = nodemailer.createTransport(transportConfig);
  const mailOptions = {
    from: `"${settings.sender_name}" <${settings.sender_email}>`,
    to,
    subject,
    html,
  };

  // Attempt send with 1 retry logic for transient failures
  try {
    await transporter.sendMail(mailOptions);
    addMockEmailLog({
      id: crypto.randomUUID(),
      recipient: to,
      subject,
      event_type: eventType,
      status: 'sent',
      created_at: new Date().toISOString(),
    });
    return { success: true };
  } catch (firstErr: any) {
    console.warn(`[SMTP Notification Retry] First attempt failed for ${to} (${eventType}): ${firstErr.message}. Retrying...`);
    try {
      await new Promise((r) => setTimeout(r, 500));
      await transporter.sendMail(mailOptions);
      addMockEmailLog({
        id: crypto.randomUUID(),
        recipient: to,
        subject,
        event_type: eventType,
        status: 'sent',
        created_at: new Date().toISOString(),
      });
      return { success: true };
    } catch (retryErr: any) {
      console.error(`[SMTP Notification Fatal] Second attempt failed for ${to} (${eventType}):`, retryErr);
      const errMsg = retryErr.message || 'SMTP delivery failed after retry';
      addMockEmailLog({
        id: crypto.randomUUID(),
        recipient: to,
        subject,
        event_type: eventType,
        status: 'failed',
        error_message: errMsg,
        created_at: new Date().toISOString(),
      });
      return { success: false, error: errMsg };
    }
  }
}
