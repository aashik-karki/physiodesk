"use client";

import { ArrowLeft, CalendarDays, MapPin, Package as PackageIcon, Pencil, Phone, Plus, Stethoscope, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { BillingHistory } from "@/components/patients/billing-history";
import { DeletePatientDialog } from "@/components/patients/delete-patient-dialog";
import { PatientForm } from "@/components/patients/patient-form";
import { SessionHistory } from "@/components/patients/session-history";
import { BookingForm } from "@/components/schedule/booking-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate, formatMoney, initials, todayISO } from "@/lib/format";
import { usePackages, usePatient } from "@/lib/queries/patients";

function Detail({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-0.5 text-sm text-ink">{children}</dd>
      </div>
    </div>
  );
}

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: p, isPending, error } = usePatient(Number(id));
  const { data: packages } = usePackages();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [booking, setBooking] = useState(false);

  const back = (
    <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> All patients
    </Link>
  );

  if (error) return <main className="space-y-4 p-8">{back}<Alert>{error.message}</Alert></main>;
  if (isPending) {
    return (
      <main className="space-y-6 p-8">{back}
        <Skeleton className="h-20 w-1/2" />
        <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64 lg:col-span-2" /></div>
      </main>
    );
  }

  const pkg = packages?.find((x) => x.id === p.package?.id);

  return (
    <>
      <PageHeader title="Patient profile" actions={
        <>
          <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="danger-ghost" onClick={() => setDeleting(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </>
      } />

      <main className="space-y-6 p-8">
        {back}

        {/* Identity */}
        <Card className="flex flex-wrap items-center gap-5 p-6">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-soft font-display text-2xl font-semibold text-primary-ink">
            {initials(p.full_name)}
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-semibold text-ink">{p.full_name}</h2>
              <StatusPill status={p.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {p.age} years · <span className="capitalize">{p.gender}</span> · Patient #{p.id}
            </p>
          </div>
          <div className="rounded-xl bg-canvas px-4 py-3 text-right">
            <p className="text-xs text-muted">Condition</p>
            <p className="font-medium text-ink">{p.condition}</p>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader title="Details" />
            <dl className="space-y-4 p-5">
              <Detail icon={Phone} label="Phone"><span className="font-mono">{p.phone}</span></Detail>
              <Detail icon={MapPin} label="Address">{p.address ?? <span className="text-muted">Not provided</span>}</Detail>
              <Detail icon={Stethoscope} label="Assigned therapist">
                {p.therapist?.full_name ?? <span className="text-muted">Unassigned</span>}
              </Detail>
              <Detail icon={PackageIcon} label="Package">
                {pkg ? <>{pkg.name} <span className="text-muted">· {pkg.session_count} session{pkg.session_count === 1 ? "" : "s"} · <span className="font-mono">{formatMoney(pkg.price)}</span></span></>
                  : p.package?.name ?? <span className="text-muted">None</span>}
              </Detail>
              <Detail icon={CalendarDays} label="Registered">{formatDate(p.created_at)}</Detail>
              {p.notes && (
                <div className="rounded-lg bg-canvas p-3.5 text-sm text-ink">
                  <p className="mb-1 text-xs text-muted">Notes</p>
                  <p className="whitespace-pre-line">{p.notes}</p>
                </div>
              )}
            </dl>
          </Card>

          <div className="space-y-6 lg:col-span-2">
            <SessionHistory patientId={p.id} action={
              <Button variant="secondary" size="sm" onClick={() => setBooking(true)}>
                <Plus className="h-4 w-4" /> Book
              </Button>
            } />
            <BillingHistory patient={p} />
          </div>
        </div>
      </main>

      {editing && <PatientForm patient={p} onClose={() => setEditing(false)} />}
      {booking && <BookingForm preset={{ date: todayISO(), patient: p }} onClose={() => setBooking(false)} />}
      {deleting && <DeletePatientDialog patient={p} onClose={() => setDeleting(false)} onDeleted={() => router.replace("/patients")} />}
    </>
  );
}