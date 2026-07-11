# Meeting Room Management System — Dhanuka Agritech Ltd. (GHO Branch)

An enterprise-grade, role-based meeting room reservation and management portal engineered for **Dhanuka Agritech Ltd. (GHO Branch)**. Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL)**, featuring sleek glassmorphism aesthetics, real-time capacity compliance, recurring schedules with automated conflict skipping, mandatory audit cancellation workflows, and comprehensive master admin oversight.

---

## 🌟 Key Architectural Features

### 1. 🛡️ Enterprise Security & Access Control (`proxy.ts` & RLS)
- **Next.js 16 Proxy Convention**: Adheres strictly to Next.js 16 architecture by utilizing `proxy.ts` (instead of deprecated `middleware.ts`) for zero-latency session verification and route protection.
- **Row-Level Security (RLS) & Agenda Masking**: To protect sensitive strategic discussions (e.g., Board meetings, R&D patent sprints), database views (`v_bookings_public`) automatically mask meeting agendas as `"Private Meeting"` for non-owners and non-admins, while granting administrators full oversight.
- **Department Exclusivity**: Rooms can be configured for `Open Access` or restricted exclusively to specific organizational units (e.g., Board Room restricted to Board members; Innovation Lab restricted to R&D).

### 2. 📅 Interactive Booking & 15-Minute Slot Precision
- **Granular Scheduling**: Supports exact 15-minute slot intervals across Dhanuka's operating hours from **08:00 AM to 08:00 PM** (`08:00`, `08:15`, `08:30`, ..., `19:45`, `20:00`).
- **Real-Time Capacity Compliance**: Continuously validates attendee count against room seating capacity. If attendees exceed seats, an inline warning banner alerts the user and prevents reservation submission.
- **Mandatory Agenda Enforcing**: Requires a descriptive meeting purpose (minimum 5 characters) for audit compliance.

### 3. 🔄 Recurring Reservations & Automated Conflict Resolution
- Employees can schedule recurring series (`Daily`, `Weekly`, or `Monthly`) for up to **24 occurrences (3 months max)**.
- **Dual Conflict Strategy Engine**:
  - **⚡ Skip Conflicting Dates & Book Open Slots (Recommended)**: If a recurring series encounters a date already booked by another department, the system automatically skips the conflict, reserves all remaining open dates, and returns a detailed report listing skipped dates.
  - **🛑 Fail Entire Series**: All-or-nothing mode for interdependent multi-part briefings.

### 4. 📋 Mandatory Cancellation Audit Workflow
- To prevent arbitrary room hoarding, cancelling any confirmed reservation requires submitting a **Mandatory Cancellation Reason** (at least 3 characters, e.g., `"Client meeting rescheduled"`, `"Moved to Microsoft Teams"`).
- Cancellation reasons are permanently recorded in the database audit log and displayed on cancelled records.

### 5. 👑 Master Admin Management & Reporting Portal (`/admin`)
- **Unmasked Agenda Oversight**: System Administrators see full meeting agendas across all departments for compliance auditing.
- **Admin Override Cancellation**: Admins can override and cancel any confirmed employee booking by providing a mandatory Admin Override Reason.
- **Room Inventory CRUD**: Add new conference spaces (e.g., `"Room 15 - Apex Suite"`), update seating capacities, configure amenity tag clouds (`Projector`, `Video Conferencing`, `AC`, `Sound System`), and set department exclusivity.
- **Utilization Analytics & Export**: Live KPI metric cards, department-wise booking distribution charts, and a **One-Click CSV Exporter** that downloads clean, Excel-compatible spreadsheets (`Dhanuka_GHO_Meeting_Room_Report_YYYY-MM-DD.csv`).

---

## 🛠️ Technology Stack
- **Framework**: Next.js 16.2.10 (App Router, Server Actions, Server Components)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS (Glassmorphism, Dark Mode, Micro-animations)
- **Database & Auth**: Supabase PostgreSQL (RLS Policies, Views, Cookie-based Auth)
- **Icons & Utilities**: Lucide React, date-fns

---

## 🚀 Getting Started & Local Development

### 1. Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### 2. Installation
```bash
# Clone repository and install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://placeholder-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
```
> **💡 Local Dev Mode Note**: The application is engineered with a **Persistent In-Memory Dev Store (`mock-store.ts`)**. If Supabase cloud credentials are set to placeholder or omitted, the application seamlessly falls back to Local Dev Mode. All bookings, cancellations, and room inventory edits created during testing persist across dev server reloads!

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Test Accounts (GHO Branch Seed Data)

Use any of the following pre-seeded employee credentials on the Login screen (`/login`):

| Employee Name | Employee Code | Department | Role | Password | Access Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ananya Verma** | `DAL-1001` | IT | Employee | `dhanuka123` | Can book Open/IT rooms; sees masked agendas for other depts |
| **Vikram Singh** | `DAL-1002` | R&D | Employee | `dhanuka123` | Can book Open/R&D rooms |
| **Priya Patel** | `DAL-1003` | Marketing | Employee | `dhanuka123` | Can book Open/Marketing rooms |
| **Suresh Kumar** | `DAL-1004` | Board | Employee | `dhanuka123` | Can book Open/Board rooms (e.g., Board Room) |
| **Rajesh Sharma** | `DAL-1000` | HR | **Admin** | `dhanuka123` | **Full Admin Portal Access**; unmasked agendas; inventory CRUD |

---

## 📦 Production Verification & Build
To verify type safety and compile optimized production bundles:
```bash
npm run build
```

---

## 📁 Project Structure Highlights
```text
Dhanuka/
├── src/
│   ├── actions/           # Server Actions (auth.ts, rooms.ts, bookings.ts, admin.ts)
│   ├── app/               # Next.js 16 App Router pages (/login, /dashboard, /dashboard/my-bookings, /admin)
│   ├── components/        # Modular UI components (booking/, admin/, rooms/, layout/)
│   ├── lib/               # Types, Supabase client utilities, and persistent dev store
│   └── proxy.ts           # Next.js 16 route protection & session verification
├── supabase/              # Database migrations (schema.sql, seed.sql)
└── public/                # Static assets & Dhanuka branding
```

---
*Engineered for Dhanuka Agritech Ltd. • Meeting Room Management System (GHO Branch)*
