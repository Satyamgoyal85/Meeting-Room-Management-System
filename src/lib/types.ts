// ==========================================
// Dhanuka Agritech Ltd. (GHO Branch)
// Meeting Room Management System - Type Definitions
// ==========================================

export type Role = 'employee' | 'admin' | 'receptionist';
export type BookingStatus = 'confirmed' | 'cancelled';
export type InviteeStatus = 'invited';
export type AuditActionType = 
  | 'create_booking' 
  | 'cancel_booking' 
  | 'edit_booking' 
  | 'room_change' 
  | 'department_change'
  | 'employee_change'
  | 'account_locked'
  | 'password_reset'
  | 'bulk_import_employees'
  | 'smtp_settings_updated'
  | 'email_notification_sent'
  | 'email_notification_failed'
  | 'booking_cleanup_job';

export interface Department {
  id: string;
  name: string;
  is_restricted_default: boolean;
  created_at: string;
}

export interface Amenity {
  id: string;
  name: string; // e.g. Projector, Video Conferencing
  icon: string; // e.g. Projector, Video, Edit3, Wind, Tv, Armchair, Volume2, Sparkles, Wifi, Coffee, Monitor
  created_at?: string;
}

export interface Employee {
  id: string;
  auth_user_id: string | null;
  employee_id: string; // e.g. ECN-1023
  name: string;
  email?: string; // e.g. vikram.sharma@dhanuka.com
  initial_password?: string; // e.g. vikr1023 — only used in local dev mock mode, never stored in Supabase
  department_id: string | null;
  role: Role;
  is_active: boolean;
  /** True when consecutive failed login attempts reach 5 or more; cleared by admin password reset */
  is_locked?: boolean;
  /** True only for newly-created employees until they complete their first-login password reset */
  must_reset_password: boolean;
  /** Tracks consecutive failed login attempts; resets to 0 on any successful login */
  failed_login_attempts: number;
  created_at: string;
  // Joined fields
  department?: Department;
}

export interface Room {
  id: string;
  name: string; // e.g. Room 5 - Falcon
  floor: string;
  capacity: number;
  amenities: string[]; // JSONB array decoded
  is_active: boolean;
  restricted_to_department_id: string | null;
  /** Internal phone extension number (optional, e.g. "204", "0-201") */
  extension_no?: string | null;
  created_at: string;
  // Joined fields
  restricted_department?: Department;
}

export interface Booking {
  id: string;
  room_id: string;
  employee_id: string;
  department_id: string;
  agenda: string; // Restricted: visible only to admin or booking owner
  start_time: string;
  end_time: string;
  status: BookingStatus;
  cancelled_by: string | null;
  cancel_reason: string | null;
  series_id?: string | null;
  is_recurring?: boolean;
  created_at: string;
  // Joined fields
  room?: Room;
  employee?: Employee;
  department?: Department;
  canceller?: Employee;
}

export interface BookingInvitee {
  id: string;
  booking_id: string;
  employee_id: string;
  status: InviteeStatus;
  created_at: string;
  // Joined
  employee?: Employee;
}

export interface AuditLog {
  id: string;
  action_type: AuditActionType;
  performed_by: string | null;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
  // Joined fields
  performer?: Employee;
}

export interface SmtpSettings {
  server_address: string;
  port: number;
  username: string;
  password_encrypted?: string;
  password_required: boolean;
  sender_email: string;
  sender_name: string;
  is_configured: boolean;
  updated_at?: string;
  updated_by?: string;
}

export interface EmailLogEntry {
  id: string;
  recipient: string;
  subject: string;
  event_type: string;
  status: 'sent' | 'failed';
  error_message?: string;
  created_at: string;
}

export interface UsageStat {
  id: string;
  room_id: string;
  department_id: string | null;
  period_start: string; // YYYY-MM-DD
  period_type: 'weekly' | 'monthly';
  booking_count: number;
  total_hours_booked: number;
  updated_at?: string;
  // Joined fields
  room?: Room;
  department?: Department;
}

export interface CleanupJobLog {
  id: string;
  job_name: string;
  status: 'running' | 'success' | 'failed' | 'completed_with_errors';
  started_at: string;
  completed_at?: string | null;
  records_aggregated: number;
  records_deleted: number;
  usage_stats_pruned: number;
  audit_logs_pruned?: number;
  error_message?: string | null;
  details?: Record<string, any>;
}

// Database Schema Interface for Supabase Client
export interface Database {
  public: {
    Tables: {
      amenities: {
        Row: Amenity;
        Insert: Omit<Amenity, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Amenity>;
      };
      departments: {
        Row: Department;
        Insert: Omit<Department, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Department>;
      };
      employees: {
        Row: Employee;
        Insert: Omit<Employee, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Employee>;
      };
      rooms: {
        Row: Room;
        Insert: Omit<Room, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Room>;
      };
      bookings: {
        Row: Booking;
        Insert: Omit<Booking, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Booking>;
      };
      audit_log: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<AuditLog>;
      };
      usage_stats: {
        Row: UsageStat;
        Insert: Omit<UsageStat, 'id' | 'updated_at'> & { id?: string; updated_at?: string };
        Update: Partial<UsageStat>;
      };
      cleanup_job_logs: {
        Row: CleanupJobLog;
        Insert: Omit<CleanupJobLog, 'id' | 'started_at'> & { id?: string; started_at?: string };
        Update: Partial<CleanupJobLog>;
      };
    };
    Views: {
      v_bookings_public: {
        Row: Booking;
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      current_employee_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_department_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
  };
}
