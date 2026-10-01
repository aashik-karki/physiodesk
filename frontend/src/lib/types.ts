export type Role = "admin" | "staff";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}


// ---- Therapists ---------------------------------------------------------
export interface Therapist {
  id: number;
  full_name: string;
  specialty: string;
  phone: string | null;
  email: string | null;
  working_days: number[]; // ISO weekdays: 1 = Mon ... 7 = Sun
  start_time: string;     // "09:00:00"
  end_time: string;
  slot_minutes: number;
  is_active: boolean;
  weekly_hours: number;
  patients_today: number;
  on_duty_today: boolean;
}

export interface TherapistInput {
  full_name: string;
  specialty: string;
  phone: string | null;
  email: string | null;
  working_days: number[];
  start_time: string;     // "09:00"
  end_time: string;
  slot_minutes: number;
}

export interface TherapistDeleted {
  id: number;
  cancelled_appointments: number;
}