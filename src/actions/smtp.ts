'use server';

import { getSession } from '@/actions/auth';
import { getStoreSmtpSettings, saveStoreSmtpSettings, addMockAuditLog, addMockEmailLog, getStoreEmailLogs } from '@/lib/mock-store';
import { encryptSmtpPassword, decryptSmtpPassword } from '@/lib/smtp-crypto';
import { SmtpSettings, EmailLogEntry } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';
import { getTestEmailHtml } from '@/lib/email-templates';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Helper to fetch active SMTP settings from real Supabase table with fallback to local mock store.
 */
async function getActiveSmtpSettings(): Promise<SmtpSettings> {
  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!isPlaceholderUrl) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await (supabase.from('smtp_settings') as any).select('*').limit(1);
      if (!error && data && data.length > 0) {
        const row: any = data[0];
        const settings: SmtpSettings = {
          server_address: row.server_address || '',
          port: row.port || 587,
          username: row.username || '',
          password_encrypted: row.password_encrypted || '',
          password_required: row.password_required ?? true,
          sender_email: row.sender_email || 'notifications@dhanuka.com',
          sender_name: row.sender_name || 'Dhanuka Meeting Room System',
          is_configured: row.is_configured ?? false,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
        };
        // Keep in-memory cache synchronized with real DB
        saveStoreSmtpSettings(settings);
        return settings;
      }
    } catch (dbErr) {
      console.error('[getActiveSmtpSettings DB Error]:', dbErr);
    }
  }
  return getStoreSmtpSettings();
}

/**
 * Helper to log email and verification events to both real Supabase public.email_logs and local mock store.
 */
async function logEmailEvent({
  recipient,
  subject,
  event_type,
  status,
  error_message,
  booking_id,
}: {
  recipient: string;
  subject: string;
  event_type: string;
  status: string;
  error_message?: string | null;
  booking_id?: string | null;
}) {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  // 1. Always record in local store as fallback
  addMockEmailLog({
    id,
    recipient,
    subject,
    event_type,
    status: status as any,
    error_message: error_message || undefined,
    created_at,
  });

  // 2. Record directly in real Supabase database public.email_logs
  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!isPlaceholderUrl) {
    try {
      const supabase = createAdminClient();
      await (supabase.from('email_logs') as any).insert({
        id,
        recipient,
        subject,
        event_type,
        booking_id: booking_id || null,
        status,
        error_message: error_message || null,
        created_at,
      });
    } catch (dbErr) {
      console.error('[logEmailEvent DB Insert Error]:', dbErr);
    }
  }
}

/**
 * Server action to fetch current SMTP configuration for the Admin UI from real Supabase database.
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

  const settingsObj = await getActiveSmtpSettings();

  const safeSettings = {
    ...settingsObj,
    password_placeholder: settingsObj.password_encrypted ? '••••••••' : '',
    password_encrypted: undefined, // strip from frontend response
  };

  return { success: true, settings: safeSettings };
}

/**
 * Server action to fetch all email delivery and verification logs from real Supabase database.
 */
export async function getEmailLogsAction(): Promise<{
  success?: boolean;
  error?: string;
  logs?: EmailLogEntry[];
}> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return { error: 'Unauthorized: Admin privileges required.' };
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!isPlaceholderUrl) {
    try {
      const supabase = createAdminClient();
      const { data, error } = await (supabase.from('email_logs') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        const mappedLogs: EmailLogEntry[] = data.map((row: any) => ({
          id: row.id,
          recipient: row.recipient,
          subject: row.subject,
          event_type: row.event_type,
          status: row.status,
          error_message: row.error_message || undefined,
          created_at: row.created_at,
        }));
        return { success: true, logs: mappedLogs };
      }
    } catch (err) {
      console.error('[getEmailLogsAction Error]:', err);
    }
  }

  return { success: true, logs: getStoreEmailLogs() };
}

/**
 * Server action to save and encrypt SMTP settings.
 * Splits saving (always persists values to DB right away) from verification check (sets is_configured status).
 */
export async function saveSmtpSettingsAction(formData: FormData): Promise<{
  success?: boolean;
  saved?: boolean;
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

  const existing = await getActiveSmtpSettings();
  let plainPassword = '';
  let password_encrypted = '';

  if (password_required) {
    if (passwordInput && passwordInput !== '••••••••') {
      plainPassword = passwordInput;
      password_encrypted = encryptSmtpPassword(passwordInput);
    } else if (existing.password_encrypted) {
      plainPassword = decryptSmtpPassword(existing.password_encrypted);
      password_encrypted = existing.password_encrypted;
    } else {
      return { error: 'SMTP Password is required when authentication is enabled.' };
    }

    if (!plainPassword) {
      return { error: 'Missing SMTP password. Please enter your password to save settings.' };
    }
  }

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  // 1. First, ALWAYS write the entered configuration fields (and encrypted password) to real Supabase database immediately.
  // This ensures the admin's entered values persist across page refreshes even if live connection verification fails.
  const updatedSettings: SmtpSettings = {
    server_address,
    port,
    username: password_required ? username : '',
    password_encrypted,
    password_required,
    sender_email,
    sender_name,
    is_configured: false, // will be upgraded to true if verification passes below
    updated_at: new Date().toISOString(),
    updated_by: session.id,
  };

  if (!isPlaceholderUrl) {
    try {
      const supabase = createAdminClient();
      const { data: existingRows } = await (supabase.from('smtp_settings') as any).select('id').limit(1);
      if (existingRows && existingRows.length > 0) {
        await (supabase.from('smtp_settings') as any).update({
          server_address,
          port,
          username: password_required ? username : '',
          password_encrypted,
          sender_name,
          sender_email,
          use_ssl: port === 465,
          password_required,
          is_configured: false,
          updated_at: new Date().toISOString(),
          updated_by: session.id,
        }).eq('id', existingRows[0].id);
      } else {
        await (supabase.from('smtp_settings') as any).insert({
          server_address,
          port,
          username: password_required ? username : '',
          password_encrypted,
          sender_name,
          sender_email,
          use_ssl: port === 465,
          password_required,
          is_configured: false,
          updated_at: new Date().toISOString(),
          updated_by: session.id,
        });
      }
    } catch (dbErr) {
      console.error('[saveSmtpSettings DB Upsert Error]:', dbErr);
    }
  }

  saveStoreSmtpSettings(updatedSettings);

  // 2. Now perform live connection and login verification using Nodemailer.
  try {
    const transportConfig: any = {
      host: server_address,
      port,
      secure: port === 465, // true for 465, false for other ports
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    };

    if (password_required && username) {
      transportConfig.auth = {
        user: username,
        pass: plainPassword,
      };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out after 10 seconds. Check server address and port.')), 10000)
      ),
    ]);
  } catch (err: any) {
    console.error('[SMTP Verification Error during Save]:', err);
    let errMsg = err.message || 'Could not connect or authenticate with SMTP server';

    if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timed out') || errMsg.includes('timeout') || errMsg.includes('Connection timed out after 10 seconds')) {
      errMsg = `Could not connect: connection timed out to ${server_address}:${port}. Please verify the server address and port number.`;
    } else if (errMsg.includes('ECONNREFUSED')) {
      errMsg = `Could not connect: connection refused by ${server_address}:${port}. Check if the server address and port are correct and accepting connections.`;
    } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('EAI_AGAIN') || errMsg.includes('getaddrinfo')) {
      errMsg = `Could not connect: server address "${server_address}" could not be found (DNS lookup failed).`;
    } else if (errMsg.includes('EAUTH') || errMsg.includes('535') || errMsg.includes('Authentication failed') || errMsg.includes('Invalid login') || errMsg.includes('Username and Password not accepted') || errMsg.includes('auth')) {
      errMsg = `Authentication failed: invalid username or password for "${username}". Check your credentials and security settings.`;
    } else if (errMsg.includes('self-signed certificate') || errMsg.includes('self signed certificate')) {
      errMsg = `Connection failed: SSL/TLS certificate verification error (${errMsg}). Check your port and security type.`;
    } else if (errMsg.includes('wrong version number') || errMsg.includes('SSL routines')) {
      errMsg = `Connection failed: SSL/TLS handshake failed on port ${port}. If using port 587 or 25, do not use SSL Direct (use TLS/STARTTLS instead).`;
    } else {
      errMsg = `Could not verify SMTP configuration: ${errMsg}`;
    }

    // Log the failed verification check directly into real Supabase public.email_logs
    await logEmailEvent({
      recipient: `${server_address}:${port}`,
      subject: '[Dhanuka Gateway] Live Connection Verification',
      event_type: 'gateway_verification',
      status: 'failed',
      error_message: errMsg,
    });

    // Return failure for the live check, BUT indicate that configuration fields were saved
    return {
      success: false,
      saved: true,
      error: `Settings saved to database, but connection verification failed: ${errMsg}`,
    };
  }

  // 3. Verification succeeded! Mark is_configured as true in Supabase and memory.
  updatedSettings.is_configured = true;
  if (!isPlaceholderUrl) {
    try {
      const supabase = createAdminClient();
      await (supabase.from('smtp_settings') as any).update({ is_configured: true }).neq('server_address', 'NON_EXISTENT_STRING');
    } catch (dbErr) {
      console.error('[saveSmtpSettings DB Mark Configured Error]:', dbErr);
    }
  }
  saveStoreSmtpSettings(updatedSettings);

  // Log successful verification attempt
  await logEmailEvent({
    recipient: `${server_address}:${port}`,
    subject: '[Dhanuka Gateway] Live Connection Verification',
    event_type: 'gateway_verification',
    status: 'sent',
  });

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
  return { success: true, saved: true, message: 'SMTP configuration verified and saved successfully to database.' };
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

  const isPlaceholderUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!isPlaceholderUrl) {
    try {
      const supabase = createAdminClient();
      await (supabase.from('smtp_settings') as any).delete().neq('server_address', 'NON_EXISTENT_STRING');
    } catch (dbErr) {
      console.error('[clearSmtpSettingsAction DB Error]:', dbErr);
    }
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
      const active = await getActiveSmtpSettings();
      plainPassword = active.password_encrypted ? decryptSmtpPassword(active.password_encrypted) : '';
    }
  } else {
    const active = await getActiveSmtpSettings();
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
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    };

    if (passwordRequired && username) {
      transportConfig.auth = {
        user: username,
        pass: plainPassword,
      };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    // Verify connection first or send directly
    const info: any = await Promise.race([
      transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: testEmail,
        subject: '[Dhanuka Test] SMTP Configuration Verification',
        html: getTestEmailHtml(testEmail),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test email send timed out after 10 seconds.')), 10000)
      ),
    ]);

    await logEmailEvent({
      recipient: testEmail,
      subject: '[Dhanuka Test] SMTP Configuration Verification',
      event_type: 'test_verification',
      status: 'sent',
    });

    return {
      success: true,
      message: `Test verification email sent successfully to ${testEmail} (Message ID: ${info?.messageId || 'DELIVERED'})`,
    };
  } catch (err: any) {
    console.error('[SMTP Test Send Error]:', err);
    let errMsg = err.message || 'SMTP Connection / Authentication failed';

    if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timed out') || errMsg.includes('timeout')) {
      errMsg = `Could not connect: connection timed out to ${serverAddress}:${port}. Please verify the server address and port number.`;
    } else if (errMsg.includes('ECONNREFUSED')) {
      errMsg = `Could not connect: connection refused by ${serverAddress}:${port}. Check if the server address and port are correct and accepting connections.`;
    } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('EAI_AGAIN') || errMsg.includes('getaddrinfo')) {
      errMsg = `Could not connect: server address "${serverAddress}" could not be found (DNS lookup failed).`;
    } else if (errMsg.includes('EAUTH') || errMsg.includes('535') || errMsg.includes('Authentication failed') || errMsg.includes('Invalid login') || errMsg.includes('Username and Password not accepted') || errMsg.includes('auth')) {
      errMsg = `Authentication failed: invalid username or password for "${username}". Check your credentials and security settings.`;
    } else if (errMsg.includes('self-signed certificate') || errMsg.includes('self signed certificate')) {
      errMsg = `Connection failed: SSL/TLS certificate verification error (${errMsg}). Check your port and security type.`;
    } else if (errMsg.includes('wrong version number') || errMsg.includes('SSL routines')) {
      errMsg = `Connection failed: SSL/TLS handshake failed on port ${port}. If using port 587 or 25, do not use SSL Direct (use TLS/STARTTLS instead).`;
    }

    await logEmailEvent({
      recipient: testEmail,
      subject: '[Dhanuka Test] SMTP Configuration Verification',
      event_type: 'test_verification',
      status: 'failed',
      error_message: errMsg,
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
  attachments,
  icalEvent,
}: {
  to?: string | null;
  subject: string;
  html: string;
  eventType: string;
  attachments?: nodemailer.SendMailOptions['attachments'];
  icalEvent?: {
    filename?: string;
    method?: string;
    content: string | Buffer;
  };
}): Promise<{ success: boolean; error?: string }> {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'No valid recipient email address provided' };
  }

  const settings = await getActiveSmtpSettings();
  if (!settings.is_configured || !settings.server_address) {
    await logEmailEvent({
      recipient: to,
      subject,
      event_type: eventType,
      status: 'failed',
      error_message: 'SMTP settings not configured on server',
    });
    return { success: false, error: 'SMTP settings not configured on server' };
  }

  const plainPassword = settings.password_encrypted ? decryptSmtpPassword(settings.password_encrypted) : '';
  if (settings.password_required && !plainPassword) {
    await logEmailEvent({
      recipient: to,
      subject,
      event_type: eventType,
      status: 'failed',
      error_message: 'Stored SMTP password could not be decrypted or is empty',
    });
    return { success: false, error: 'Stored SMTP password could not be decrypted or is empty' };
  }

  const transportConfig: any = {
    host: settings.server_address,
    port: settings.port,
    secure: settings.port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  };

  if (settings.password_required && settings.username) {
    transportConfig.auth = {
      user: settings.username,
      pass: plainPassword,
    };
  }

  const transporter = nodemailer.createTransport(transportConfig);
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${settings.sender_name}" <${settings.sender_email}>`,
    to,
    subject,
    html,
    attachments,
    icalEvent: icalEvent ? {
      filename: icalEvent.filename || 'invite.ics',
      method: (icalEvent.method || 'request').toUpperCase(),
      content: icalEvent.content,
    } : undefined,
  };

  try {
    await transporter.sendMail(mailOptions);
    await logEmailEvent({
      recipient: to,
      subject,
      event_type: eventType,
      status: 'sent',
    });
    return { success: true };
  } catch (firstErr: any) {
    console.warn(`[SMTP Notification Retry] First attempt failed for ${to} (${eventType}): ${firstErr.message}. Retrying...`);
    try {
      await new Promise((r) => setTimeout(r, 500));
      await transporter.sendMail(mailOptions);
      await logEmailEvent({
        recipient: to,
        subject,
        event_type: eventType,
        status: 'sent',
      });
      return { success: true };
    } catch (retryErr: any) {
      console.error(`[SMTP Notification Fatal] Second attempt failed for ${to} (${eventType}):`, retryErr);
      const errMsg = retryErr.message || 'SMTP delivery failed after retry';
      await logEmailEvent({
        recipient: to,
        subject,
        event_type: eventType,
        status: 'failed',
        error_message: errMsg,
      });
      return { success: false, error: errMsg };
    }
  }
}
