import type { LucideIcon } from "lucide-react";
import { Card } from "./card";

export function StatCard({ label, value, hint, icon: Icon }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon: LucideIcon;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary-ink">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-3 font-display text-[34px] font-semibold leading-none text-ink">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </Card>
  );
}