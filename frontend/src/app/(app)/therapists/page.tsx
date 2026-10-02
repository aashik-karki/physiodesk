"use client";

import { Plus, Search, Stethoscope } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { RemoveTherapistDialog } from "@/components/therapists/remove-therapist-dialog";
import { ScheduleExceptionsDialog } from "@/components/therapists/schedule-exceptions-dialog";
import { TherapistForm } from "@/components/therapists/therapist-form";
import { TherapistTable } from "@/components/therapists/therapist-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FilterSelect } from "@/components/ui/filter-select";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/queries/therapists";
import type { Therapist } from "@/lib/types";

type Duty = "all" | "on" | "off";

export default function TherapistsPage() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [duty, setDuty] = useState<Duty>("all");
  const [specialty, setSpecialty] = useState("all");
  const deferredSearch = useDeferredValue(search.trim()); // don't refetch on every keystroke
  const { data: therapists, isPending, error } = useTherapists(deferredSearch);

  // `editing`: undefined = closed, null = adding, Therapist = editing that one
  const [editing, setEditing] = useState<Therapist | null | undefined>(undefined);
  const [removing, setRemoving] = useState<Therapist | null>(null);
  const [exceptionsFor, setExceptionsFor] = useState<Therapist | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const specialties = [...new Set(therapists?.map((t) => t.specialty))].sort();
  const shown = (therapists ?? []).filter((t) =>
    (duty === "all" || (duty === "on") === t.on_duty_today) && (specialty === "all" || t.specialty === specialty));
  const filtered = Boolean(deferredSearch) || duty !== "all" || specialty !== "all";
  const onDuty = therapists?.filter((t) => t.on_duty_today).length ?? 0;
  const patientsToday = therapists?.reduce((sum, t) => sum + t.patients_today, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Therapists"
        subtitle={therapists
          ? `${therapists.length} ${therapists.length === 1 ? "therapist" : "therapists"} · ${onDuty} on duty today · ${patientsToday} ${patientsToday === 1 ? "patient" : "patients"} today`
          : " "}
        actions={isAdmin && (
          <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add therapist</Button>
        )}
      />

      <main className="space-y-5 p-8">
        {notice && <Alert tone="success">{notice}</Alert>}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or specialty" aria-label="Search therapists"
              className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </div>
          <FilterSelect label="Filter by specialty" value={specialty} onChange={setSpecialty}
            options={[{ value: "all", label: "All specialties" }, ...specialties.map((s) => ({ value: s, label: s }))]} />
          <FilterSelect label="Filter by availability today" value={duty} onChange={(v) => setDuty(v as Duty)}
            options={[{ value: "all", label: "Any availability" }, { value: "on", label: "On duty today" }, { value: "off", label: "Off today" }]} />
        </div>

        <Card className="overflow-hidden">
          {error ? (
            <div className="p-5"><Alert>Couldn&apos;t load therapists: {error.message}</Alert></div>
          ) : isPending ? (
            <div className="space-y-3 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title={filtered ? "No therapists match" : "No therapists yet"}
              text={filtered ? "Try a different search or filter." : "Add your first therapist to start booking appointments."}
              action={isAdmin && !filtered && (
                <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add therapist</Button>
              )}
            />
          ) : (
            <TherapistTable therapists={shown} canManage={isAdmin}
              onEdit={setEditing} onRemove={setRemoving} onExceptions={setExceptionsFor} />
          )}
        </Card>
      </main>

      {editing !== undefined && (
        <TherapistForm key={editing?.id ?? "new"} open therapist={editing} onClose={() => setEditing(undefined)} />
      )}
      {exceptionsFor && <ScheduleExceptionsDialog therapist={exceptionsFor} onClose={() => setExceptionsFor(null)} />}
      <RemoveTherapistDialog therapist={removing} onClose={() => setRemoving(null)} onRemoved={setNotice} />
    </>
  );
}
