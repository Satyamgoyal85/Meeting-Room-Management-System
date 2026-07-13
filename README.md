# Meeting Room Management System — Dhanuka Agritech Ltd. (GHO Branch)

An enterprise-grade, role-based meeting room reservation and resource management portal engineered specifically for **Dhanuka Agritech Ltd. (GHO Branch)**. Managing **14 conference rooms** across **10 departments** with dedicated **Employee** and **Administrator** roles, the system combines real-time conflict detection, granular resource scheduling, strict security masking, automated data retention, and seamless offline resilience.

---

## 🚀 Project Overview

The Dhanuka Meeting Room Management System streamlines workspace allocation across the GHO branch. It enforces corporate governance through mandatory meeting agendas, strict seating capacity compliance, recurrence conflict engines, mandatory cancellation audit workflows, encrypted SMTP email notifications, and automated data archiving.

### At a Glance:
- **Scope**: 14 Conference Spaces & Meeting Rooms | 10 Organizational Departments
- **Roles**: **Employee** (Self-service booking, calendar access, invitee awareness) | **Admin** (Master inventory CRUD, system configuration, unmasked audit view, bulk import, override capability)
- **Timezone & Operating Hours**: Standardized to Indian Standard Time (IST / UTC+5:30), supporting 15-minute booking slots from **08:00 AM to 08:00 PM** (`08:00`, `08:15`, ..., `19:45`, `20:00`).

---

## 🛠️ Technology Stack

- **Core Framework**: Next.js 16 (App Router, Server Actions, Server Components)
- **Language**: TypeScript (Strict Mode)
- **Styling & UI**: Vanilla CSS / Tailwind CSS (Glassmorphism, Dark Mode styling, smooth transitions, responsive layouts)
- **Database & Cloud**: Supabase (PostgreSQL, Row Level Security RLS, Realtime queries, Database Views & Cron Triggers)
- **Authentication**: Dual-layer Authentication combining custom ECN ECN-XXXX E-ID cookie sessions (`dhanuka_session`) with Supabase Cloud Auth (`@supabase/supabase-js`) and offline fallback.
- **Security & Cryptography**: Node.js `crypto` (`AES-256-GCM`) for at-rest encryption of SMTP credentials (`smtp-crypto.ts`).
- **Additional Libraries**: `lucide-react` (Icons), `date-fns` (Date/time formatting), CSV & Excel spreadsheet export utilities.

---

## ⭐ Core Features

### 1. Room Booking & Real-Time Conflict Detection
- **Granular 15-Minute Precision**: Bookings align precisely to 15-minute intervals.
- **Instant Conflict Prevention**: Detects existing reservations across target date/time ranges before submission.
- **Capacity Compliance Engine**: Validates attendee count against room seating capacity; alerts and blocks over-capacity bookings.
- **Department Exclusivity**: Rooms can be configured as `Open Access` or restricted exclusively to specific departments (e.g., Board Room exclusively for Board members; Innovation Lab for R&D).

### 2. Interactive Calendar & Resource Dashboards
- **Multi-View Resource Calendar**: Switch seamlessly between **Day View**, **Week View**, **Month View**, and **Resource Checklists** (`MiniCalendar`, `MonthView`, `ResourceView`).
- **My Bookings Management**: Dedicated portal for employees to view upcoming meetings, review past history, and process cancellations.

### 3. Attendee Invitations & Agenda Visibility Rules
- **Invite Attendees**: Search and invite individual colleagues or entire departments (`booking_invitees`).
- **Agenda Privacy Masking (`v_bookings_public`)**: To protect confidential discussions (R&D patents, HR reviews, Board strategy), non-attendees and non-admins see the meeting agenda automatically masked as `"Private Meeting"`. Organizers, invited attendees, and system administrators retain unmasked visibility.

### 4. Recurring Reservations & Dual Conflict Resolution
- Schedule `Daily`, `Weekly`, or `Monthly` recurring series for up to **24 occurrences (3 months max)**.
- **⚡ Skip Conflicting Dates & Book Open Slots (Recommended)**: Automatically skips individual conflicting dates while reserving all remaining open dates, generating a detailed summary report.
- **🛑 Fail Entire Series**: All-or-nothing check for interdependent briefings.

### 5. Mandatory Cancellation Audit Workflow
- Cancelling any confirmed booking requires submitting a **Mandatory Cancellation Reason** (minimum 3 characters, e.g., *"Client meeting rescheduled to Teams"*).
- Cancellation reasons are permanently logged in the audit trail.

### 6. Bulk Employee Import & CSV Management
- **Bulk CSV / Manual Entry**: Administrators can bulk-import employee rosters directly through the Admin Portal (`bulkImportEmployeesAction`), assigning employee IDs (`ECN-XXXX`), initial passwords, departments, and roles in a single atomic batch.
- **Export Analytics**: One-click export of utilization reports to Excel/CSV spreadsheets.

### 7. Encrypted SMTP Email Notifications
- **At-Rest AES-256-GCM Encryption**: SMTP passwords are encrypted using `SMTP_ENCRYPTION_KEY` before being stored in the `email_settings` database table.
- **Automated Dispatch**: Sends structured HTML email invitations, booking confirmations, and cancellation alerts (`email-templates.ts`). Includes an admin test dispatch feature (`AdminSmtpTab.tsx`).

### 8. Enterprise Password Reset & Account Lockout Flow
- **Forced First-Login Password Reset**: Flags new or imported accounts (`must_reset_password`), requiring users to set a secure password upon initial sign-in before accessing the dashboard.
- **Brute-Force Protection (Account Lockout)**: Automatically locks user accounts after **5 consecutive failed login attempts** (`failed_login_attempts`), recording an audit log event.
- **Admin One-Time Reset Links**: Administrators can generate secure, one-time password reset links (`/reset-password/token/[token]`) for locked or forgotten accounts.

### 9. Automated Data Retention & Cleanup Job
- Integrated PostgreSQL retention system (`retention_cleanup_system.sql` + `src/actions/cleanup.ts`) running automated background cleanup jobs to aggregate historical data and prune outdated tables.

### 10. Robust Offline & Network Fallback Resilience
- Server Actions (`getDashboardData`, `getAdminDashboardData`, `getMyBookingsAction`, etc.) are engineered with automatic query error interception.
- If Supabase cloud queries fail, experience network timeouts (`fetch failed`), or operate offline, the application seamlessly logs warning diagnostics and falls back to the persistent in-memory dev store (`mock-store.ts`), ensuring zero downtime or UI error overlays.

---

## 🗄️ Database Schema Summary

The application utilizes a structured PostgreSQL schema optimized for RLS security and speed:

| Table Name | Primary Purpose & Stored Fields |
| :--- | :--- |
| `rooms` | Stores room inventory (`id`, `name`, `capacity`, `location`, `amenities` array, `is_active`, `department_id` exclusivity). |
| `employees` | User credentials & profiles (`id`, `employee_id` e.g. ECN-1001, `name`, `email`, `role`, `department_id`, `is_active`, `failed_login_attempts`, `must_reset_password`, `auth_user_id`). |
| `departments` | Organizational units (`id`, `name`, `code` e.g. IT, R&D, Board, HR). |
| `bookings` | Primary reservation records (`id`, `room_id`, `employee_id`, `title`, `agenda`, `start_time`, `end_time` in UTC/IST, `status`, `recurrence_id`, `cancellation_reason`). |
| `booking_invitees` | Junction table linking bookings to invited employees and target departments (`booking_id`, `employee_id`, `department_id`). |
| `audit_log` / `booking_cancellation_logs` | Immutable audit trails recording cancellation workflows, account lockouts (`account_locked`), and admin overrides with timestamps (`performed_by`, `reason`). |
| `amenities` | Master list of available room equipment and tag bubbles (`Projector`, `Video Conferencing`, `AC`, `Sound System`, `Whiteboard`). |
| `email_settings` | SMTP configuration records (`smtp_host`, `smtp_port`, `smtp_user`, `sender_email`, and `smtp_password` encrypted ciphertext). |
| `usage_stats` | Aggregated historical analytics snapshots (`room_id`, `period_start`, `total_bookings`, `total_duration_minutes`, `cancellations_count`). |
| `cleanup_job_logs` | Execution history of automated background data cleanup runs (`started_at`, `completed_at`, `records_archived`, `status`). |

---

## 🔒 Admin-Only Areas (`/admin`)

The following sections are strictly restricted to users with the `admin` role:
- **System Overview & KPI Dashboard**: Live utilization metrics, room occupancy rates, and department booking charts (`AdminOverviewTab`).
- **Room Inventory Management**: Create new conference rooms, edit seating capacities, toggle maintenance status, and assign amenities (`AdminRoomsTab`).
- **Employee Roster & Bulk Import**: Manage staff profiles, promote/demote administrative privileges, unlock locked accounts, generate one-time password reset links, and bulk-import CSV rosters (`AdminEmployeesTab`).
- **Global Bookings Oversight**: View unmasked agendas across all departments and perform administrative override cancellations (`AdminBookingsTab`).
- **Amenity Tag Cloud Management**: Add, update, or remove master equipment tags (`AdminAmenitiesTab`).
- **Retention & System Reports**: Inspect historical usage statistics and automated database cleanup logs (`AdminReportsTab`).
- **SMTP Configuration & Diagnostics**: Configure encrypted SMTP server parameters and send test emails (`AdminSmtpTab`).

---

## 🔧 Common Maintenance Tasks

### How to Add a New Room
1. Log in with an **Admin** account and navigate to the **Admin Portal** (`/admin`).
2. Select the **Rooms** tab and click **"+ Add Room"**.
3. Enter the room name (e.g., *"Room 15 - Executive Suite"*), seating capacity, and location.
4. Select applicable equipment tags from the checkboxes (`Projector`, `Video Conferencing`, `AC`).
5. Choose whether the room is **Open Access** or restricted exclusively to a specific department. Click **Save**.

### How to Add / Manage Departments
1. Navigate to the **Admin Portal** (`/admin`).
2. Within the **Rooms** or **Employees** tab workflows, select **Manage Departments**.
3. Add the new department name and branch code. Once created, rooms and employees can immediately be assigned to it.

### How to Promote an Employee to Admin
1. Navigate to the **Admin Portal** (`/admin`) → **Employees** tab.
2. Search for the target employee using their name or `ECN-XXXX` ID.
3. Click **Edit** next to their profile or toggle their role selection from `Employee` to `Admin`.
4. Click **Update Employee**. The user immediately gains access to the `/admin` navigation tab.

---

## ⚙️ Setup Instructions & Local Development

### 1. Clone & Install
```bash
git clone https://github.com/Satyamgoyal85/Meeting-Room-Management-System.git
cd Meeting-Room-Management-System
npm install
```

### 2. Environment Variables Configuration (`.env.local`)
Create a `.env.local` file in the root directory. **Do not commit actual secrets or keys to version control.** List of required variable names:

```env
# Supabase Cloud Project Configuration (Found in Supabase Dashboard → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Privileged Service Role Key for Node.js Server Actions (NEVER expose to frontend)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Mandatory 32+ character random secret for AES-256-GCM SMTP password encryption at rest
# Generate one via terminal: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SMTP_ENCRYPTION_KEY=your-32-char-random-secret

# Application Public Base URL (for email reset links and redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **💡 Offline / Mock Store Note**: If `.env.local` is omitted or contains placeholder values (`placeholder-project.supabase.co`), the application automatically engages **Local Dev Mode (`mock-store.ts`)**. You can run, test, book, and administer the full application locally without an active internet or cloud database connection!

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## ⏳ Known Limitations & Data Retention Policy

To maintain high-performance queries and clean database sizing over multi-year corporate operations, the system enforces automated data retention policies via `retention_cleanup_system.sql`:

1. **7-Day Booking Detail Retention**: Detailed records of completed or cancelled bookings older than **7 days** are automatically aggregated into `usage_stats` and purged from the primary `bookings` table. Active/future bookings are never touched.
2. **6-Month Usage Summary Retention**: Aggregated historical utilization snapshots in `usage_stats` older than **6 months** are automatically pruned.
3. **1-Year Audit Log Retention**: Cancellation audit entries (`booking_cancellation_logs`), lockout logs, and system audit records older than **1 year** are permanently archived and cleared.

---
*Engineered for Dhanuka Agritech Ltd. • Meeting Room Management System (GHO Branch)*
