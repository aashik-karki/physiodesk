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