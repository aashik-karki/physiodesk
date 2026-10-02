"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { PatientPicker } from "@/components/patients/patient-picker";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, TextareaField } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { PAYMENT_METHODS, formatMoney, todayISO } from "@/lib/format";
import { useSaveInvoice } from "@/lib/queries/invoices";
import { usePackages } from "@/lib/queries/patients";
import type { Invoice, Patient, PaymentMethod } from "@/lib/types";

interface FormState {
  packageId: string; service: string; amount: string; discount: string;
  status: "paid" | "due"; method: PaymentMethod | ""; issuedOn: string; notes: string;
}

type Errors = Partial<Record<keyof FormState | "patient", string>>;

const money = (v: string) => (v.trim() === "" ? NaN : Number(v));

function validate(f: FormState, hasPatient: boolean): Errors {
  const e: Errors = {};
  if (!hasPatient) e.patient = "Choose a patient";
  if (!f.service.trim()) e.service = "Describe the service";
  const amount = money(f.amount), discount = f.discount.trim() === "" ? 0 : money(f.discount);
  if (!(amount >= 0)) e.amount = "Enter an amount of 0 or more";
  if (!(discount >= 0)) e.discount = "Discount can't be negative";
  else if (amount >= 0 && discount > amount) e.discount = "Discount can't exceed the amount";
  if (f.status === "paid" && !f.method) e.method = "Choose how it was paid";
  if (!f.issuedOn) e.issuedOn = "Pick a date";
  return e;
}

/** Admin-only. `invoice` = edit, otherwise create (optionally for a preset patient). */
export function InvoiceForm({ invoice, patient: presetPatient, onClose, onSaved }: {
  invoice?: Invoice | null;
  patient?: Patient | null;
  onClose: () => void;
  onSaved?: (inv: Invoice) => void;
}) {
  const editing = Boolean(invoice);
  const [patient, setPatient] = useState<Patient | null>(presetPatient ?? null);
  const [form, setForm] = useState<FormState>(() => ({
    packageId: invoice?.package_id ? String(invoice.package_id) : "",
    service: invoice?.service ?? "",
    amount: invoice ? String(Number(invoice.amount)) : "",
    discount: invoice ? String(Number(invoice.discount)) : "0",
    status: invoice?.status === "paid" ? "paid" : "due",
    method: invoice?.payment_method ?? "",
    issuedOn: invoice?.issued_on ?? todayISO(),
    notes: invoice?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Errors>({});
  const save = useSaveInvoice();
  const { data: packages } = usePackages();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  function choosePackage(id: string) {
    const pkg = packages?.find((p) => String(p.id) === id);
    setForm((f) => ({
      ...f, packageId: id,
      ...(pkg ? { service: pkg.name, amount: String(Number(pkg.price)) } : {}),
    }));
  }

  const amount = money(form.amount) || 0;
  const discount = money(form.discount) || 0;
  const total = Math.max(0, amount - discount);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(form, editing || Boolean(patient));
    setErrors(found);
    if (Object.keys(found).length) return;
    const common = {
      service: form.service.trim(), amount: form.amount.trim(), discount: form.discount.trim() || "0",
      status: form.status, payment_method: form.method || null, issued_on: form.issuedOn, notes: form.notes.trim() || null,
    };
    save.mutate(
      editing
        ? { id: invoice!.id, data: common }
        : { data: { ...common, patient_id: patient!.id, package_id: form.packageId ? Number(form.packageId) : null } },
      { onSuccess: (inv) => { onSaved?.(inv); onClose(); } },
    );
  }

  return (
    <Modal open onClose={onClose} size="lg"
      title={editing ? `Edit ${invoice!.number}` : "New invoice"}
      description={editing ? `Billed to ${invoice!.patient_name}` : "Bill a patient for a session or a package."}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="invoice-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create invoice"}
          </Button>
        </>
      }>
      <form id="invoice-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        {save.error && <Alert>{save.error.message}</Alert>}

        {!editing && <PatientPicker value={patient} onChange={setPatient} error={errors.patient} />}

        <div className={cn("grid gap-4", !editing && "sm:grid-cols-2")}>
          {!editing && (
            <SelectField label="Package (optional)" name="package" value={form.packageId} onChange={(e) => choosePackage(e.target.value)}>
              <option value="">Custom service</option>
              {packages?.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatMoney(p.price)}</option>)}
            </SelectField>
          )}
          <Field label="Service" name="service" value={form.service} onChange={(e) => set("service", e.target.value)}
            error={errors.service} placeholder="Physiotherapy session" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Amount (Rs)" name="amount" type="number" min={0} step="0.01" inputMode="decimal"
            value={form.amount} onChange={(e) => set("amount", e.target.value)} error={errors.amount} className="font-mono" />
          <Field label="Discount (Rs)" name="discount" type="number" min={0} step="0.01" inputMode="decimal"
            value={form.discount} onChange={(e) => set("discount", e.target.value)} error={errors.discount} className="font-mono" />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">Total</p>
            <div className="flex h-11 items-center rounded-lg bg-primary-soft px-3.5 font-mono text-base font-semibold text-primary-ink">
              {formatMoney(total)}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">Status</p>
            <div className="flex h-11 rounded-lg border border-border bg-surface p-1" role="group">
              {(["due", "paid"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={form.status === s} onClick={() => set("status", s)}
                  className={cn("flex-1 rounded-md text-sm font-medium capitalize transition",
                    form.status === s ? "bg-secondary text-white" : "text-muted hover:text-ink")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <SelectField label={form.status === "paid" ? "Paid by" : "Payment method (optional)"} name="method"
            value={form.method} onChange={(e) => set("method", e.target.value as PaymentMethod | "")} error={errors.method}>
            <option value="">Not set</option>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </SelectField>
          <Field label="Issued on" name="issued_on" type="date" value={form.issuedOn}
            onChange={(e) => set("issuedOn", e.target.value)} error={errors.issuedOn} />
        </div>

        <TextareaField label="Notes (optional)" name="notes" rows={2} value={form.notes}
          onChange={(e) => set("notes", e.target.value)} placeholder="Shown on the printed invoice" />
      </form>
    </Modal>
  );
}