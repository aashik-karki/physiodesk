"use client";

import { Plus, Receipt } from "lucide-react";
import { useState } from "react";
import { MarkPaidDialog, VoidInvoiceDialog } from "@/components/billing/invoice-actions";
import { InvoiceForm } from "@/components/billing/invoice-form";
import { InvoiceTable } from "@/components/billing/invoice-table";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { INVOICE_PAGE_SIZE, useInvoices } from "@/lib/queries/invoices";
import type { Invoice, Patient } from "@/lib/types";

export function BillingHistory({ patient }: { patient: Patient }) {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const { data, isPending, error } = useInvoices({ status: null, search: "", patientId: patient.id, page });
  const [editing, setEditing] = useState<Invoice | null | undefined>(undefined);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [voiding, setVoiding] = useState<Invoice | null>(null);

  const due = data && Number(data.summary.due_total);

  return (
    <Card>
      <CardHeader title="Billing history" action={
        <div className="flex items-center gap-3">
          {due ? <span className="text-sm text-muted">Outstanding <span className="font-mono font-semibold text-danger">{formatMoney(due)}</span></span> : null}
          {isAdmin && <Button variant="secondary" size="sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Invoice</Button>}
        </div>
      } />
      {error ? <div className="p-5"><Alert>{error.message}</Alert></div>
        : isPending ? <div className="space-y-2 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        : data.items.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices yet" text="Invoices issued to this patient will appear here." />
        ) : (
          <>
            <InvoiceTable invoices={data.items} canManage={isAdmin} showPatient={false}
              onPay={setPaying} onEdit={setEditing} onVoid={setVoiding} />
            {data.total > INVOICE_PAGE_SIZE && <Pagination page={page} pageSize={INVOICE_PAGE_SIZE} total={data.total} onChange={setPage} />}
          </>
        )}
      {editing !== undefined && <InvoiceForm key={editing?.id ?? "new"} invoice={editing} patient={patient} onClose={() => setEditing(undefined)} />}
      {paying && <MarkPaidDialog invoice={paying} onClose={() => setPaying(null)} />}
      {voiding && <VoidInvoiceDialog invoice={voiding} onClose={() => setVoiding(null)} />}
    </Card>
  );
}