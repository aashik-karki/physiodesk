import { CalendarCog, Pencil, Trash2 } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";
import { WEEKDAYS, formatTime, initials } from "@/lib/format";
import type { Therapist } from "@/lib/types";

const ACTION = "rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-ink";

export function TherapistTable({ therapists, canManage, onEdit, onRemove, onExceptions }: {
  therapists: Therapist[];
  canManage: boolean;
  onEdit: (t: Therapist) => void;
  onRemove: (t: Therapist) => void;
  onExceptions: (t: Therapist) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-canvas/60 text-left text-xs font-semibold uppercase tracking-wider text-muted">
            <th className="px-4 py-3">Therapist</th>
            <th className="px-4 py-3">Working days</th>
            <th className="px-4 py-3">Hours</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Patients today</th>
            <th className="px-4 py-3">Today</th>
            {canManage && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {therapists.map((t) => (
            <tr key={t.id} className="hover:bg-canvas/50">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
                    {initials(t.full_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{t.full_name}</p>
                    <p className="truncate text-xs text-muted">{t.specialty}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex gap-1" aria-label={`Works ${WEEKDAYS.filter((d) => t.working_days.includes(d.value)).map((d) => d.short).join(", ")}`}>
                  {WEEKDAYS.map((d) => (
                    <span key={d.value} title={d.short} aria-hidden
                      className={cn("grid h-6 w-7 place-items-center rounded text-[10px] font-semibold",
                        t.working_days.includes(d.value) ? "bg-secondary text-white" : "bg-canvas text-muted/50")}>
                      {d.letter}
                    </span>
                  ))}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[13px] text-ink">
                {formatTime(t.start_time)} – {formatTime(t.end_time)}
                <span className="block text-[11px] text-muted">{t.slot_minutes}-min sessions · {t.weekly_hours} h/week</span>
              </td>
              <td className="px-4 py-3.5 text-right font-mono text-[13px] text-ink">{t.patients_today}</td>
              <td className="px-4 py-3.5"><StatusPill status={t.on_duty_today ? "on_duty" : "off_today"} /></td>
              {canManage && (
                <td className="px-4 py-3.5">
                  <div className="flex justify-end gap-0.5 whitespace-nowrap">
                    <button onClick={() => onExceptions(t)} className={ACTION} title="Days off / custom hours" aria-label={`Days off and custom hours for ${t.full_name}`}>
                      <CalendarCog className="h-4 w-4" />
                    </button>
                    <button onClick={() => onEdit(t)} className={ACTION} title="Edit" aria-label={`Edit ${t.full_name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => onRemove(t)} className={`${ACTION} hover:bg-danger-soft hover:text-danger`} title="Remove" aria-label={`Remove ${t.full_name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
