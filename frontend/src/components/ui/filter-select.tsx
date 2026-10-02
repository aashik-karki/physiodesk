import { ChevronDown } from "lucide-react";

/** Compact dropdown for table toolbars (no visible label; `label` is for screen readers). */
export function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="h-10 appearance-none rounded-lg border border-border bg-surface pl-3.5 pr-10 text-sm text-ink focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}
