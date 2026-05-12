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
