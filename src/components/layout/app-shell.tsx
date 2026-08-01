"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  DollarSign,
  Landmark,
  Settings,
  Target,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Spending", icon: BarChart3 },
  { href: "/income", label: "Income", icon: DollarSign },
  { href: "/cash-flow", label: "Cash Flow", icon: ArrowLeftRight },
  { href: "/net-worth", label: "Net Worth", icon: Landmark },
  { href: "/fi", label: "Financial Independence", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string | null;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Personal Finance
            </p>
            <h1 className="text-lg font-semibold">{userName ?? "Household"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
}
