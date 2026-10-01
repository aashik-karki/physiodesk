import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Therapist, TherapistDeleted, TherapistInput } from "@/lib/types";

const KEY = ["therapists"] as const;

export function useTherapists(search = "") {
  return useQuery({
    queryKey: [...KEY, { search }],
    queryFn: () =>
      api<Therapist[]>(`/therapists${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
}

export function useSaveTherapist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: TherapistInput }) =>
      id
        ? api<Therapist>(`/therapists/${id}`, { method: "PATCH", json: data })
        : api<Therapist>("/therapists", { method: "POST", json: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveTherapist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<TherapistDeleted>(`/therapists/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}