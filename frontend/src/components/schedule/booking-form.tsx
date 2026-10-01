"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { PatientPicker } from "@/components/patients/patient-picker";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { TextareaField } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { PAYMENT_METHODS, SESSION_TYPES, formatLongDate, formatTime } from "@/lib/format";
import { useBookAppointment } from "@/lib/queries/schedule";
import type { PaymentMethod, Patient, SessionType } from "@/lib/types";
import { SlotFields, type SlotChoice } from "./slot-fields";

export interface BookingPreset {
  therapistId?: number | null;
  date: string;
  startTime?: string;
  patient?: Patient | null;
}

export function BookingForm({ preset, onClose, onBooked }: {
  preset: BookingPreset;
  onClose: () => void;
  onBooked?: (message: string) => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(preset.patient ?? null);
  const [slot, setSlot] = useState<SlotChoice>({
    therapistId: preset.therapistId ?? preset.patient?.therapist?.id ?? null,
    date: preset.date,
    startTime: preset.startTime ?? "",
  });
  const [sessionType, setSessionType] = useState<SessionType>("treatment");
  const [payment, setPayment] = useState<PaymentMethod>(preset.patient?.package ? "package" : "cash");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ patient?: string; slot?: string }>({});
  const book = useBookAppointment();

  function choosePatient(p: Patient | null) {
    setPatient(p);
    if (p?.package) setPayment("package"); // patients on a package usually pay through it
    if (p?.therapist && !slot.therapistId) setSlot((s) => ({ ...s, therapistId: p.therapist!.id }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = {
      patient: patient ? undefined : "Choose a patient",
      slot: slot.therapistId && slot.startTime ? undefined : "Choose a therapist and time",
    };
    setErrors(found);
    if (found.patient || found.slot) return;
    book.mutate(
      {
        patient_id: patient!.id, therapist_id: slot.therapistId!, date: slot.date, start_time: slot.startTime,
        session_type: sessionType, payment_method: payment, notes: notes.trim() || null,
      },
      {
        onSuccess: (a) => {
          onBooked?.(`Booked ${a.patient.full_name} with ${a.therapist.full_name}, ${formatLongDate(a.date)} at ${formatTime(a.start_time)}.`);
          onClose();
        },
      },
    );
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Book appointment"
      description="Only open slots are offered. Double-booking is blocked by the server."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="booking-form" disabled={book.isPending}>
            {book.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm booking
          </Button>
        </>
      }
    >
      <form id="booking-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        {book.error && <Alert>{book.error.message}</Alert>}
        <PatientPicker value={patient} onChange={choosePatient} error={errors.patient} />
        <SlotFields value={slot} onChange={setSlot} error={errors.slot} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">Session type</p>
            <div className="flex rounded-lg border border-border bg-surface p-1" role="group">
              {SESSION_TYPES.map((s) => (
                <button key={s.value} type="button" aria-pressed={sessionType === s.value} onClick={() => setSessionType(s.value)}
                  className={cn("flex-1 rounded-md py-2 text-sm font-medium transition",
                    sessionType === s.value ? "bg-secondary text-white" : "text-muted hover:text-ink")}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <SelectField label="Payment method" name="payment" value={payment}
            onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </SelectField>
        </div>
        <TextareaField label="Notes (optional)" name="notes" rows={2} value={notes}
          onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bring previous MRI report" />
      </form>
    </Modal>
  );
}