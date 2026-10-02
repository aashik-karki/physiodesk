"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, TextareaField } from "@/components/ui/input";

import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select";
import { GENDERS, PATIENT_STATUSES, formatMoney } from "@/lib/format";
import { usePackages, useSavePatient } from "@/lib/queries/patients";
import { useTherapists } from "@/lib/queries/therapists";
import type { Gender, Patient, PatientInput, PatientStatus } from "@/lib/types";

// The form keeps every value as a string (that's what inputs give us) and converts on submit.
interface FormState {
  full_name: string; phone: string; age: string; gender: Gender | ""; address: string;
  condition: string; notes: string; status: PatientStatus; therapist_id: string; package_id: string;
}

function toForm(p: Patient | null): FormState {
  return {
    full_name: p?.full_name ?? "", phone: p?.phone ?? "", age: p ? String(p.age) : "",
    gender: p?.gender ?? "", address: p?.address ?? "", condition: p?.condition ?? "",
    notes: p?.notes ?? "", status: p?.status ?? "active",
    therapist_id: p?.therapist ? String(p.therapist.id) : "",
    package_id: p?.package ? String(p.package.id) : "",
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.full_name.trim()) e.full_name = "Name is required";
  if (!/^\+?[0-9][0-9 -]{5,19}$/.test(f.phone.trim())) e.phone = "Enter a valid phone number";
  const age = Number(f.age);
  if (f.age === "" || !Number.isInteger(age) || age < 0 || age > 130) e.age = "Age must be 0–130";
  if (!f.gender) e.gender = "Select a gender";
  if (!f.condition.trim()) e.condition = "Condition is required";
  return e;
}

function toInput(f: FormState): PatientInput {
  return {
    full_name: f.full_name.trim(), phone: f.phone.trim(), age: Number(f.age),
    gender: f.gender as Gender, address: f.address.trim() || null,
    condition: f.condition.trim(), notes: f.notes.trim() || null, status: f.status,
    therapist_id: f.therapist_id ? Number(f.therapist_id) : null,
    package_id: f.package_id ? Number(f.package_id) : null,
  };
}

export function PatientForm({ patient, onClose, onSaved }: {
  patient: Patient | null; // null = new patient
  onClose: () => void;
  onSaved?: (p: Patient) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(patient));
  const [errors, setErrors] = useState<Errors>({});
  const save = useSavePatient();
  const { data: therapists } = useTherapists();
  const { data: packages } = usePackages();

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate({ id: patient?.id, data: toInput(form) }, {
      onSuccess: (saved) => { onSaved?.(saved); onClose(); },
    });
  }

  // Keep a removed therapist visible in the dropdown when editing an old record.
  const assignedGone = patient?.therapist && !therapists?.some((t) => t.id === patient.therapist!.id);

  return (
    <Modal open onClose={onClose} size="lg"
      title={patient ? "Edit patient" : "Add patient"}
      description={patient ? `Registered patient #${patient.id}` : "Register a new patient with the clinic."}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="patient-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {patient ? "Save changes" : "Add patient"}
          </Button>
        </>
      }
    >
      <form id="patient-form" onSubmit={onSubmit} className="space-y-6" noValidate>
        {save.error && <Alert>{save.error.message}</Alert>}

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Personal details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="full_name" value={form.full_name} onChange={set("full_name")}
              error={errors.full_name} placeholder="Ram Bahadur Thapa" />
            <Field label="Phone" name="phone" inputMode="tel" value={form.phone} onChange={set("phone")}
              error={errors.phone} placeholder="98XXXXXXXX" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Age" name="age" type="number" min={0} max={130} value={form.age}
                onChange={set("age")} error={errors.age} />
              <SelectField label="Gender" name="gender" value={form.gender} onChange={set("gender")} error={errors.gender}>
                <option value="" disabled>Select</option>
                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </SelectField>
            </div>
            <Field label="Address (optional)" name="address" value={form.address} onChange={set("address")}
              placeholder="Lalitpur" />
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Treatment</h3>
          <Field label="Condition / diagnosis" name="condition" value={form.condition} onChange={set("condition")}
            error={errors.condition} placeholder="Lower back pain" />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Assigned therapist" name="therapist_id" value={form.therapist_id} onChange={set("therapist_id")}>
              <option value="">Unassigned</option>
              {assignedGone && <option value={patient!.therapist!.id}>{patient!.therapist!.full_name} (removed)</option>}
              {therapists?.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </SelectField>
            <SelectField label="Package" name="package_id" value={form.package_id} onChange={set("package_id")}>
              <option value="">No package</option>
              {packages?.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {formatMoney(p.price)}</option>
              ))}
            </SelectField>
            <SelectField label="Status" name="status" value={form.status} onChange={set("status")}>
              {PATIENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SelectField>
          </div>
          <TextareaField label="Notes (optional)" name="notes" value={form.notes} onChange={set("notes")}
            placeholder="Anything the therapist should know" />
        </section>
      </form>
    </Modal>
  );
}