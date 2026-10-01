"use client";

import { Plus, Search, Stethoscope } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { RemoveTherapistDialog } from "@/app/(app)/therapists/remove-therapist-dialog";
import { TherapistCard } from "@/app/(app)/therapists/therapist-card";
import { TherapistForm } from "@/app/(app)/therapists/therapist-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { useAuth } from "@/lib/auth";
import { useTherapists } from "@/lib/queries/therapists";
import type { Therapist } from "@/lib/types";

export default function TherapistsPage() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim()); // don't refetch on every keystroke
  const { data: therapists, isPending, error } = useTherapists(deferredSearch);

  // `editing`: undefined = closed, null = adding, Therapist = editing that one
  const [editing, setEditing] = useState<Therapist | null | undefined>(undefined);
  const [removing, setRemoving] = useState<Therapist | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onDuty = therapists?.filter((t) => t.on_duty_today).length ?? 0;
  const patientsToday = therapists?.reduce((sum, t) => sum + t.patients_today, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Therapists"
        subtitle={isAdmin ? "Manage your team, their working days and session lengths." : "Your clinic's team and their working hours."}
        actions={isAdmin && (
          <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add therapist</Button>
        )}
      />

      <main className="space-y-6 p-8">
        {notice && <Alert tone="success">{notice}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or specialty" aria-label="Search therapists"
              className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </div>
          {therapists && (
            <div className="flex gap-6 text-sm text-muted">
              <span><span className="font-mono font-semibold text-ink">{therapists.length}</span> {therapists.length === 1 ? "therapist" : "therapists"}</span>
              <span><span className="font-mono font-semibold text-ink">{onDuty}</span> on duty today</span>
              <span><span className="font-mono font-semibold text-ink">{patientsToday}</span> {patientsToday === 1 ? "patient" : "patients"} today</span>
            </div>
          )}
        </div>

        {error ? (
          <Alert>Couldn&apos;t load therapists: {error.message}</Alert>
        ) : isPending ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="space-y-4 p-5">
                <div className="flex gap-4"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/3" /></div></div>
                <Skeleton className="h-7 w-full" /><Skeleton className="h-10 w-full" />
              </Card>
            ))}
          </div>
        ) : therapists.length === 0 ? (
          <Card>
            <EmptyState
              icon={Stethoscope}
              title={deferredSearch ? "No therapists match your search" : "No therapists yet"}
              text={deferredSearch ? "Try a different name or specialty." : "Add your first therapist to start booking appointments."}
              action={isAdmin && !deferredSearch && (
                <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add therapist</Button>
              )}
            />
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {therapists.map((t) => (
              <TherapistCard key={t.id} therapist={t} canManage={isAdmin}
                onEdit={() => setEditing(t)} onRemove={() => setRemoving(t)} />
            ))}
          </div>
        )}
      </main>

      {editing !== undefined && (
        <TherapistForm key={editing?.id ?? "new"} open therapist={editing} onClose={() => setEditing(undefined)} />
      )}
      <RemoveTherapistDialog therapist={removing} onClose={() => setRemoving(null)} onRemoved={setNotice} />
    </>
  );
}