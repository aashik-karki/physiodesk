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