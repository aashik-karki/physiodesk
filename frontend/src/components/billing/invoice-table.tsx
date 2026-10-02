"use client";

import { CheckCircle2, Pencil, Printer, XCircle } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate, formatMoney } from "@/lib/format";
import type { Invoice } from "@/lib/types";

const ACTION = "rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-ink";

export function InvoiceTable({ invoices, canManage, showPatient = true, onPay, onEdit, onVoid }: {
  invoices: Invoice[];
  canManage: boolean;
  showPatient?: boolean;
  onPay?: (inv: Invoice) => void;
  onEdit?: (inv: Invoice) => void;
  onVoid?: (inv: Invoice) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-canvas/60 text-left text-xs font-semibold uppercase tracking-wider text-muted">
            <th className="px-4 py-3">Invoice</th>
            {showPatient && <th className="px-4 py-3">Patient</th>}
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Issued</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((inv) => {
            const isVoid = inv.status === "void";
            return (
              <tr key={inv.id} className="hover:bg-canvas/50">
                <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[13px] font-medium text-ink">{inv.number}</td>
                {showPatient && (
                  <td className="whitespace-nowrap px-4 py-3.5">
                    {inv.patient_id
                      ? <Link href={`/patients/${inv.patient_id}`} className="text-ink hover:text-primary hover:underline">{inv.patient_name}</Link>
                      : <span className="text-muted" title="Patient record was deleted">{inv.patient_name}</span>}
                  </td>
                )}
                <td className="max-w-60 truncate px-4 py-3.5 text-ink" title={inv.service}>{inv.service}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-muted">{formatDate(inv.issued_on)}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-[13px]">
                  <span className={isVoid ? "text-muted line-through" : "font-semibold text-ink"}>{formatMoney(inv.total)}</span>
                  {Number(inv.discount) > 0 && !isVoid && (
                    <span className="block text-[11px] font-normal text-muted">−{formatMoney(inv.discount)} discount</span>
                  )}
                </td>
                <td className="px-4 py-3.5"><StatusPill status={inv.status} /></td>
                <td className="px-4 py-3.5">
                  <div className="flex justify-end gap-0.5 whitespace-nowrap">
                    {canManage && inv.status === "due" && (
                      <button onClick={() => onPay?.(inv)} className={`${ACTION} hover:text-success`} title="Record payment" aria-label={`Record payment for ${inv.number}`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    {canManage && !isVoid && (
                      <button onClick={() => onEdit?.(inv)} className={ACTION} title="Edit" aria-label={`Edit ${inv.number}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <Link href={`/invoices/${inv.id}`} className={ACTION} title="View / print" aria-label={`Print ${inv.number}`}>
                      <Printer className="h-4 w-4" />
                    </Link>
                    {canManage && !isVoid && (
                      <button onClick={() => onVoid?.(inv)} className={`${ACTION} hover:bg-danger-soft hover:text-danger`} title="Void" aria-label={`Void ${inv.number}`}>
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}