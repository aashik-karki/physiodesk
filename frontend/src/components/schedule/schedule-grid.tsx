"use client";

import { AlertTriangle, CalendarOff, Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { SESSION_TYPES, formatTime, initials, labelOf, toMinutes } from "@/lib/format";
import type { DaySchedule, Slot, TherapistDay } from "@/lib/types";

const PX_PER_MIN = 1.6;        // 30 min = 48px, 60 min = 96px
const HEADER_H = "h-[104px]";  // same height on every column so the timelines line up

interface GridProps {
  day: DaySchedule;
  canManage: boolean;
  onBook: (therapistId: number, start: string) => void;
  onOpenAppointment: (id: number) => void;
  onEditHours: (therapist: { id: number; full_name: string }) => void;
}

export function ScheduleGrid({ day, canManage, onBook, onOpenAppointment, onEditHours }: GridProps) {
  // The visible time range covers every working therapist (and any booking outside hours).
  const times = day.therapists.flatMap((t) => [
    ...(t.start_time ? [toMinutes(t.start_time), toMinutes(t.end_time!)] : []),
    ...t.slots.flatMap((s) => [toMinutes(s.start), toMinutes(s.end)]),
  ]);
  const first = Math.floor(Math.min(...times, 9 * 60) / 60) * 60;
  const last = Math.ceil(Math.max(...times, 17 * 60) / 60) * 60;
  const height = (last - first) * PX_PER_MIN;
  const hours = Array.from({ length: (last - first) / 60 + 1 }, (_, i) => first + i * 60);

  return (
    <div className="flex overflow-x-auto pb-2">
      {/* Hour gutter */}
      <div className="sticky left-0 z-10 w-16 shrink-0 bg-canvas">
        <div className={HEADER_H} />
        <div className="relative" style={{ height }}>
          {hours.map((m) => (
            <span key={m} className="absolute right-3 -translate-y-1/2 font-mono text-[11px] text-muted" style={{ top: (m - first) * PX_PER_MIN }}>
              {formatTime(`${Math.floor(m / 60)}:00`).replace(":00 ", " ")}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        {day.therapists.map((t) => (
          <Column key={t.therapist.id} t={t} first={first} height={height} hours={hours}
            canManage={canManage} onBook={onBook} onOpenAppointment={onOpenAppointment} onEditHours={onEditHours} />
        ))}
      </div>
    </div>
  );
}

function Column({ t, first, height, hours, canManage, onBook, onOpenAppointment, onEditHours }:
  Omit<GridProps, "day"> & { t: TherapistDay; first: number; height: number; hours: number[] }) {
  return (
    <div className="w-60 shrink-0">
      <div className={cn(HEADER_H, "flex flex-col justify-between rounded-t-card border border-b-0 border-border bg-surface px-4 py-3")}>
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
            {initials(t.therapist.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{t.therapist.full_name}</p>
            <p className="truncate text-xs text-muted">{t.therapist.specialty}</p>
          </div>
          {canManage && t.therapist.is_active && (
            <button onClick={() => onEditHours(t.therapist)} title="Day off / custom hours" aria-label={`Adjust hours for ${t.therapist.full_name}`}
              className="rounded-md p-1 text-muted transition hover:bg-canvas hover:text-ink">
              <Settings2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {t.is_off ? (
          <p className="text-xs font-medium text-danger">Off this day</p>
        ) : (
          <div className="space-y-0.5 text-xs text-muted">
            <p className="font-mono">
              {formatTime(t.start_time!)} – {formatTime(t.end_time!)}
              {t.has_override && <span className="ml-1.5 rounded bg-primary-soft px-1.5 py-px font-sans text-[10px] text-primary-ink">custom</span>}
            </p>
            <p>
              <span className="font-mono text-ink">{t.booked_count}</span> booked ·{" "}
              <span className="font-mono text-ink">{t.open_count}</span> open
            </p>
          </div>
        )}
      </div>

      <div className="relative rounded-b-card border border-border bg-surface" style={{ height }}>
        {/* hour lines */}
        {hours.map((m) => (
          <div key={m} className="absolute inset-x-0 border-t border-border/70" style={{ top: (m - first) * PX_PER_MIN }} />
        ))}

        {/* outside working hours / day off */}
        {t.is_off ? (
          <div className="absolute inset-0 grid place-items-center rounded-b-card bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,var(--color-canvas)_8px,var(--color-canvas)_16px)]">
            <div className="rounded-lg bg-surface px-4 py-3 text-center shadow-card">
              <CalendarOff className="mx-auto h-5 w-5 text-danger" />
              <p className="mt-1 text-sm font-medium text-ink">Day off</p>
              {t.off_reason && <p className="text-xs text-muted">{t.off_reason}</p>}
            </div>
          </div>
        ) : (
          <>
            <OffHours top={0} bottom={(toMinutes(t.start_time!) - first) * PX_PER_MIN} />
            <OffHours top={(toMinutes(t.end_time!) - first) * PX_PER_MIN} bottom={height} />
          </>
        )}

        {t.slots.map((s) => (
          <SlotTile key={s.start} slot={s} first={first}
            onBook={() => onBook(t.therapist.id, s.start)}
            onOpen={() => s.appointment && onOpenAppointment(s.appointment.id)} />
        ))}
      </div>
    </div>
  );
}

function OffHours({ top, bottom }: { top: number; bottom: number }) {
  if (bottom <= top) return null;
  return <div className="absolute inset-x-0 bg-canvas/70" style={{ top, height: bottom - top }} aria-hidden />;
}

const BOOKED_STYLES: Record<string, string> = {
  booked: "border-primary bg-primary-soft text-primary-ink hover:brightness-[0.97]",
  completed: "border-tertiary bg-tertiary-soft text-ink hover:brightness-[0.97]",
  no_show: "border-danger bg-danger-soft text-danger hover:brightness-[0.97]",
};

function SlotTile({ slot: s, first, onBook, onOpen }: { slot: Slot; first: number; onBook: () => void; onOpen: () => void }) {
  const top = (toMinutes(s.start) - first) * PX_PER_MIN + 2;
  const h = (toMinutes(s.end) - toMinutes(s.start)) * PX_PER_MIN - 4;
  const style = { top, height: h };
  const compact = h < 60;
  const base = "absolute inset-x-2 overflow-hidden rounded-lg px-2.5 text-left transition";

  if (s.state === "booked" && s.appointment) {
    const a = s.appointment;
    return (
      <button onClick={onOpen} style={style}
        className={cn(base, "border-l-[3px] py-1.5", BOOKED_STYLES[a.status] ?? BOOKED_STYLES.booked)}
        title={`${a.patient_name} · ${formatTime(s.start)}`}>
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[13px] font-semibold">{a.patient_name}</span>
          {s.out_of_hours && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" aria-label="Outside working hours" />}
        </div>
        <p className={cn("truncate text-[11px] opacity-80", compact && "sr-only")}>
          <span className="font-mono">{formatTime(s.start)}</span> · {labelOf(SESSION_TYPES, a.session_type)}
          {a.status !== "booked" && ` · ${a.status === "no_show" ? "No-show" : "Done"}`}
        </p>
      </button>
    );
  }

  if (s.state === "past") {
    return <div style={style} className={cn(base, "flex items-center font-mono text-[11px] text-muted/50")}>{formatTime(s.start)}</div>;
  }

  return (
    <button onClick={onBook} style={style} aria-label={`Book ${formatTime(s.start)}`}
      className={cn(base, "group flex items-center justify-between border border-dashed border-border bg-surface",
        "hover:border-primary hover:bg-primary-soft/40")}>
      <span className="font-mono text-[11px] text-muted group-hover:text-primary-ink">{formatTime(s.start)}</span>
      <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
        <Plus className="h-3.5 w-3.5" /> Book
      </span>
    </button>
  );
}