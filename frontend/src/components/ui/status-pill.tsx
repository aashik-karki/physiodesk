import { cn } from "@/lib/cn";

type Tone = "success" | "danger" | "info";

// Brief: Success = paid/active/booked, Error = overdue/cancelled, Neutral = pending/on-hold.
const TONE_BY_STATUS: Record<string, Tone> = {
  active: "success", paid: "success", booked: "success", completed: "success",
  cancelled: "danger", void: "danger", no_show: "danger", overdue: "danger",
  on_hold: "info", due: "info", pending: "info",
  on_duty: "success", off_today: "info",
};

const TONES: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function StatusPill({ status }: { status: string }) {
  const tone = TONE_BY_STATUS[status] ?? "info";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}