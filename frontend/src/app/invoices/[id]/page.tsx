"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { PAYMENT_METHODS, formatDate, formatMoney, labelOf } from "@/lib/format";
import { useInvoice } from "@/lib/queries/invoices";

const CLINIC = { name: "PhysioDesk Clinic", address: "Jhamsikhel, Lalitpur", phone: "01-5550123", email: "billing@physiodesk.dev" };

function InvoiceDocument() {
  const { id } = useParams<{ id: string }>();
  const { data: inv, isPending, error } = useInvoice(Number(id));

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 print:bg-white print:p-0">
      {/* Toolbar: hidden when printing */}
      <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between print:hidden">
        <Link href="/billing" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to billing
        </Link>
        <Button onClick={() => window.print()} disabled={!inv}><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
      </div>

      <article className="mx-auto max-w-3xl rounded-card border border-border bg-surface p-10 shadow-card print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {error ? <Alert>{error.message}</Alert> : isPending ? (
          <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40" /></div>
        ) : (
          <>
            <header className="flex items-start justify-between border-b border-border pb-8">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary font-display text-xl font-semibold text-white">P</span>
                <div>
                  <p className="font-display text-xl font-semibold text-ink">{CLINIC.name}</p>
                  <p className="text-sm text-muted">{CLINIC.address}</p>
                  <p className="text-sm text-muted">{CLINIC.phone} · {CLINIC.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-semibold text-ink">Invoice</p>
                <p className="mt-1 font-mono text-sm text-muted">{inv.number}</p>
                <div className="mt-2"><StatusPill status={inv.status} /></div>
              </div>
            </header>

            <section className="grid grid-cols-2 gap-8 py-8 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Billed to</p>
                <p className="mt-2 text-base font-medium text-ink">{inv.patient_name}</p>
                <p className="text-muted">Patient {inv.patient_id ? `#${inv.patient_id}` : "(record removed)"}</p>
              </div>
              <dl className="ml-auto grid w-64 grid-cols-2 gap-y-2 text-right">
                <dt className="text-muted">Issued</dt><dd className="text-ink">{formatDate(inv.issued_on)}</dd>
                <dt className="text-muted">Status</dt><dd className="capitalize text-ink">{inv.status}</dd>
                {inv.paid_at && <><dt className="text-muted">Paid on</dt><dd className="text-ink">{formatDate(inv.paid_at)}</dd></>}
                {inv.payment_method && <><dt className="text-muted">Method</dt><dd className="text-ink">{labelOf(PAYMENT_METHODS, inv.payment_method)}</dd></>}
              </dl>
            </section>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  <th className="py-3">Description</th><th className="py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-4 text-ink">{inv.service}</td>
                  <td className="py-4 text-right font-mono text-ink">{formatMoney(inv.amount)}</td>
                </tr>
              </tbody>
            </table>

            <div className="ml-auto mt-6 w-72 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="font-mono text-ink">{formatMoney(inv.amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Discount</span><span className="font-mono text-ink">−{formatMoney(inv.discount)}</span></div>
              <div className="flex justify-between border-t border-border pt-3 text-base">
                <span className="font-semibold text-ink">Total</span>
                <span className="font-mono font-semibold text-ink">{formatMoney(inv.total)}</span>
              </div>
            </div>

            {inv.notes && (
              <div className="mt-10 rounded-lg bg-canvas p-4 text-sm text-ink print:border print:border-border print:bg-transparent">
                <p className="mb-1 text-xs text-muted">Notes</p><p className="whitespace-pre-line">{inv.notes}</p>
              </div>
            )}

            <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted">
              Thank you for choosing {CLINIC.name}. Please quote <span className="font-mono">{inv.number}</span> with any payment.
            </footer>
          </>
        )}
      </article>
    </div>
  );
}

export default function InvoicePrintPage() {
  return <AuthGuard><InvoiceDocument /></AuthGuard>;
}