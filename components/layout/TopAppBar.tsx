"use client";

import { useMemo, useState } from "react";
import { Bell, Search, WifiOff, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSidebarLayout } from "./sidebar-layout";

export function TopAppBar({ className }: { className?: string }) {
  const { user } = useAuth();
  const { collapsed } = useSidebarLayout();
  const [q, setQ] = useState("");

  const userLabel = useMemo(() => {
    const email = (user?.email ?? "").trim();
    if (!email) return "Utilisateur";
    const beforeAt = email.split("@")[0] ?? email;
    return beforeAt || "Utilisateur";
  }, [user?.email]);

  return (
    <header
      className={cn(
        "fixed top-0 z-40 h-16 min-w-0 w-full bg-surface/90 backdrop-blur-md",
        "left-0 right-0 lg:w-auto",
        collapsed ? "lg:left-14 lg:right-0" : "lg:left-64 lg:right-0",
        className
      )}
    >
      <div className="flex h-16 w-full min-w-0 items-center justify-between gap-3 pl-14 pr-4 sm:pl-14 sm:pr-6 lg:px-8 xl:px-10">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <span className="shrink-0 font-headline text-base font-black uppercase tracking-tight text-foreground sm:text-lg">
            CeresAnalytics
          </span>
          <div className="hidden min-w-0 flex-1 md:flex md:max-w-md lg:max-w-lg">
            <div className="flex w-full min-w-0 items-center gap-2 rounded-md bg-surface-low px-3 py-2 ring-1 ring-border/15">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground font-headline"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
            <Activity className="h-5 w-5" />
            <WifiOff className="h-5 w-5" />
            <Bell className="h-5 w-5" />
          </div>
          <div className="hidden sm:block h-8 w-px bg-foreground/10" />
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="font-headline text-sm font-semibold uppercase tracking-tight text-foreground">
                Auto-Pump Secured
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {userLabel}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-surface-low ring-2 ring-primary/30" />
          </div>
        </div>
      </div>
    </header>
  );
}

