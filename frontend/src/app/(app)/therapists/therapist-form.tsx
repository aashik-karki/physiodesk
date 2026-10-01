"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { WEEKDAYS } from "@/lib/format";
import { useSaveTherapist } from "@/lib/queries/therapists";
import type { Therapist, TherapistInput } from "@/lib/types";

const SLOT_OPTIONS = [15, 20, 30, 45, 60, 90];

function toForm(t?: Therapist | null): TherapistInput {
  return t
    ? {
        full_name: t.full_name, specialty: t.specialty, phone: t.phone, email: t.email,
        working_days: t.working_days, start_time: t.start_time.slice(0, 5),
        end_time: t.end_time.slice(0, 5), slot_minutes: t.slot_minutes,
      }
    : {
        full_name: "", specialty: "", phone: null, email: null,
        working_days: [1, 2, 3, 4, 5], start_time: "09:00", end_time: "17:00", slot_minutes: 45,
      };
}

type Errors = Partial<Record<keyof TherapistInput, string>>;

function validate(f: TherapistInput): Errors {
  const e: Errors = {};
  if (!f.full_name.trim()) e.full_name = "Name is required";
  if (!f.specialty.trim()) e.specialty = "Specialty is required";
  if (f.working_days.length === 0) e.working_days = "Pick at least one working day";
  if (f.end_time <= f.start_time) e.end_time = "End time must be after start time";
  return e;
}

/** Add or edit a therapist. Pass `therapist` to edit, `null` to add. */
export function TherapistForm({ open, therapist, onClose }: {
  open: boolean; therapist: Therapist | null; onClose: () => void;
}) {
  // The parent remounts this component (via `key`) for each open, so initial state is fresh.
  const [form, setForm] = useState<TherapistInput>(() => toForm(therapist));
  const [errors, setErrors] = useState<Errors>({});
  const save = useSaveTherapist();

  const set = <K extends keyof TherapistInput>(key: K, value: TherapistInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (day: number) =>
    set("working_days", form.working_days.includes(day)
      ? form.working_days.filter((d) => d !== day)
      : [...form.working_days, day].sort());

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate(
      {
        id: therapist?.id,
        data: { ...form, phone: form.phone?.trim() || null, email: form.email?.trim() || null },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={therapist ? "Edit therapist" : "Add therapist"}
      description="Working days, hours and session length decide which slots can be booked."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="therapist-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {therapist ? "Save changes" : "Add therapist"}
          </Button>
        </>
      }
    >
      <form id="therapist-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        {save.error && <Alert>{save.error.message}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="full_name" value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)} error={errors.full_name} placeholder="Dr. Sita Sharma" />
          <Field label="Specialty" name="specialty" value={form.specialty}
            onChange={(e) => set("specialty", e.target.value)} error={errors.specialty} placeholder="Sports rehabilitation" />
          <Field label="Phone (optional)" name="phone" value={form.phone ?? ""}
            onChange={(e) => set("phone", e.target.value)} placeholder="98XXXXXXXX" />
          <Field label="Email (optional)" name="email" type="email" value={form.email ?? ""}
            onChange={(e) => set("email", e.target.value)} placeholder="sita@clinic.com" />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Working days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = form.working_days.includes(d.value);
              return (
                <button key={d.value} type="button" aria-pressed={on} onClick={() => toggleDay(d.value)}
                  className={cn("h-10 w-14 rounded-lg border text-sm font-medium transition",
                    on ? "border-secondary bg-secondary text-white" : "border-border bg-surface text-muted hover:border-primary hover:text-ink")}>
                  {d.short}
                </button>
              );
            })}
          </div>
          {errors.working_days && <p className="mt-1.5 text-xs text-danger">{errors.working_days}</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Start time" name="start_time" type="time" value={form.start_time}
            onChange={(e) => set("start_time", e.target.value)} />
          <Field label="End time" name="end_time" type="time" value={form.end_time}
            onChange={(e) => set("end_time", e.target.value)} error={errors.end_time} />
          <SelectField label="Session length" name="slot_minutes" value={form.slot_minutes}
            onChange={(e) => set("slot_minutes", Number(e.target.value))}>
            {SLOT_OPTIONS.map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </SelectField>
        </div>
      </form>
    </Modal>
  );
}