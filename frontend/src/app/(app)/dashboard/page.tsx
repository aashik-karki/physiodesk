"use client";

import { ArrowRight, CalendarClock, Plus, Stethoscope, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CapacityList, UpNext } from "@/components/dashboard/capacity-list";
import { PageHeader } from "@/components/layout/page-header";
import { BookingForm } from "@/components/schedule/booking-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuth } from "@/lib/auth";
import { formatDate, formatLongDate, formatMoney, initials, todayISO } from "@/lib/format";
import { useDashboard } from "@/lib/queries/dashboard";

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** "HH:MM:SS" for now, refreshed every minute (used to hide finished appointments). */
function useClock() {
  const read = () => new Date().toTimeString().slice(0, 8);
  const [now, setNow] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setNow(read()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const ViewAll = ({ href }: { href: string }) => (
  <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
    View all <ArrowRight className="h-3.5 w-3.5" />
  </Link>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isPending, error } = useDashboard();
  const now = useClock();
  const [booking, setBooking] = useState(false);
  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader title={`${greeting(Number(now.slice(0, 2)))}, ${firstName}`} subtitle={formatLongDate(todayISO())}
        actions={<Button onClick={() => setBooking(true)}><Plus className="h-4 w-4" /> Book appointment</Button>} />

      <main className="space-y-6 p-8">
        {error ? <Alert>Couldn&apos;t load the dashboard: {error.message}</Alert> : (
          <>
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Today at a glance">
              {isPending ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-card" />) : (
                <>
                  <StatCard label="Patients today" icon={Users} value={data.stats.patients_today}
                    hint={`${data.stats.appointments_today} appointments · ${data.stats.appointments_completed} completed`} />
                  <StatCard label="Therapists on duty" icon={Stethoscope} value={data.stats.therapists_on_duty}
                    hint={data.stats.therapists_on_duty ? "Working today" : "Nobody scheduled today"} />
                  <StatCard label="Revenue today" icon={Wallet} value={formatMoney(data.stats.revenue_today)}
                    hint={<>Outstanding <span className="font-mono">{formatMoney(data.stats.outstanding_due)}</span></>} />
                  <StatCard label="Open slots left" icon={CalendarClock} value={data.stats.open_slots_remaining}
                    hint="Still bookable today" />
                </>
              )}
            </section>

            <div className="grid gap-6 xl:grid-cols-5">
              <Card className="xl:col-span-3">
                <CardHeader title="Therapist capacity today" action={<ViewAll href="/schedule" />} />
                {isPending ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
                  : data.capacity.length ? <CapacityList days={data.capacity} />
                  : <EmptyState icon={Stethoscope} title="No one on duty today" text="Days off and non-working days show up here." />}
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader title="Up next" action={<ViewAll href="/schedule" />} />
                {isPending ? <div className="space-y-3 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                  : <UpNext days={data.capacity} now={now} />}
              </Card>
            </div>

            <Card>
              <CardHeader title="Recently registered patients" action={<ViewAll href="/patients" />} />
              {isPending ? <div className="space-y-3 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                : data.recent_patients.length === 0 ? (
                  <EmptyState icon={Users} title="No patients yet" text="New registrations will appear here." />
                ) : (
                  <ul className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
                    {data.recent_patients.map((p) => (
                      <li key={p.id}>
                        <Link href={`/patients/${p.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-canvas/70">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-ink">
                            {initials(p.full_name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{p.full_name}</p>
                            <p className="truncate text-xs text-muted">{p.condition} · {formatDate(p.created_at)}</p>
                          </div>
                          <StatusPill status={p.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
            </Card>
          </>
        )}
      </main>

      {booking && <BookingForm preset={{ date: todayISO() }} onClose={() => setBooking(false)} />}
    </>
  );
}