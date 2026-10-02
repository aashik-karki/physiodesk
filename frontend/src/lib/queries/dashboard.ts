import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Dashboard } from "@/lib/types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard?recent=6"),
    refetchInterval: 60_000, // live numbers: refresh every minute
  });
}