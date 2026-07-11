/**
 * Standard HTML email template generator with Dhanuka Agritech branding and responsive layout.
 */
function wrapDhanukaEmailTemplate(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #10b981; }
    .header-title { color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .header-sub { color: #10b981; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; display: block; }
    .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #334155; }
    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .card-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
    .card-row:last-child { border-bottom: none; }
    .card-label { font-weight: 600; color: #64748b; font-size: 13px; }
    .card-value { font-weight: 700; color: #0f172a; font-size: 14px; text-align: right; }
    .btn { display: inline-block; background-color: #10b981; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px; margin: 20px 0; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.25); }
    .btn:hover { background-color: #059669; }
    .footer { background-color: #f1f5f9; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="header-title">Dhanuka Agritech Ltd.</h1>
        <span class="header-sub">Meeting Room Portal • GHO Branch</span>
      </div>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p style="margin: 0;">This is an automated notification from the Dhanuka Meeting Room Booking System.</p>
      <p style="margin: 4px 0 0;">Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

export function getTestEmailHtml(recipient: string): string {
  return wrapDhanukaEmailTemplate(
    'SMTP Configuration Test',
    `<h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">✅ SMTP Configuration Verified</h2>
     <p>Hello Admin,</p>
     <p>Your SMTP email gateway settings have been verified successfully. The system can now securely transmit automated email notifications to employees and administrators.</p>
     <div class="card">
       <div class="card-row">
         <span class="card-label">Test Recipient</span>
         <span class="card-value">${recipient}</span>
       </div>
       <div class="card-row">
         <span class="card-label">Status</span>
         <span class="card-value" style="color: #10b981;">Connected & Operational</span>
       </div>
       <div class="card-row">
         <span class="card-label">Timestamp</span>
         <span class="card-value">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
       </div>
     </div>
     <p style="font-size: 13px; color: #64748b;">You can now safely save your SMTP settings in the Admin Dashboard.</p>`
  );
}

export function getNewEmployeeEmailHtml(name: string, employeeId: string, loginUrl: string): string {
  return wrapDhanukaEmailTemplate(
    'Welcome to Dhanuka Meeting Portal',
    `<h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">Welcome, ${name}!</h2>
     <p>An employee account has been created for you on the <strong>Dhanuka Agritech Meeting Room Portal (GHO Branch)</strong>.</p>
     <div class="card">
       <div class="card-row">
         <span class="card-label">Employee Name</span>
         <span class="card-value">${name}</span>
       </div>
       <div class="card-row">
         <span class="card-label">Employee ID</span>
         <span class="card-value" style="font-family: monospace;">${employeeId}</span>
       </div>
       <div class="card-row">
         <span class="card-label">Initial Password</span>
         <span class="card-value" style="color: #64748b;">Provided directly by your Administrator</span>
       </div>
     </div>
     <p style="background-color: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 12px; border-radius: 8px; font-size: 13px;">
       🔒 <strong>Security Note:</strong> For maximum security, your initial password is not transmitted via email. Please contact your system administrator or HR manager for your initial temporary password. You will be prompted to set a new permanent password immediately upon first login.
     </p>
     <div style="text-align: center;">
       <a href="${loginUrl}" class="btn">Access Meeting Portal</a>
     </div>`
  );
}

export function getPasswordResetLinkEmailHtml(name: string, resetUrl: string): string {
  return wrapDhanukaEmailTemplate(
    'Secure Password Reset Request',
    `<h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">Password Reset Requested</h2>
     <p>Hello ${name},</p>
     <p>Your system administrator has initiated a secure one-time password reset link for your account on the Dhanuka Meeting Room Portal.</p>
     <div style="text-align: center;">
       <a href="${resetUrl}" class="btn">Reset My Password Now</a>
     </div>
     <p style="font-size: 13px; color: #64748b; word-break: break-all;">
       If the button above does not work, copy and paste this URL directly into your browser:<br/>
       <strong style="color: #334155;">${resetUrl}</strong>
     </p>
     <p style="background-color: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 8px; font-size: 13px; margin-top: 20px;">
       ⚠️ <strong>Single-Use Security Notice:</strong> This reset link is single-use and will expire automatically after 24 hours. If you did not request this password reset, please notify your administrator immediately.
     </p>`
  );
}

export function getBookingConfirmedEmailHtml(data: {
  bookerName: string;
  roomName: string;
  dateStr: string;
  timeStr: string;
  purpose?: string;
}): string {
  return wrapDhanukaEmailTemplate(
    'Meeting Room Booking Confirmed',
    `<h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">📅 Booking Confirmed</h2>
     <p>Hello ${data.bookerName},</p>
     <p>Your meeting room reservation has been successfully booked and confirmed on the Dhanuka portal.</p>
     <div class="card">
       <div class="card-row">
         <span class="card-label">Meeting Room</span>
         <span class="card-value">${data.roomName}</span>
       </div>
       <div class="card-row">
         <span class="card-label">Date</span>
         <span class="card-value">${data.dateStr}</span>
       </div>
       <div class="card-row">
         <span class="card-label">Time Slot</span>
         <span class="card-value">${data.timeStr}</span>
       </div>
       ${data.purpose ? `
       <div class="card-row">
         <span class="card-label">Purpose / Subject</span>
         <span class="card-value">${data.purpose}</span>
       </div>` : ''}
     </div>
     <p style="font-size: 13px; color: #64748b;">Please ensure the room is left clean and turned off after your scheduled meeting ends.</p>`
  );
}

export function getBookingCancelledEmailHtml(data: {
  bookerName: string;
  roomName: string;
  dateStr: string;
  timeStr: string;
  reason?: string;
  cancelledByAdminName?: string;
}): string {
  return wrapDhanukaEmailTemplate(
    'Meeting Room Booking Cancelled',
    `<h2 style="margin-top: 0; color: #dc2626; font-size: 18px;">❌ Booking Cancelled</h2>
     <p>Hello ${data.bookerName},</p>
     <p>Your scheduled meeting room reservation has been cancelled${data.cancelledByAdminName ? ` by administrator <strong>${data.cancelledByAdminName}</strong>` : ''}.</p>
     <div class="card">
       <div class="card-row">
         <span class="card-label">Meeting Room</span>
         <span class="card-value">${data.roomName}</span>
       </div>
       <div class="card-row">
         <span class="card-label">Date & Time</span>
         <span class="card-value">${data.dateStr} (${data.timeStr})</span>
       </div>
       ${data.reason ? `
       <div class="card-row">
         <span class="card-label">Cancellation Reason</span>
         <span class="card-value" style="color: #dc2626;">${data.reason}</span>
       </div>` : ''}
     </div>
     <p style="font-size: 13px; color: #64748b;">If you have questions regarding this cancellation, please contact your administrative team.</p>`
  );
}

export function getAccountLockedEmailHtml(data: {
  employeeName: string;
  employeeId: string;
  email: string;
}): string {
  return wrapDhanukaEmailTemplate(
    'Security Alert: Employee Account Locked',
    `<h2 style="margin-top: 0; color: #dc2626; font-size: 18px;">🚨 Security Alert: Account Locked</h2>
     <p>Hello Administrator,</p>
     <p>An employee account has been automatically locked after exceeding 5 consecutive failed login attempts.</p>
     <div class="card">
       <div class="card-row">
         <span class="card-label">Employee Name</span>
         <span class="card-value">${data.employeeName}</span>
       </div>
       <div class="card-row">
         <span class="card-label">Employee ID</span>
         <span class="card-value" style="font-family: monospace;">${data.employeeId}</span>
       </div>
       <div class="card-row">
         <span class="card-label">Email Address</span>
         <span class="card-value">${data.email || 'N/A'}</span>
       </div>
       <div class="card-row">
         <span class="card-label">Locked At</span>
         <span class="card-value">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
       </div>
     </div>
     <p style="font-size: 13px; color: #64748b;">You can unlock this account by navigating to the Employee Directory and triggering a secure Password Reset or toggling their active status.</p>`
  );
}

export function getBulkImportCompletedEmailHtml(data: {
  adminName: string;
  successCount: number;
  skippedCount: number;
}): string {
  return wrapDhanukaEmailTemplate(
    'Bulk Employee Import Completed',
    `<h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">📥 Bulk Import Summary</h2>
     <p>Hello ${data.adminName},</p>
     <p>Your bulk employee import batch has finished processing on the Dhanuka portal.</p>
     <div class="card">
       <div class="card-row">
         <span class="card-label">Successfully Created</span>
         <span class="card-value" style="color: #10b981;">${data.successCount} employee records</span>
       </div>
       <div class="card-row">
         <span class="card-label">Skipped / Errors</span>
         <span class="card-value" style="color: ${data.skippedCount > 0 ? '#dc2626' : '#64748b'};">${data.skippedCount} records</span>
       </div>
       <div class="card-row">
         <span class="card-label">Processed At</span>
         <span class="card-value">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
       </div>
     </div>
     <p style="font-size: 13px; color: #64748b;">Please download the full onboarding report from the Admin Dashboard to distribute generated initial passwords securely.</p>`
  );
}
