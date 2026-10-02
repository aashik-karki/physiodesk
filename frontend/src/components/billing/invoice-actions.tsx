"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select";
import { PAYMENT_METHODS, formatMoney } from "@/lib/format";
import { useMarkPaid, useVoidInvoice } from "@/lib/queries/invoices";
import type { Invoice, PaymentMethod } from "@/lib/types";

export function MarkPaidDialog({ invoice, onClose, onDone }: {
  invoice: Invoice; onClose: () => void; onDone?: (msg: string) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>(invoice.payment_method ?? "cash");
  const pay = useMarkPaid();
  return (
    <Modal open onClose={onClose} size="sm" title={`Record payment · ${invoice.number}`}
      description={`${invoice.patient_name} · ${formatMoney(invoice.total)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={pay.isPending} onClick={() => pay.mutate({ id: invoice.id, method }, {
            onSuccess: () => { onDone?.(`${invoice.number} marked paid.`); onClose(); },
          })}>
            {pay.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Mark as paid
          </Button>
        </>
      }>
      <div className="space-y-4">
        {pay.error && <Alert>{pay.error.message}</Alert>}
        <SelectField label="Paid by" name="paid-by" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </SelectField>
      </div>
    </Modal>
  );
}

export function VoidInvoiceDialog({ invoice, onClose, onDone }: {
  invoice: Invoice; onClose: () => void; onDone?: (msg: string) => void;
}) {
  const voidIt = useVoidInvoice();
  return (
    <Modal open onClose={onClose} size="sm" title={`Void ${invoice.number}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Keep invoice</Button>
          <Button variant="danger" disabled={voidIt.isPending} onClick={() => voidIt.mutate(invoice.id, {
            onSuccess: () => { onDone?.(`${invoice.number} was voided.`); onClose(); },
          })}>
            {voidIt.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Void invoice
          </Button>
        </>
      }>
      <div className="space-y-3 text-sm text-ink">
        {voidIt.error && <Alert>{voidIt.error.message}</Alert>}
        <p>The invoice stays on record marked <strong>Void</strong> and stops counting toward revenue or outstanding totals.</p>
        <p className="text-muted">Financial records are never erased, so you keep an audit trail.</p>
      </div>
    </Modal>
  );
}