"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AppointmentDialog } from "@/components/schedule/appointment-dialog";
import { BookingForm, type BookingPreset } from "@/components/schedule/booking-form";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { ScheduleExceptionsDialog } from "@/components/therapists/schedule-exceptions-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { useAuth } from "@/lib/auth";
import { addDays, formatLongDate, todayISO } from "@/lib/format";
import { useDaySchedule } from "@/lib/queries/schedule";

const ICON_BTN =
  "grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-ink transition hover:bg-canvas";

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${cls}`} />{label}</span>
  );
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
      {item("border border-dashed border-muted bg-surface", "Open")}
      {item("border-l-[3px] border-primary bg-primary-soft", "Booked")}
      {item("border-l-[3px] border-tertiary bg-tertiary-soft", "Completed")}
      {item("border-l-[3px] border-danger bg-danger-soft", "No-show")}
    </div>
  );
}

export default function SchedulePage() {
  const { isAdmin } = useAuth();
  const [date, setDate] = useState(todayISO());
  const { data: day, isPending, error } = useDaySchedule(date);

  const [booking, setBooking] = useState<BookingPreset | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [hoursFor, setHoursFor] = useState<{ id: number; full_name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isToday = date === todayISO();
  const working = day?.therapists.filter((t) => !t.is_off) ?? [];
  const booked = working.reduce((n, t) => n + t.booked_count, 0);
  const open = working.reduce((n, t) => n + t.open_count, 0);

  return (
    <>
      <PageHeader title="Schedule" subtitle={formatLongDate(date) + (isToday ? " · Today" : "")}
        actions={<Button onClick={() => setBooking({ date })}><Plus className="h-4 w-4" /> Book appointment</Button>} />

      <main className="space-y-5 p-8">
        {notice && <Alert tone="success">{notice}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button className={ICON_BTN} onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Button variant="secondary" onClick={() => setDate(todayISO())} disabled={isToday}>Today</Button>
            <button className={ICON_BTN} onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Pick a date"
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15" />
            {day && (
              <span className="ml-2 text-sm text-muted">
                <span className="font-mono text-ink">{working.length}</span> on duty ·{" "}
                <span className="font-mono text-ink">{booked}</span> booked ·{" "}
                <span className="font-mono text-ink">{open}</span> open
              </span>
            )}
          </div>
          <Legend />
        </div>

        {error ? (
          <Alert>Couldn&apos;t load the schedule: {error.message}</Alert>
        ) : isPending ? (
          <div className="flex gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[520px] w-60" />)}</div>
        ) : day.therapists.length === 0 ? (
          <Card><EmptyState icon={CalendarDays} title="No therapists yet" text="Add therapists first, then their slots appear here." /></Card>
        ) : (
          <ScheduleGrid day={day} canManage={isAdmin}
            onBook={(therapistId, startTime) => setBooking({ therapistId, date, startTime })}
            onOpenAppointment={setOpenId}
            onEditHours={setHoursFor} />
        )}
      </main>

      {booking && <BookingForm preset={booking} onClose={() => setBooking(null)} onBooked={setNotice} />}
      {openId !== null && <AppointmentDialog appointmentId={openId} onClose={() => setOpenId(null)} onChanged={setNotice} />}
      {hoursFor && <ScheduleExceptionsDialog therapist={hoursFor} initialDate={date} onClose={() => setHoursFor(null)} />}
    </>
  );
}