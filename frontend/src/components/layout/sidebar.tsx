"use client";

import { CalendarDays, LayoutDashboard, Receipt, Stethoscope, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/therapists", label: "Therapists", icon: Stethoscope },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-secondary">
      <div className="flex items-center gap-3 px-6 pb-8 pt-7">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-display text-xl font-semibold text-white">
          P
        </span>
        <div>
          <p className="font-display text-xl font-semibold leading-none text-white">PhysioDesk</p>
          <p className="mt-1.5 text-xs text-white/50">Clinic management</p>
        </div>
      </div>

      <p className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">Menu</p>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-white/70 hover:bg-secondary-light hover:text-white",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
            {user && (
        <div className="m-3 flex items-center gap-3 rounded-xl bg-secondary-light p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-ink">
            {user.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
            <p className="text-xs capitalize text-white/50">{user.role}</p>
          </div>
          <button onClick={logout} title="Sign out" aria-label="Sign out"
            className="rounded-lg p-2 text-white/60 transition hover:bg-secondary hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}