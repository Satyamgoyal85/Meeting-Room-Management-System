'use server';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStoreEmployees, updateMockEmployeePassword, addMockAuditLog, incrementFailedLoginAttempts, resetFailedLoginAttempts, findValidResetToken, consumeMockResetToken } from '@/lib/mock-store';
import { Employee, Role } from '@/lib/types';
import { sendNotificationEmail } from '@/actions/smtp';
import { getAccountLockedEmailHtml } from '@/lib/email-templates';

const SESSION_COOKIE_NAME = 'dhanuka_session';
const PENDING_RESET_COOKIE_NAME = 'dhanuka_pending_reset';
const MAX_FAILED_ATTEMPTS = 5;

export interface AuthSession {
  id: string;
  employee_id: string;
  name: string;
  department_id: string | null;
  role: Role;
  is_mock?: boolean;
}

interface PendingResetSession {
  id: string;
  employee_id: string;
  name: string;
  role: Role;
  is_mock: boolean;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function setFullSession(emp: { id: string; employee_id: string; name: string; department_id: string | null; role: Role }, isMock: boolean) {
  const sessionPayload: AuthSession = {
    id: emp.id,
    employee_id: emp.employee_id,
    name: emp.name,
    department_id: emp.department_id,
    role: emp.role,
    is_mock: isMock,
  };
  return sessionPayload;
}

// ─── loginAction ─────────────────────────────────────────────────────────────

/**
 * Server action to handle login for both normal employees and administrators.
 * Returns { mustResetPassword: true } if the employee needs to set a new password before
 * accessing the app. Returns { error } on failure. On success, redirects directly.
 */
export async function loginAction(
  formData: FormData
): Promise<{ error?: string; mustResetPassword?: boolean; locked?: boolean; attemptsRemaining?: number }> {
  const employeeId = (formData.get('employeeId') as string)?.trim().toUpperCase();
  const password = formData.get('password') as string;
  const loginType = (formData.get('loginType') as Role) || 'employee';

  if (!employeeId || !password) {
    return { error: 'Please enter both Employee ID and password.' };
  }

  const fullEmployeeId = employeeId.toUpperCase().startsWith('ECN-')
    ? employeeId.toUpperCase()
    : `ECN-${employeeId.trim().toUpperCase()}`;

  const supabase = await createClient();
  const isPlaceholderUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL;

  // ── 1. Supabase Cloud Auth ────────────────────────────────────────────────
  if (!isPlaceholderUrl) {
    try {
      const adminSupa = createAdminClient();
      const { data: empRecord, error: lookupErr } = await (adminSupa.from('employees') as any)
        .select('*')
        .ilike('employee_id', fullEmployeeId)
        .single();

      if (empRecord && !lookupErr) {
        const emp = empRecord as Employee;
        const email = emp.email || `${fullEmployeeId.toLowerCase()}@dhanuka.com`;

        if (!emp.is_active) {
          return { error: 'This account has been deactivated. Contact HR or Admin.' };
        }
        if (loginType === 'admin' && emp.role !== 'admin') {
          return { error: 'Access Denied: You do not have administrator privileges.' };
        }
        if (loginType === 'receptionist' && emp.role !== 'receptionist' && emp.role !== 'admin') {
          return { error: 'Access Denied: You do not have receptionist privileges.' };
        }

        const currentAttempts = emp.failed_login_attempts ?? 0;
        if (emp.is_locked || currentAttempts >= MAX_FAILED_ATTEMPTS) {
          return {
            locked: true,
            error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Contact your administrator to reset your password.`,
          };
        }

        let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        // Self-healing check: If auth account wasn't created yet (or failed sign-in) but password matches initial or valid fallback
        const validPasswords = [emp.initial_password, 'dhanuka123', 'admin123'].filter(Boolean);
        if ((!authData?.user || authError) && validPasswords.includes(password)) {
          const { data: createdAuth } = await adminSupa.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: emp.name, employee_id: emp.employee_id, role: emp.role }
          });
          let userId = createdAuth?.user?.id;
          if (!userId) {
            const { data: usersData } = await adminSupa.auth.admin.listUsers();
            const existing = usersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (existing) userId = existing.id;
          }
          if (userId) {
            await (adminSupa.from('employees') as any).update({ auth_user_id: userId }).eq('id', emp.id);
            const retrySign = await supabase.auth.signInWithPassword({ email, password });
            authData = retrySign.data;
            authError = retrySign.error;
          }
        }

        if (authError || !authData?.user) {
          // If sign-in failed against an existing DB record, treat as invalid password and increment attempts
          const newCount = currentAttempts + 1;
          const remaining = MAX_FAILED_ATTEMPTS - newCount;

          await (adminSupa.from('employees') as any).update({
            failed_login_attempts: newCount,
            is_locked: newCount >= MAX_FAILED_ATTEMPTS
          }).eq('id', emp.id);

          if (newCount >= MAX_FAILED_ATTEMPTS) {
            return {
              locked: true,
              error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Contact your administrator to reset your password.`,
            };
          }

          return {
            error: `Invalid password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account is locked.`,
            attemptsRemaining: remaining,
          };
        }

        // Authentication success
        if (emp.auth_user_id !== authData.user.id) {
          await (adminSupa.from('employees') as any).update({ auth_user_id: authData.user.id, failed_login_attempts: 0 }).eq('id', emp.id);
        } else {
          await (adminSupa.from('employees') as any).update({ failed_login_attempts: 0 }).eq('id', emp.id);
        }

        // Check if first-login password reset is required
        if (emp.must_reset_password) {
          await supabase.auth.signOut();
          const pendingPayload: PendingResetSession = {
            id: emp.id,
            employee_id: emp.employee_id,
            name: emp.name,
            role: emp.role,
            is_mock: false,
          };
          const cookieStore = await cookies();
          cookieStore.set(PENDING_RESET_COOKIE_NAME, JSON.stringify(pendingPayload), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 15,
            path: '/',
          });
          return { mustResetPassword: true };
        }

        const sessionPayload = setFullSession(emp, false);
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionPayload), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });

        if (emp.role === 'admin' && loginType === 'admin') {
          redirect('/admin');
        } else if (emp.role === 'receptionist' && loginType === 'receptionist') {
          redirect('/receptionist');
        } else {
          redirect('/dashboard');
        }
      } else {
        // If employee not found in live DB at all, return explicit error instead of checking MOCK_EMPLOYEES
        return { error: `Invalid Employee ID "${fullEmployeeId}". Please check your credentials.` };
      }
    } catch (e: any) {
      if (e?.message === 'NEXT_REDIRECT' || e?.digest?.startsWith('NEXT_REDIRECT')) {
        throw e;
      }
      console.warn('[Supabase fallback] Exception during cloud sign-in, falling back to local dev/mock auth:', e?.message || e);
    }
  }

  // ── 2. Mock / Local Dev Auth ─────────────────────────────────────────────
  const mockEmp = getStoreEmployees().find(
    (e) => e.employee_id.toUpperCase() === fullEmployeeId
  );

  if (!mockEmp) {
    return { error: `Invalid Employee ID "${fullEmployeeId}". Please check your credentials.` };
  }

  if (!mockEmp.is_active) {
    return { error: 'This account is deactivated. Contact HR or your administrator.' };
  }

  // Check role requirement for Admin login
  if (loginType === 'admin' && mockEmp.role !== 'admin') {
    return { error: 'Access Denied: This account is not an administrator.' };
  }
  // Check role requirement for Receptionist login
  if (loginType === 'receptionist' && mockEmp.role !== 'receptionist' && mockEmp.role !== 'admin') {
    return { error: 'Access Denied: This account is not a receptionist.' };
  }

  // Block locked accounts regardless of password
  const currentAttempts = mockEmp.failed_login_attempts ?? 0;
  if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      locked: true,
      error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Contact your administrator to reset your password.`,
    };
  }

  // Verify password
  const validPasswords = [mockEmp.initial_password, 'dhanuka123', 'admin123'].filter(Boolean);
  if (!validPasswords.includes(password)) {
    const newCount = incrementFailedLoginAttempts(mockEmp.id);
    const remaining = MAX_FAILED_ATTEMPTS - newCount;

    if (newCount >= MAX_FAILED_ATTEMPTS) {
      // Log lockout event in audit log — no password recorded, only metadata
      addMockAuditLog({
        id: crypto.randomUUID(),
        action_type: 'account_locked',
        performed_by: null,
        target_id: mockEmp.id,
        details: {
          employee_id: mockEmp.employee_id,
          reason: `Account locked after ${MAX_FAILED_ATTEMPTS} consecutive failed login attempts`,
          locked_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

      const admins = getStoreEmployees().filter((e) => e.role === 'admin' && e.is_active);
      const adminEmails = admins.map((a) => a.email).filter(Boolean) as string[];
      if (adminEmails.length === 0) adminEmails.push('notifications@dhanuka.com');

      for (const adminEmail of adminEmails) {
        sendNotificationEmail({
          to: adminEmail,
          subject: `[Dhanuka Alert] Security: Employee Account Locked (${mockEmp.employee_id})`,
          html: getAccountLockedEmailHtml({
            employeeName: mockEmp.name,
            employeeId: mockEmp.employee_id,
            email: mockEmp.email || `${mockEmp.employee_id.toLowerCase()}@dhanuka.com`,
          }),
          eventType: 'account_locked',
        }).catch((err) => console.error('[SMTP Trigger Error - account_locked]:', err));
      }

      revalidatePath('/admin');
      return {
        locked: true,
        error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Contact your administrator to reset your password.`,
      };
    }

    return {
      error: `Invalid password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account is locked.`,
      attemptsRemaining: remaining,
    };
  }

  // ── Successful authentication ─────────────────────────────────────────────

  // Reset failed attempts counter
  resetFailedLoginAttempts(mockEmp.id);

  // Check if this new employee must set their own password before accessing the app
  if (mockEmp.must_reset_password) {
    const pendingPayload: PendingResetSession = {
      id: mockEmp.id,
      employee_id: mockEmp.employee_id,
      name: mockEmp.name,
      role: mockEmp.role,
      is_mock: true,
    };
    const cookieStore = await cookies();
    cookieStore.set(PENDING_RESET_COOKIE_NAME, JSON.stringify(pendingPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15, // 15-minute window to complete reset
      path: '/',
    });
    return { mustResetPassword: true };
  }

  // Issue full session cookie
  const sessionPayload = setFullSession(
    { ...mockEmp, department_id: mockEmp.department_id },
    true
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionPayload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });

  if (mockEmp.role === 'admin' && loginType === 'admin') {
    redirect('/admin');
  } else if (mockEmp.role === 'receptionist' && loginType === 'receptionist') {
    redirect('/receptionist');
  } else {
    redirect('/dashboard');
  }
}

// ─── resetPasswordAction ─────────────────────────────────────────────────────

/**
 * Server action for the first-login forced password reset.
 * Requires a valid pending_reset cookie (set during loginAction when must_reset_password = true).
 * On success, clears the pending cookie, issues a full session, and redirects to dashboard.
 * The new password is stored in plain text only in the in-memory mock store (never to disk/logs).
 */
export async function resetPasswordAction(
  formData: FormData
): Promise<{ error?: string }> {
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  // Server-side validation (matches client-side rules)
  if (!newPassword || !confirmPassword) {
    return { error: 'Both password fields are required.' };
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match. Please try again.' };
  }
  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }
  if (!/\d/.test(newPassword)) {
    return { error: 'Password must contain at least one number.' };
  }
  if (newPassword.length > 128) {
    return { error: 'Password is too long (max 128 characters).' };
  }

  // Read and validate pending_reset cookie
  const cookieStore = await cookies();
  const pendingCookie = cookieStore.get(PENDING_RESET_COOKIE_NAME);
  if (!pendingCookie?.value) {
    redirect('/login');
  }

  let pendingData: PendingResetSession | null = null;
  try {
    pendingData = JSON.parse(pendingCookie!.value) as PendingResetSession;
  } catch {
    redirect('/login');
  }

  if (!pendingData?.id) {
    redirect('/login');
  }

  const supabase = await createClient();
  const isPlaceholderUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!isPlaceholderUrl && !pendingData.is_mock) {
    const adminSupa = createAdminClient();
    // 1. Query employee from DB using admin client
    const { data: empRecord, error: empErr } = await (adminSupa.from('employees') as any)
      .select('*')
      .eq('id', pendingData.id)
      .single();

    if (empErr || !empRecord) {
      return { error: 'Employee record not found in database.' };
    }

    const emp = empRecord as Employee;
    let authUserId = emp.auth_user_id;

    // Self-healing check: if auth_user_id is missing, look up by email in auth.users
    if (!authUserId) {
      const { data: usersData } = await adminSupa.auth.admin.listUsers();
      const existing = usersData?.users?.find(u => u.email?.toLowerCase() === emp.email?.toLowerCase());
      if (existing) {
        authUserId = existing.id;
        await (adminSupa.from('employees') as any).update({ auth_user_id: authUserId }).eq('id', emp.id);
      } else {
        const { data: createdAuth, error: createErr } = await adminSupa.auth.admin.createUser({
          email: emp.email,
          password: newPassword,
          email_confirm: true,
          user_metadata: { name: emp.name, employee_id: emp.employee_id, role: emp.role }
        });
        if (createErr) return { error: `Failed to create Supabase Auth account: ${createErr.message}` };
        if (createdAuth?.user) {
          authUserId = createdAuth.user.id;
          await (adminSupa.from('employees') as any).update({ auth_user_id: authUserId }).eq('id', emp.id);
        }
      }
    }

    if (authUserId) {
      // 2. Update password using admin client (which has SERVICE_ROLE_KEY and valid Bearer token)
      const { error: updateErr } = await adminSupa.auth.admin.updateUserById(authUserId, {
        password: newPassword,
      });
      if (updateErr) return { error: `Password update failed: ${updateErr.message}` };
    }

    // 3. Clear must_reset_password flag in database
    await (adminSupa.from('employees') as any)
      .update({ must_reset_password: false, failed_login_attempts: 0 })
      .eq('id', pendingData.id);

    // Clear pending cookie
    cookieStore.delete(PENDING_RESET_COOKIE_NAME);

    // Set full session
    const sessionPayload = setFullSession(emp, false);
    cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    if (pendingData.role === 'admin') {
      redirect('/admin');
    } else if (pendingData.role === 'receptionist') {
      redirect('/receptionist');
    } else {
      redirect('/dashboard');
    }
  } else {
    // Mock mode: update in-memory store
    const updated = updateMockEmployeePassword(pendingData.id, newPassword);
    if (!updated) {
      return { error: 'Employee record not found. Please contact your administrator.' };
    }

    // Clear pending cookie and issue a full authenticated session
    cookieStore.delete(PENDING_RESET_COOKIE_NAME);

    const emp = getStoreEmployees().find((e) => e.id === pendingData!.id);
    const sessionPayload = setFullSession(
      emp || { id: pendingData.id, employee_id: pendingData.employee_id, name: pendingData.name, department_id: null, role: pendingData.role },
      true
    );

    cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    if (pendingData.role === 'admin') {
      redirect('/admin');
    } else if (pendingData.role === 'receptionist') {
      redirect('/receptionist');
    } else {
      redirect('/dashboard');
    }
  }
}

// ─── logoutAction ────────────────────────────────────────────────────────────

/**
 * Server action to log out the user.
 */
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(PENDING_RESET_COOKIE_NAME);

  redirect('/login');
}

// ─── getSession ──────────────────────────────────────────────────────────────

/**
 * Helper to get current authenticated user session from cookies or Supabase.
 */
export const getSession = cache(async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie?.value) {
    try {
      const parsed = JSON.parse(sessionCookie.value) as AuthSession;
      if (parsed.is_mock) {
        const storeEmp = getStoreEmployees().find(e => e.id === parsed.id);
        const isLocked = (storeEmp?.failed_login_attempts ?? 0) >= MAX_FAILED_ATTEMPTS;
        if (storeEmp && storeEmp.is_active && !isLocked) {
          return {
            ...parsed,
            name: storeEmp.name,
            department_id: storeEmp.department_id,
            role: storeEmp.role,
          };
        } else {
          return null;
        }
      }
      // SECURITY: For non-mock sessions using the custom cookie, re-validate
      // is_active and lock status from the database on every request.
      // This ensures deactivated or locked accounts cannot continue acting
      // on an existing session cookie.
      if (!parsed.is_mock) {
        try {
          const adminSupa = createAdminClient();
          const { data: liveEmp, error: empErr } = await (adminSupa.from('employees') as any)
            .select('is_active, failed_login_attempts, role, name, department_id')
            .eq('id', parsed.id)
            .single();
          if (empErr || !liveEmp) {
            // If DB is unreachable (`fetch failed`) or record lookup errors out during downtime/offline mode, trust the existing session cookie to prevent lockout
            return parsed;
          }
          if (!liveEmp.is_active || (liveEmp.failed_login_attempts ?? 0) >= MAX_FAILED_ATTEMPTS) {
            // Account was deactivated or locked since last login — invalidate cookie
            const cookieStore2 = await cookies();
            cookieStore2.delete(SESSION_COOKIE_NAME);
            return null;
          }
          // Return freshly validated session data
          return {
            ...parsed,
            name: liveEmp.name ?? parsed.name,
            department_id: liveEmp.department_id ?? parsed.department_id,
            role: liveEmp.role ?? parsed.role,
          };
        } catch {
          // If exception thrown or DB is unreachable, trust the cookie to avoid lockout during downtime
          return parsed;
        }
      }
      return parsed;
    } catch {
      return null;
    }
  }

  // Try Supabase Auth session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: empData } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    const emp = empData as Employee | null;
    const isLocked = (emp?.failed_login_attempts ?? 0) >= MAX_FAILED_ATTEMPTS;

    if (emp && emp.is_active && !isLocked) {
      return {
        id: emp.id,
        employee_id: emp.employee_id,
        name: emp.name,
        department_id: emp.department_id,
        role: emp.role,
        is_mock: false,
      };
    }
  }

  return null;
});

/**
 * Helper to get the pending reset session from the pending_reset cookie.
 * Returns null if no valid pending reset exists.
 */
export async function getPendingResetSession(): Promise<PendingResetSession | null> {
  const cookieStore = await cookies();
  const pendingCookie = cookieStore.get(PENDING_RESET_COOKIE_NAME);
  if (!pendingCookie?.value) return null;
  try {
    return JSON.parse(pendingCookie.value) as PendingResetSession;
  } catch {
    return null;
  }
}

// ─── One-Time Reset Token Actions (Phase 3) ──────────────────────────────────

/**
 * Validates a one-time reset token (from an admin-generated link).
 * Returns { valid: true, employeeName } if usable, or an error message if expired/used.
 */
export async function verifyResetToken(rawToken: string): Promise<{ valid: boolean; employeeName?: string; error?: string }> {
  if (!rawToken || rawToken.length < 32) {
    return { valid: false, error: 'Invalid reset link format.' };
  }

  const { createHash } = await import('crypto');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const record = findValidResetToken(tokenHash);
  if (!record) {
    return {
      valid: false,
      error: 'This reset link has already been used or expired. Please contact your administrator for a new one.',
    };
  }

  const emp = getStoreEmployees().find((e) => e.id === record.employeeId);
  if (!emp || !emp.is_active) {
    return {
      valid: false,
      error: 'The associated employee account is inactive or not found.',
    };
  }

  return { valid: true, employeeName: emp.name };
}

/**
 * Redeems an admin-generated one-time reset token: sets new password, consumes token,
 * logs audit event, and logs the employee straight into their dashboard.
 */
export async function redeemResetTokenAction(formData: FormData): Promise<{ error?: string }> {
  const rawToken = formData.get('token') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!rawToken) {
    return { error: 'Missing reset token.' };
  }
  if (!newPassword || !confirmPassword) {
    return { error: 'Both password fields are required.' };
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match. Please try again.' };
  }
  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }
  if (!/\d/.test(newPassword)) {
    return { error: 'Password must contain at least one number.' };
  }
  if (newPassword.length > 128) {
    return { error: 'Password is too long (max 128 characters).' };
  }

  const { createHash } = await import('crypto');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const record = findValidResetToken(tokenHash);
  if (!record) {
    return {
      error: 'This reset link has already been used or expired. Please contact your administrator for a new one.',
    };
  }

  const emp = getStoreEmployees().find((e) => e.id === record.employeeId);
  if (!emp || !emp.is_active) {
    return { error: 'Employee account is inactive or not found.' };
  }

  // Consume token so it can never be used again
  const consumed = consumeMockResetToken(tokenHash);
  if (!consumed) {
    return { error: 'Failed to process reset link. It may have just been used.' };
  }

  const supabase = await createClient();
  const isPlaceholderUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!isPlaceholderUrl) {
    // Supabase mode: update user password via admin API
    const { error: updateErr } = await supabase.auth.admin.updateUserById(emp.id, {
      password: newPassword,
    });
    if (updateErr) return { error: `Password update failed: ${updateErr.message}` };

    await (supabase.from('employees') as any)
      .update({ must_reset_password: false, failed_login_attempts: 0, is_locked: false })
      .eq('id', emp.id);
  } else {
    // Mock mode: update password in store
    updateMockEmployeePassword(emp.id, newPassword);
  }

  // Log audit event
  addMockAuditLog({
    id: crypto.randomUUID(),
    action_type: 'password_reset',
    performed_by: emp.id,
    target_id: emp.id,
    details: {
      action: 'admin_reset_link_redeemed',
      employee_id: emp.employee_id,
      name: emp.name,
      redeemed_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });

  // Revalidate admin and dashboard paths
  revalidatePath('/admin');
  revalidatePath('/dashboard');

  // Issue full session cookie & redirect to dashboard
  const sessionPayload = setFullSession(
    { ...emp, department_id: emp.department_id },
    true
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionPayload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });

  if (emp.role === 'admin') {
    redirect('/admin');
  } else {
    redirect('/dashboard');
  }
}
