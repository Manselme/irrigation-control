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
  { href: "/dashboard", label: "Vue d'ensemble", icon: BarChart3 },
  { href: "/irrigation", label: "Irrigation & Zones", icon: Droplets },
  { href: "/history", label: "Analytique", icon: BarChart3 },
  { href: "/alerts", label: "Alertes & Notifications", icon: Bell },
  { href: "/material", label: "Parc Matériel", icon: Wrench },
];

const bottomItems: NavItem[] = [
  { href: "/profile", label: "Paramètres & Compte", icon: Settings },
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
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
          pathname === href
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-slate-100"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    ));

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center border-b bg-white px-3 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <p className="ml-2 text-sm font-semibold">CeresAnalytics</p>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r bg-white p-4 transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-4 border-b pb-3">
          <p className="text-base font-semibold text-slate-900">CeresAnalytics</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
        </div>

        <nav className="space-y-1">{renderNav(mainItems)}</nav>

        <div className="mt-6 border-t pt-4">
          <nav className="space-y-1">{renderNav(bottomItems)}</nav>
          <Button
            variant="outline"
            className="mt-3 w-full justify-start gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
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

