import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Appointment, AppointmentInput, AppointmentStatus, DaySchedule, Page, ScheduleOverride, Slot,
} from "@/lib/types";

/** Booking changes ripple into the grid, lists, therapist counts and (later) the dashboard. */
function refreshAfterBookingChange(qc: QueryClient) {
  for (const key of ["schedule", "appointments", "therapists", "dashboard"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export function useDaySchedule(date: string) {
  return useQuery({
    queryKey: ["schedule", "day", date],
    queryFn: () => api<DaySchedule>(`/schedule?date=${date}`),
    refetchInterval: 60_000, // keep the grid fresh if two people are booking at once
  });
}

export function useAvailability(therapistId: number | null, date: string) {
  return useQuery({
    queryKey: ["schedule", "availability", therapistId, date],
    queryFn: () => api<Slot[]>(`/schedule/availability?therapist_id=${therapistId}&date=${date}`),
    enabled: Boolean(therapistId && date),
  });
}

export function useAppointment(id: number | null) {
  return useQuery({
    queryKey: ["appointments", "detail", id],
    queryFn: () => api<Appointment>(`/appointments/${id}`),
    enabled: id !== null,
  });
}

export function usePatientAppointments(patientId: number, page = 1) {
  return useQuery({
    queryKey: ["appointments", "patient", patientId, page],
    queryFn: () => api<Page<Appointment>>(`/appointments?patient_id=${patientId}&page=${page}&page_size=10`),
  });
}

export function useBookAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppointmentInput) => api<Appointment>("/appointments", { method: "POST", json: data }),
    onSuccess: () => refreshAfterBookingChange(qc),
  });
}

export interface AppointmentPatch {
  therapist_id?: number;
  date?: string;
  start_time?: string;
  status?: AppointmentStatus;
  notes?: string | null;
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AppointmentPatch }) =>
      api<Appointment>(`/appointments/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => refreshAfterBookingChange(qc),
  });
}

// ---- therapist schedule overrides (admin) ----

export function useOverrides(therapistId: number) {
  return useQuery({
    queryKey: ["schedule", "overrides", therapistId],
    queryFn: () => api<ScheduleOverride[]>(`/therapists/${therapistId}/overrides`),
  });
}

export interface OverrideInput {
  is_off: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export function useSetOverride(therapistId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: OverrideInput }) =>
      api<ScheduleOverride>(`/therapists/${therapistId}/overrides/${date}`, { method: "PUT", json: data }),
    onSuccess: () => refreshAfterBookingChange(qc),
  });
}

export function useDeleteOverride(therapistId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      api<void>(`/therapists/${therapistId}/overrides/${date}`, { method: "DELETE" }),
    onSuccess: () => refreshAfterBookingChange(qc),
  });
}