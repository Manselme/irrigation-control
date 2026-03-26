"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ComponentType } from "react";
import {
  BarChart3,
  Droplets,
  Wrench,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const mainItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/irrigation", label: "Irrigation", icon: Droplets },
  { href: "/history", label: "History", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/material", label: "Material", icon: Wrench },
];

const bottomItems: NavItem[] = [
  { href: "/profile", label: "Profile", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const renderNav = (items: NavItem[]) =>
    items.map(({ href, label, icon: Icon }) => (
      <Link
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 font-headline font-medium tracking-tight transition-colors",
          pathname === href
            ? "text-primary font-bold border-l-4 border-primary pl-2 bg-surface-low"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    ));

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center bg-surface px-3 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <p className="ml-2 text-sm font-semibold font-headline uppercase tracking-tight">
          CeresAnalytics
        </p>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-surface-low py-6 px-4 transition-transform hidden lg:flex lg:flex-col lg:justify-between",
          mobileOpen ? "translate-x-0 flex flex-col justify-between" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-8 px-2">
          <p className="text-2xl font-bold uppercase tracking-widest font-headline text-foreground">
            CeresAnalytics
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Precision Agronomy
          </p>
          <p className="mt-2 truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>

        <nav className="space-y-1">{renderNav(mainItems)}</nav>

        <div className="mt-6 pt-6 border-t border-border/10">
          <nav className="space-y-1">{renderNav(bottomItems)}</nav>
          <Button
            variant="outline"
            className="mt-3 w-full justify-start gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer le menu"
        />
      ) : null}
    </>
  );
}

