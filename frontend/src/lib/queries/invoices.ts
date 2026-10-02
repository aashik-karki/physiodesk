import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Invoice, InvoiceInput, InvoicePage, InvoiceStatus, PaymentMethod } from "@/lib/types";

export const INVOICE_PAGE_SIZE = 10;

export interface InvoiceFilters {
  status: InvoiceStatus | null;
  search: string;
  patientId?: number;
  page: number;
}

function refresh(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["invoices"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] }); // revenue / outstanding change
}

export function useInvoices(f: InvoiceFilters) {
  const params = new URLSearchParams({ page: String(f.page), page_size: String(INVOICE_PAGE_SIZE) });
  if (f.status) params.set("status", f.status);
  if (f.search) params.set("search", f.search);
  if (f.patientId) params.set("patient_id", String(f.patientId));
  return useQuery({
    queryKey: ["invoices", "list", f],
    queryFn: () => api<InvoicePage>(`/invoices?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: number) {
  return useQuery({ queryKey: ["invoices", "detail", id], queryFn: () => api<Invoice>(`/invoices/${id}`) });
}

export function useSaveInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: Partial<InvoiceInput> }) =>
      id
        ? api<Invoice>(`/invoices/${id}`, { method: "PATCH", json: data })
        : api<Invoice>("/invoices", { method: "POST", json: data }),
    onSuccess: () => refresh(qc),
  });
}

export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: number; method: PaymentMethod }) =>
      api<Invoice>(`/invoices/${id}`, { method: "PATCH", json: { status: "paid", payment_method: method } }),
    onSuccess: () => refresh(qc),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<Invoice>(`/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => refresh(qc),
  });
}