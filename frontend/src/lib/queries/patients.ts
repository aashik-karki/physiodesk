import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Package, Page, Patient, PatientInput, PatientStatus } from "@/lib/types";

const KEY = ["patients"] as const;

export interface PatientFilters {
  search: string;
  therapistId: number | null;
  status: PatientStatus | null;
  page: number;
}

export const PAGE_SIZE = 10;

export function usePatients(f: PatientFilters) {
  const params = new URLSearchParams({ page: String(f.page), page_size: String(PAGE_SIZE) });
  if (f.search) params.set("search", f.search);
  if (f.therapistId) params.set("therapist_id", String(f.therapistId));
  if (f.status) params.set("status", f.status);
  return useQuery({
    queryKey: [...KEY, "list", f],
    queryFn: () => api<Page<Patient>>(`/patients?${params}`),
    placeholderData: keepPreviousData, // keep the old page visible while the next one loads
  });
}

export function usePatient(id: number) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => api<Patient>(`/patients/${id}`),
  });
}

export function useSavePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: PatientInput }) =>
      id
        ? api<Patient>(`/patients/${id}`, { method: "PATCH", json: data })
        : api<Patient>("/patients", { method: "POST", json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["therapists"] }); // assignments can change counts
    },
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/patients/${id}`, { method: "DELETE" }),
    // Refresh the lists only: re-fetching the deleted patient's detail would just 404.
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "list"] }),
  });
}

export function usePackages() {
  return useQuery({
    queryKey: ["packages"],
    queryFn: () => api<Package[]>("/packages"),
    staleTime: 5 * 60_000, // packages rarely change
  });
}