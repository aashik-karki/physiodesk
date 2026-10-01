import { AlertCircle, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function Alert({ tone = "danger", children }: { tone?: "danger" | "success"; children: React.ReactNode }) {
  const Icon = tone === "danger" ? AlertCircle : CheckCircle2;
  return (
    <div role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-lg px-3.5 py-3 text-sm",
        tone === "danger" ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: {
  icon: LucideIcon; title: string; text?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
        <Icon className="h-6 w-6" strokeWidth={1.8} />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-border/60", className)} />;
}