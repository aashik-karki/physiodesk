"use client";

import { ChevronDown, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DeletePatientDialog } from "@/components/patients/delete-patient-dialog";
import { PatientForm } from "@/components/patients/patient-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";
import { PATIENT_STATUSES, formatDate, initials } from "@/lib/format";
import { PAGE_SIZE, usePatients } from "@/lib/queries/patients";
import { useTherapists } from "@/lib/queries/therapists";
import type { Patient, PatientStatus } from "@/lib/types";

const COLUMNS = ["Patient", "Phone", "Condition", "Therapist", "Status", "Registered", ""];

export default function PatientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [therapistId, setTherapistId] = useState<number | null>(null);
  const [status, setStatus] = useState<PatientStatus | null>(null);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const { data, isPending, isFetching, error } = usePatients({ search: deferredSearch, therapistId, status, page });
  const { data: therapists } = useTherapists();

  const [editing, setEditing] = useState<Patient | null | undefined>(undefined); // undefined = closed
  const [deleting, setDeleting] = useState<Patient | null>(null);

  const filtered = Boolean(deferredSearch || therapistId || status);
  // Any filter change goes back to page 1.
  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={data ? `${data.total} ${filtered ? "matching" : "registered"} patient${data.total === 1 ? "" : "s"}` : " "}
        actions={<Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add patient</Button>}
      />

      <main className="space-y-5 p-8">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input type="search" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)}
              placeholder="Search name or phone" aria-label="Search patients"
              className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3.5 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15" />
          </div>
          <div className="relative">
            <select value={therapistId ?? ""} aria-label="Filter by therapist"
              onChange={(e) => resetPage(setTherapistId)(e.target.value ? Number(e.target.value) : null)}
              className="h-10 appearance-none rounded-lg border border-border bg-surface pl-3.5 pr-10 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15">
              <option value="">All therapists</option>
              {therapists?.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
          <div className="flex rounded-lg border border-border bg-surface p-1" role="group" aria-label="Filter by status">
            {[{ value: null, label: "All" }, ...PATIENT_STATUSES].map((s) => (
              <button key={s.label} onClick={() => resetPage(setStatus)(s.value as PatientStatus | null)}
                aria-pressed={status === s.value}
                className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition",
                  status === s.value ? "bg-secondary text-white" : "text-muted hover:text-ink")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <Card className={cn("overflow-hidden transition-opacity", isFetching && !isPending && "opacity-70")}>
          {error ? (
            <div className="p-5"><Alert>Couldn&apos;t load patients: {error.message}</Alert></div>
          ) : isPending ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : data.items.length === 0 ? (
            <EmptyState icon={Users}
              title={filtered ? "No patients match these filters" : "No patients yet"}
              text={filtered ? "Try a different search, therapist or status." : "Register your first patient to get started."}
              action={!filtered && <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add patient</Button>} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-canvas/60 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                      {COLUMNS.map((c) => <th key={c} className="px-5 py-3 font-semibold">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((p) => (
                      <tr key={p.id} onClick={() => router.push(`/patients/${p.id}`)}
                        className="cursor-pointer transition-colors hover:bg-canvas/70">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
                              {initials(p.full_name)}
                            </span>
                            <div>
                              <p className="font-medium text-ink">{p.full_name}</p>
                              <p className="text-xs text-muted">{p.age} yrs · <span className="capitalize">{p.gender}</span></p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] text-ink">{p.phone}</td>
                        <td className="max-w-56 truncate px-5 py-3.5 text-ink" title={p.condition}>{p.condition}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-ink">
                          {p.therapist?.full_name ?? <span className="text-muted">Unassigned</span>}
                        </td>
                        <td className="px-5 py-3.5"><StatusPill status={p.status} /></td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted">{formatDate(p.created_at)}</td>
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setEditing(p)} aria-label={`Edit ${p.full_name}`} title="Edit"
                              className="rounded-lg p-2 text-muted transition hover:bg-surface hover:text-ink">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleting(p)} aria-label={`Delete ${p.full_name}`} title="Delete"
                              className="rounded-lg p-2 text-muted transition hover:bg-danger-soft hover:text-danger">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
            </>
          )}
        </Card>
      </main>

      {editing !== undefined && <PatientForm key={editing?.id ?? "new"} patient={editing} onClose={() => setEditing(undefined)} />}
      {deleting && <DeletePatientDialog patient={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}