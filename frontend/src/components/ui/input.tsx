import { cn } from "@/lib/cn";

export function Field({ label, error, id, className, ...props }:
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const inputId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">{label}</label>
      <input
        id={inputId}
        className={cn(
          "h-11 w-full rounded-lg border bg-surface px-3.5 text-sm text-ink transition",
          "placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}