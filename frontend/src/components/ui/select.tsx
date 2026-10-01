import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function SelectField({ label, error, id, className, children, ...props }:
  React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const selectId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "h-11 w-full appearance-none rounded-lg border bg-surface pl-3.5 pr-10 text-sm text-ink transition",
            "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15",
            error ? "border-danger" : "border-border", className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}