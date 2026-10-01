"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { AppointmentDialog } from "@/components/schedule/appointment-dialog";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill } from "@/components/ui/status-pill";
import { SESSION_TYPES, formatDate, formatTime, labelOf } from "@/lib/format";
import { usePatientAppointments } from "@/lib/queries/schedule";

export function SessionHistory({ patientId, action }: { patientId: number; action?: React.ReactNode }) {
  const [page, setPage] = useState(1);
  const { data, isPending, error } = usePatientAppointments(patientId, page);
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader title="Session history" action={action} />
      {error ? <div className="p-5"><Alert>{error.message}</Alert></div>
        : isPending ? <div className="space-y-2 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        : data.items.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No sessions yet" text="Appointments booked for this patient will appear here." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-canvas/60 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5">Date</th><th className="px-5 py-2.5">Time</th>
                  <th className="px-5 py-2.5">Therapist</th><th className="px-5 py-2.5">Type</th><th className="px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((a) => (
                  <tr key={a.id} onClick={() => setOpenId(a.id)} className="cursor-pointer hover:bg-canvas/70">
                    <td className="whitespace-nowrap px-5 py-3 text-ink">{formatDate(a.date)}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-ink">{formatTime(a.start_time)}</td>
                    <td className="px-5 py-3 text-ink">{a.therapist.full_name}</td>
                    <td className="px-5 py-3 text-muted">{labelOf(SESSION_TYPES, a.session_type)}</td>
                    <td className="px-5 py-3"><StatusPill status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.total > data.page_size && <Pagination page={page} pageSize={data.page_size} total={data.total} onChange={setPage} />}
          </>
        )}
      {openId !== null && <AppointmentDialog appointmentId={openId} onClose={() => setOpenId(null)} />}
    </Card>
  );
}