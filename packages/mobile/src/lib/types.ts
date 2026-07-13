export interface UserSession {
  token: string;
  user: {
    id: string;
    businessId: string;
    email: string;
    role: string;
    name?: string | null;
  };
}

export interface JobRow {
  id: string;
  client_id: string;
  property_id: string;
  recurrence_rule_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: 'scheduled' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'skipped' | string;
  price_cents?: number | null;
  notes?: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface PropertyRow {
  id: string;
  client_id: string;
  name?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  postcode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  service_notes?: string | null;
}

export interface CachedJob extends JobRow {
  date_key: string;
  client_name: string;
  address: string;
  property?: PropertyRow;
  client?: ClientRow;
}

export interface ChecklistItem {
  id: string;
  label: string;
  sort_order?: number;
  requires_photo?: boolean;
  required?: boolean;
}

export interface ChecklistResult {
  id?: string;
  job_id: string;
  checklist_item_id: string;
  completed: boolean;
  completed_at?: string | null;
  photo_url?: string | null;
  client_generated_id?: string | null;
}

export interface EarningsSummary {
  cleaner_id: string;
  hours: number | string;
  hourly_earnings_cents: number;
  per_job_earnings_cents: number;
  total_earnings_cents: number;
}

export type QueueKind = 'clock-in' | 'clock-out' | 'checklist' | 'sos';
