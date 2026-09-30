import { CalendarClock, Stethoscope, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader title="Dashboard" subtitle={today} actions={<Button>Book appointment</Button>} />
      <main className="space-y-6 p-8">
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Patients today" value="—" icon={Users} />
          <StatCard label="Therapists on duty" value="—" icon={Stethoscope} />
          <StatCard label="Revenue today" value="—" icon={Wallet} />
          <StatCard label="Open slots left" value="—" icon={CalendarClock} />
        </section>

        <Card>
          <CardHeader title="Design check" />
          <div className="flex flex-wrap items-center gap-3 p-5">
            <StatusPill status="active" />
            <StatusPill status="paid" />
            <StatusPill status="on_hold" />
            <StatusPill status="due" />
            <StatusPill status="cancelled" />
            <span className="font-mono text-sm">Rs 12,500.00 · 09:45 · INV-00042</span>
            <Button variant="secondary">Secondary</Button>
          </div>
        </Card>
      </main>
    </>
  );
}