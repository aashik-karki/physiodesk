"use client";

import { ArrowRight, CalendarClock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/status-pill";
import { PAYMENT_METHODS, SESSION_TYPES, formatLongDate, formatTime, labelOf } from "@/lib/format";
import { useAppointment, useUpdateAppointment, type AppointmentPatch } from "@/lib/queries/schedule";
import type { Appointment } from "@/lib/types";
import { SlotFields, type SlotChoice } from "./slot-fields";

function hasStarted(a: Appointment) {
  return new Date(`${a.date}T${a.start_time}`) <= new Date();
}

export function AppointmentDialog({ appointmentId, onClose, onChanged }: {
  appointmentId: number;
  onClose: () => void;
  onChanged?: (message: string) => void;
}) {
  const { data: a, isPending, error } = useAppointment(appointmentId);
  const update = useUpdateAppointment();
  const [mode, setMode] = useState<"view" | "reschedule" | "confirm-cancel">("view");
  const [slot, setSlot] = useState<SlotChoice | null>(null);

  function patch(data: AppointmentPatch, message: string) {
    update.mutate({ id: appointmentId, data }, { onSuccess: () => { onChanged?.(message); onClose(); } });
  }

  if (error) return <Modal open onClose={onClose} title="Appointment"><Alert>{error.message}</Alert></Modal>;
  if (isPending) {
    return <Modal open onClose={onClose} title="Appointment"><div className="space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-24" /></div></Modal>;
  }

  const editable = a.status === "booked";
  const started = hasStarted(a);
  const choice = slot ?? { therapistId: a.therapist.id, date: a.date, startTime: a.start_time };

  const footer = mode === "reschedule" ? (
    <>
      <Button variant="secondary" onClick={() => setMode("view")}>Back</Button>
      <Button disabled={update.isPending || !choice.therapistId || !choice.startTime}
        onClick={() => patch(
          { therapist_id: choice.therapistId!, date: choice.date, start_time: choice.startTime },
          `Moved ${a.patient.full_name} to ${formatLongDate(choice.date)} at ${formatTime(choice.startTime)}.`,
        )}>
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save new time
      </Button>
    </>
  ) : mode === "confirm-cancel" ? (
    <>
      <Button variant="secondary" onClick={() => setMode("view")}>Keep appointment</Button>
      <Button variant="danger" disabled={update.isPending}
        onClick={() => patch({ status: "cancelled" }, `Cancelled ${a.patient.full_name}'s appointment. The slot is free again.`)}>
        {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Yes, cancel it
      </Button>
    </>
  ) : editable ? (
    <>
      <Button variant="danger-ghost" className="mr-auto" onClick={() => setMode("confirm-cancel")}>
        Cancel appointment
      </Button>
      {started ? (
        <>
          <Button variant="secondary" disabled={update.isPending}
            onClick={() => patch({ status: "no_show" }, `Marked ${a.patient.full_name} as a no-show.`)}>No-show</Button>
          <Button disabled={update.isPending}
            onClick={() => patch({ status: "completed" }, `Marked ${a.patient.full_name}'s session as completed.`)}>Mark completed</Button>
        </>
      ) : (
        <Button variant="secondary" onClick={() => setMode("reschedule")}><CalendarClock className="h-4 w-4" /> Reschedule</Button>
      )}
    </>
  ) : (
    <Button variant="secondary" onClick={onClose}>Close</Button>
  );

  return (
    <Modal open onClose={onClose} size={mode === "reschedule" ? "lg" : "md"}
      title={mode === "reschedule" ? "Reschedule appointment" : a.patient.full_name}
      description={`${formatLongDate(a.date)} · ${formatTime(a.start_time)} – ${formatTime(a.end_time)}`}
      footer={footer}>
      <div className="space-y-4">
        {update.error && <Alert>{update.error.message}</Alert>}

        {mode === "reschedule" ? (
          <SlotFields value={choice} onChange={setSlot}
            keepSlot={{ therapistId: a.therapist.id, date: a.date, start: a.start_time, end: a.end_time }} />
        ) : mode === "confirm-cancel" ? (
          <p className="text-sm text-ink">
            Cancel this {labelOf(SESSION_TYPES, a.session_type).toLowerCase()} with {a.therapist.full_name}? The slot becomes
            available to book again. This can&apos;t be undone.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <StatusPill status={a.status} />
              <Link href={`/patients/${a.patient.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Patient profile <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl bg-canvas p-4 text-sm">
              <div><dt className="text-xs text-muted">Therapist</dt><dd className="mt-0.5 text-ink">{a.therapist.full_name}</dd></div>
              <div><dt className="text-xs text-muted">Phone</dt><dd className="mt-0.5 font-mono text-ink">{a.patient.phone}</dd></div>
              <div><dt className="text-xs text-muted">Session type</dt><dd className="mt-0.5 text-ink">{labelOf(SESSION_TYPES, a.session_type)}</dd></div>
              <div><dt className="text-xs text-muted">Payment</dt><dd className="mt-0.5 text-ink">{labelOf(PAYMENT_METHODS, a.payment_method)}</dd></div>
              {a.notes && <div className="col-span-2"><dt className="text-xs text-muted">Notes</dt><dd className="mt-0.5 whitespace-pre-line text-ink">{a.notes}</dd></div>}
            </dl>
            {editable && !started && (
              <p className="text-xs text-muted">You can mark it completed or as a no-show once the session has started.</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}