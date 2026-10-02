"use client";

import { CircleDollarSign, Clock, FileText, Plus, Receipt, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { MarkPaidDialog, VoidInvoiceDialog } from "@/components/billing/invoice-actions";
import { InvoiceForm } from "@/components/billing/invoice-form";
import { InvoiceTable } from "@/components/billing/invoice-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { INVOICE_PAGE_SIZE, useInvoices } from "@/lib/queries/invoices";
import type { Invoice, InvoiceStatus } from "@/lib/types";

type Tab = InvoiceStatus | null;

export default function BillingPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const { data, isPending, isFetching, error } = useInvoices({ status: tab, search: deferredSearch, page });

  const [editing, setEditing] = useState<Invoice | null | undefined>(undefined); // null = new
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [voiding, setVoiding] = useState<Invoice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const s = data?.summary;
  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: null, label: "All", count: s ? s.paid_count + s.due_count + s.void_count : undefined },
    { value: "paid", label: "Paid", count: s?.paid_count },
    { value: "due", label: "Due", count: s?.due_count },
    { value: "void", label: "Void", count: s?.void_count },
  ];

  return (
    <>
      <PageHeader title="Billing"
        subtitle={isAdmin ? "Invoices, payments and outstanding balances." : "Invoices and payments (view only)."}
        actions={isAdmin && <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> New invoice</Button>} />

      <main className="space-y-6 p-8">
        {notice && <Alert tone="success">{notice}</Alert>}

        <section className="grid gap-5 sm:grid-cols-3">
          <StatCard label="Collected" icon={CircleDollarSign}
            value={s ? formatMoney(s.paid_total) : "—"} hint={s && `${s.paid_count} paid invoice${s.paid_count === 1 ? "" : "s"}`} />
          <StatCard label="Outstanding" icon={Clock}
            value={s ? formatMoney(s.due_total) : "—"} hint={s && `${s.due_count} awaiting payment`} />
          <StatCard label="Invoices issued" icon={FileText}
            value={s ? s.paid_count + s.due_count : "—"} hint={s && (s.void_count ? `${s.void_count} voided, not counted` : "None voided")} />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-border bg-surface p-1" role="tablist" aria-label="Filter by status">
            {tabs.map((t) => (
              <button key={t.label} role="tab" aria-selected={tab === t.value} onClick={() => { setTab(t.value); setPage(1); }}
                className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  tab === t.value ? "bg-secondary text-white" : "text-muted hover:text-ink")}>
                {t.label}
                {t.count !== undefined && (
                  <span className={cn("rounded px-1.5 font-mono text-[11px]", tab === t.value ? "bg-white/15" : "bg-canvas")}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search patient, service or INV number" aria-label="Search invoices"
              className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15" />
          </div>
        </div>

        <Card className={cn("overflow-hidden transition-opacity", isFetching && !isPending && "opacity-70")}>
          {error ? <div className="p-5"><Alert>Couldn&apos;t load invoices: {error.message}</Alert></div>
            : isPending ? <div className="space-y-3 p-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
            : data.items.length === 0 ? (
              <EmptyState icon={Receipt}
                title={tab || deferredSearch ? "No invoices match" : "No invoices yet"}
                text={tab || deferredSearch ? "Try another tab or search." : isAdmin ? "Create the first invoice for a patient." : "Invoices created by an admin will appear here."}
                action={isAdmin && !tab && !deferredSearch && <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> New invoice</Button>} />
            ) : (
              <>
                <InvoiceTable invoices={data.items} canManage={isAdmin} onPay={setPaying} onEdit={setEditing} onVoid={setVoiding} />
                <Pagination page={page} pageSize={INVOICE_PAGE_SIZE} total={data.total} onChange={setPage} />
              </>
            )}
        </Card>
      </main>

      {editing !== undefined && (
        <InvoiceForm key={editing?.id ?? "new"} invoice={editing} onClose={() => setEditing(undefined)}
          onSaved={(inv) => setNotice(editing ? `${inv.number} updated.` : `${inv.number} created for ${inv.patient_name}.`)} />
      )}
      {paying && <MarkPaidDialog invoice={paying} onClose={() => setPaying(null)} onDone={setNotice} />}
      {voiding && <VoidInvoiceDialog invoice={voiding} onClose={() => setVoiding(null)} onDone={setNotice} />}
    </>
  );
}