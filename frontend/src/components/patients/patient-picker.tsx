"use client";

import { Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { usePatients } from "@/lib/queries/patients";
import type { Patient } from "@/lib/types";

/** Search-as-you-type patient chooser. Shows the chosen patient as a chip. */
export function PatientPicker({ value, onChange, error }: {
  value: Patient | null;
  onChange: (p: Patient | null) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const search = useDeferredValue(query.trim());
  const { data, isFetching } = usePatients({ search, therapistId: null, status: null, page: 1 });

  if (value) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-ink">Patient</p>
        <div className="flex h-11 items-center gap-3 rounded-lg border border-border bg-canvas/60 px-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-ink">
            {initials(value.full_name)}
          </span>
          <span className="flex-1 truncate text-sm font-medium text-ink">{value.full_name}</span>
          <span className="font-mono text-xs text-muted">{value.phone}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="Change patient"
            className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-1.5">
      <label htmlFor="patient-search" className="block text-sm font-medium text-ink">Patient</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input id="patient-search" value={query} autoComplete="off" placeholder="Search by name or phone"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} // let a click on a result land first
          className={cn("h-11 w-full rounded-lg border bg-surface pl-10 pr-3.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15",
            error ? "border-danger" : "border-border")} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {open && (
        <ul role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-card">
          {data?.items.length ? data.items.map((p) => (
            <li key={p.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(p); setQuery(""); setOpen(false); }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-canvas">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-ink">
                  {initials(p.full_name)}
                </span>
                <span className="flex-1 text-sm text-ink">{p.full_name}</span>
                <span className="font-mono text-xs text-muted">{p.phone}</span>
              </button>
            </li>
          )) : (
            <li className="px-3 py-3 text-sm text-muted">{isFetching ? "Searching…" : "No patients found"}</li>
          )}
        </ul>
      )}
    </div>
  );
}