import Link from "next/link";
import { formatTime, initials } from "@/lib/format";
import type { TherapistDay } from "@/lib/types";

/** One meter per therapist: how much of today's bookable time is taken. */
export function CapacityList({ days }: { days: TherapistDay[] }) {
  return (
    <ul className="divide-y divide-border">
      {days.map((d) => {
        const total = d.slots.filter((s) => !s.out_of_hours).length;
        const booked = d.booked_count;
        const pct = total ? Math.round((Math.min(booked, total) / total) * 100) : 0;
        return (
          <li key={d.therapist.id} className="flex items-center gap-4 px-5 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
              {initials(d.therapist.full_name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium text-ink">{d.therapist.full_name}</p>
                <p className="shrink-0 text-xs text-muted">
                  <span className="font-mono text-ink">{booked}</span>/<span className="font-mono">{total}</span> booked ·{" "}
                  <span className="font-mono text-ink">{d.open_count}</span> open
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas" role="meter" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={pct} aria-label={`${d.therapist.full_name}: ${pct}% booked`} title={`${pct}% booked`}>
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-muted">
                {formatTime(d.start_time!)} – {formatTime(d.end_time!)}
                {d.has_override && <span className="ml-1.5 rounded bg-primary-soft px-1.5 font-sans text-[10px] text-primary-ink">custom hours</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function UpNext({ days, now }: { days: TherapistDay[]; now: string }) {
  const upcoming = days
    .flatMap((d) => d.slots
      .filter((s) => s.appointment?.status === "booked" && s.end > now)
      .map((s) => ({ ...s, therapist: d.therapist.full_name })))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6);

  if (!upcoming.length) return <p className="px-5 py-10 text-center text-sm text-muted">No more appointments today.</p>;

  return (
    <ul className="divide-y divide-border">
      {upcoming.map((s) => (
        <li key={`${s.therapist}-${s.start}`}>
          <Link href={`/patients/${s.appointment!.patient_id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-canvas/70">
            <span className="w-16 shrink-0 font-mono text-sm font-medium text-ink">{formatTime(s.start)}</span>
            <span className="h-8 w-0.5 rounded-full bg-primary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{s.appointment!.patient_name}</p>
              <p className="truncate text-xs text-muted">with {s.therapist}</p>
            </div>
            {s.start <= now && <span className="ml-auto rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">In session</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}