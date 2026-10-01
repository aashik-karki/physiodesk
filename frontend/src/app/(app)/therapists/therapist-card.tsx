import { Clock, Mail, Pencil, Phone, Trash2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";
import { WEEKDAYS, formatTime, initials } from "@/lib/format";
import type { Therapist } from "@/lib/types";

interface Props {
  therapist: Therapist;
  canManage: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

export function TherapistCard({ therapist: t, canManage, onEdit, onRemove }: Props) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-4 p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-lg font-semibold text-primary-ink">
          {initials(t.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-lg font-semibold leading-tight text-ink">{t.full_name}</h3>
            <StatusPill status={t.on_duty_today ? "on_duty" : "off_today"} />
          </div>
          <p className="mt-0.5 text-sm text-muted">{t.specialty}</p>
        </div>
      </div>

      <div className="space-y-4 border-t border-border px-5 py-4">
        <div className="flex gap-1.5" aria-label="Working days">
          {WEEKDAYS.map((d) => {
            const works = t.working_days.includes(d.value);
            return (
              <span key={d.value} title={d.short}
                className={cn("grid h-7 w-8 place-items-center rounded-md text-[11px] font-semibold",
                  works ? "bg-secondary text-white" : "bg-canvas text-muted/50")}>
                {d.letter}
              </span>
            );
          })}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3.5 w-3.5" /> Hours</dt>
            <dd className="mt-1 font-mono text-[13px] text-ink">{formatTime(t.start_time)} – {formatTime(t.end_time)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Session length</dt>
            <dd className="mt-1 font-mono text-[13px] text-ink">{t.slot_minutes} min</dd>
          </div>
        </dl>
        {(t.phone || t.email) && (
          <div className="space-y-1 text-sm text-muted">
            {t.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span className="font-mono text-[13px]">{t.phone}</span></p>}
            {t.email && <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5" />{t.email}</p>}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between rounded-b-card border-t border-border bg-canvas/50 px-5 py-3">
        <div className="flex items-center gap-4 text-sm">
          <span><span className="font-mono font-semibold text-ink">{t.weekly_hours}</span> <span className="text-muted">h/week</span></span>
          <span className="flex items-center gap-1.5 text-muted">
            <Users className="h-3.5 w-3.5" />
            <span className="font-mono font-semibold text-ink">{t.patients_today}</span> today
          </span>
        </div>
        {canManage && (
          <div className="flex gap-1">
            <button onClick={onEdit} aria-label={`Edit ${t.full_name}`} title="Edit"
              className="rounded-lg p-2 text-muted transition hover:bg-surface hover:text-ink">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onRemove} aria-label={`Remove ${t.full_name}`} title="Remove"
              className="rounded-lg p-2 text-muted transition hover:bg-danger-soft hover:text-danger">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}