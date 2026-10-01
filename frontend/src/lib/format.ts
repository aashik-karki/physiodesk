export const WEEKDAYS = [
  { value: 1, short: "Mon", letter: "Mo" },
  { value: 2, short: "Tue", letter: "Tu" },
  { value: 3, short: "Wed", letter: "We" },
  { value: 4, short: "Thu", letter: "Th" },
  { value: 5, short: "Fri", letter: "Fr" },
  { value: 6, short: "Sat", letter: "Sa" },
  { value: 7, short: "Sun", letter: "Su" },
];

/** "13:30:00" -> "1:30 PM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "Dr. Sita Sharma" -> "SS" (skips titles like Dr.) */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w && !w.endsWith("."))
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}



/** "2026-10-01T04:15:00Z" or "2026-10-01" -> "1 Oct 2026" */
export function formatDate(value: string): string {
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "15000.00" -> "Rs 15,000" (paisa shown only when non-zero) */
export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export const PATIENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
] as const;

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;



export const SESSION_TYPES = [
  { value: "assessment", label: "Assessment" },
  { value: "treatment", label: "Treatment" },
  { value: "follow_up", label: "Follow-up" },
] as const;

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "digital_wallet", label: "eSewa / Khalti" },
  { value: "package", label: "Prepaid package" },
] as const;

export function labelOf(list: readonly { value: string; label: string }[], value: string): string {
  return list.find((x) => x.value === value)?.label ?? value;
}

/** Local calendar date as "YYYY-MM-DD" (not UTC, which can be a day off). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** "2026-10-01" -> "Thursday, 1 October" */
export function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/** "09:30:00" -> 570 (minutes since midnight) */
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}