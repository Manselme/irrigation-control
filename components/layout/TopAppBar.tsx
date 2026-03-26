"use client";

import { useMemo, useState } from "react";
import { Bell, Search, WifiOff, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";

export function TopAppBar({ className }: { className?: string }) {
  const { user } = useAuth();
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
        "fixed top-0 right-0 z-40 h-16 w-full lg:w-[calc(100%-16rem)]",
        "bg-surface/90 backdrop-blur-md",
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-headline text-lg font-black uppercase tracking-tight text-foreground">
            CeresAnalytics
          </span>
          <div className="hidden md:flex items-center gap-2 rounded-md bg-surface-low px-3 py-2 ring-1 ring-border/15">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une zone, module, alerte…"
              className="w-64 bg-transparent text-sm outline-none placeholder:text-muted-foreground font-headline"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
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

