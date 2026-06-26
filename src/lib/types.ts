// Core domain types — shared across modules.

export type UUID = string;
export type ISO = string;

export interface Customer {
  id: UUID;
  name: string;
  study: string | null;
  phone: string;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
}

export interface Room {
  id: UUID;
  name: string;
  description: string | null;
  capacity: number;
  hourly_prices: { hour: number; price: number }[];
  label_color: string;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
}

export type ItemCategory = "Snack" | "Drink" | "Product" | "Service";
export interface Item {
  id: UUID;
  name: string;
  price: number;
  category: ItemCategory;
  stock: number;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
}

export interface Plan {
  id: UUID;
  name: string;
  description: string | null;
  letter: string;
  hours: number;
  price: number;
  available_seats: number;
  expiration_days: number;
  label_color: string;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
}

export interface Subscriber {
  id: UUID;
  code: string;
  name: string;
  phone: string;
  plan_id: UUID;
  payment_method: string;
  total_price: number;
  total_hours: number;
  hours_remaining: number;
  starts_at: ISO;
  expires_at: ISO;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
  plan?: Plan;
}

export interface SessionSegment {
  room_id: string;
  room_name: string;
  started_at: ISO;
  ended_at: ISO;
  duration_minutes: number;
  price: number;
}

export type SessionStatus = "active" | "closed";
export interface Session {
  id: UUID;
  customer_id: UUID | null;
  subscriber_id: UUID | null;
  room_id: UUID;
  started_at: ISO;
  ended_at: ISO | null;
  duration_minutes: number | null;
  session_price: number;
  status: SessionStatus;
  session_segments: SessionSegment[];
  next_session_note: string | null;
  created_by: string;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
  customer?: Customer;
  subscriber?: Subscriber;
  room?: Room;
}

export interface SessionOrder {
  id: UUID;
  session_id: UUID;
  item_id: UUID;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: ISO;
  deleted_at: ISO | null;
}

export type InvoiceKind = "session" | "subscription";
export interface Invoice {
  id: UUID;
  kind: InvoiceKind;
  session_id: UUID | null;
  subscriber_id: UUID | null;
  customer_name: string | null;
  items: { name: string; qty: number; price: number; total: number }[];
  session_amount: number;
  orders_amount: number;
  total_amount: number;
  payment_method: string;
  created_by: string;
  issued_at: ISO;
  deleted_at: ISO | null;
}

export type StaffRole = "admin" | "staff";
export interface StaffMember {
  id: UUID;
  user_id: UUID;
  email: string;
  name: string;
  role: StaffRole;
  phone: string | null;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
}

export type AccessRequestStatus = "pending" | "approved" | "declined";
export interface AccessRequest {
  id: UUID;
  email: string;
  name: string;
  password_hash: string;
  phone: string | null;
  status: AccessRequestStatus;
  requested_at: ISO;
  reviewed_at: ISO | null;
  reviewed_by: UUID | null;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
}

export interface PageAccess {
  id: UUID;
  staff_id: UUID;
  page_path: string;
  created_at: ISO;
}

// ── Finance ───────────────────────────────────────────────────────────────────

export interface Expense {
  id: UUID;
  name: string;
  reason: string | null;
  amount: number;
  payment_method: string;
  payment_due: ISO;
  created_by: string;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
}

export interface Income {
  id: UUID;
  name: string;
  reason: string | null;
  amount: number;
  payment_method: string;
  payment_due: ISO;
  created_by: string;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type TaskStatus = "not_done" | "done" | "scheduled";

export interface Task {
  id: UUID;
  content: string;
  created_by: UUID;
  status: TaskStatus;
  alert_at: ISO | null;
  pin_enabled: boolean;
  pin_time: string | null; // 'HH:MM:SS' clock time, applies daily
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;

  creator?: StaffMember;
  assignments?: TaskAssignment[];
}

export interface TaskAssignment {
  id: UUID;
  task_id: UUID;
  assignee_id: UUID;
  done_at: ISO | null;
  last_done_date: string | null; // 'YYYY-MM-DD'
  created_at: ISO;

  assignee?: StaffMember;
  task?: Task;
}

// ── Attendance ────────────────────────────────────────────────────────────────

export interface AttendanceEntry {
  id: UUID;
  sign_name: string;
  check_in: ISO;
  check_out: ISO | null;
  bank_in: number | null;
  bank_out: number | null;
  created_by: UUID | null;
  created_at: ISO;
  updated_at: ISO;
  deleted_at: ISO | null;
}

export interface DeleteLogEntry {
  id: UUID;
  entity_type: string;
  entity_id: UUID;
  entity_label: string | null;
  entity_amount: number | null;
  snapshot: unknown;
  deleted_by: string;
  deleted_at: ISO;
}
