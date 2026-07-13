/**
 * Formats cancellation reason with actual admin/receptionist attribution name & role.
 * Example: "[Cancelled by Rajesh Sharma (Admin)]: Meeting room deleted"
 */
export function formatAdminAttribution(sessionName: string, sessionRole: string, underlyingReason: string): string {
  let cleanedReason = underlyingReason.replace(/^\[ADMIN OVERRIDE\]:\s*/i, '').trim();
  if (/^\[Cancelled by .+\]:\s*/i.test(cleanedReason)) {
    return cleanedReason;
  }
  const roleLabel = sessionRole === 'admin' ? 'Admin' : sessionRole === 'receptionist' ? 'Receptionist' : sessionRole;
  const displayName = sessionName ? sessionName.trim() : 'Administrator';
  return `[Cancelled by ${displayName} (${roleLabel})]: ${cleanedReason}`;
}
