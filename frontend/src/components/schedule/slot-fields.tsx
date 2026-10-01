"use client";

import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { formatTime, todayISO } from "@/lib/format";
import { useAvailability } from "@/lib/queries/schedule";
import { useTherapists } from "@/lib/queries/therapists";

export interface SlotChoice {
  therapistId: number | null;
  date: string;
  startTime: string; // "09:00:00", or "" when nothing is chosen
}

/** Therapist + date + open-slot pickers, shared by booking and rescheduling.
 *  `keepSlot` keeps a slot listed that the API no longer reports as open
 *  (e.g. the appointment's own current slot while rescheduling). */
export function SlotFields({ value, onChange, keepSlot, error }: {
  value: SlotChoice;
  onChange: (v: SlotChoice) => void;
  keepSlot?: { therapistId: number; date: string; start: string; end: string };
  error?: string;
}) {
  const { data: therapists } = useTherapists();
  const { data: slots, isFetching } = useAvailability(value.therapistId, value.date);

  const options = [...(slots ?? [])];
  if (keepSlot && keepSlot.therapistId === value.therapistId && keepSlot.date === value.date
      && !options.some((s) => s.start === keepSlot.start)) {
    options.push({ start: keepSlot.start, end: keepSlot.end, state: "open", out_of_hours: false, appointment: null });
    options.sort((a, b) => a.start.localeCompare(b.start));
  }

  const noSlots = value.therapistId && !isFetching && options.length === 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SelectField label="Therapist" name="therapist" value={value.therapistId ?? ""}
        onChange={(e) => onChange({ ...value, therapistId: e.target.value ? Number(e.target.value) : null, startTime: "" })}>
        <option value="" disabled>Select therapist</option>
        {therapists?.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
      </SelectField>
      <Field label="Date" name="date" type="date" min={todayISO()} value={value.date}
        onChange={(e) => onChange({ ...value, date: e.target.value, startTime: "" })} />
      <SelectField label="Time slot" name="slot" value={value.startTime} error={error}
        disabled={!value.therapistId || options.length === 0}
        onChange={(e) => onChange({ ...value, startTime: e.target.value })}>
        <option value="" disabled>
          {!value.therapistId ? "Pick a therapist first" : isFetching ? "Loading…" : noSlots ? "No open slots" : "Select a time"}
        </option>
        {options.map((s) => (
          <option key={s.start} value={s.start}>{formatTime(s.start)} – {formatTime(s.end)}</option>
        ))}
      </SelectField>
      {noSlots && (
        <p className="text-xs text-muted sm:col-span-3">
          No open slots: the therapist is off, fully booked, or the remaining slots have passed. Try another date.
        </p>
      )}
    </div>
  );
}