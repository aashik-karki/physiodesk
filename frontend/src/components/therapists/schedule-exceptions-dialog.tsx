"use client";

import { CalendarOff, Clock, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import { useDeleteOverride, useOverrides, useSetOverride } from "@/lib/queries/schedule";

/** Admin: one-off days off or custom hours for a single date. */
export function ScheduleExceptionsDialog({ therapist, initialDate, onClose }: {
  therapist: { id: number; full_name: string };
  initialDate?: string;
  onClose: () => void;
}) {
  const { data: overrides, isPending } = useOverrides(therapist.id);
  const setOverride = useSetOverride(therapist.id);
  const removeOverride = useDeleteOverride(therapist.id);

  const [date, setDate] = useState(initialDate ?? todayISO());
  const [isOff, setIsOff] = useState(true);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("14:00");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isOff && end <= start) return setFormError("End time must be after start time");
    setFormError(null);
    setOverride.mutate(
      { date, data: { is_off: isOff, start_time: isOff ? null : start, end_time: isOff ? null : end, reason: reason.trim() || null } },
      { onSuccess: () => setReason("") },
    );
  }

  const error = formError ?? setOverride.error?.message ?? removeOverride.error?.message;

  return (
    <Modal open onClose={onClose} size="lg" title={`Schedule exceptions · ${therapist.full_name}`}
      description="Override the weekly hours for a specific date. Saving the same date again replaces it."
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="space-y-6">
        <form onSubmit={save} className="space-y-4 rounded-xl border border-border bg-canvas/50 p-4">
          {error && <Alert>{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Date" name="override-date" type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink">Type</p>
              <div className="flex h-11 rounded-lg border border-border bg-surface p-1" role="group">
                {[{ off: true, label: "Day off" }, { off: false, label: "Custom hours" }].map((o) => (
                  <button key={o.label} type="button" aria-pressed={isOff === o.off} onClick={() => setIsOff(o.off)}
                    className={cn("rounded-md px-3 text-sm font-medium transition", isOff === o.off ? "bg-secondary text-white" : "text-muted hover:text-ink")}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {!isOff && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="From" name="override-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              <Field label="To" name="override-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          )}
          <Field label="Reason (optional)" name="override-reason" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={isOff ? "Annual leave" : "Afternoon training"} />
          <div className="flex justify-end">
            <Button type="submit" disabled={setOverride.isPending}>
              {setOverride.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save exception
            </Button>
          </div>
        </form>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">Upcoming exceptions</h3>
          {isPending ? <Skeleton className="h-16" /> : overrides?.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {overrides.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg", o.is_off ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary-ink")}>
                    {o.is_off ? <CalendarOff className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{formatDate(o.date)}</p>
                    <p className="text-xs text-muted">
                      {o.is_off ? "Day off" : <span className="font-mono">{formatTime(o.start_time!)} – {formatTime(o.end_time!)}</span>}
                      {o.reason && ` · ${o.reason}`}
                    </p>
                  </div>
                  <button onClick={() => removeOverride.mutate(o.date)} aria-label={`Remove exception on ${o.date}`} title="Back to regular hours"
                    className="rounded-lg p-2 text-muted transition hover:bg-danger-soft hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              No exceptions. {therapist.full_name} follows their weekly hours.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}