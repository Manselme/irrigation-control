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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSidebarLayout } from "./sidebar-layout";

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
  const { collapsed, toggleCollapsed } = useSidebarLayout();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showExpandedContent = mobileOpen || !collapsed;

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
        title={!showExpandedContent ? label : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md py-2 font-headline font-medium tracking-tight transition-colors",
          showExpandedContent ? "px-3" : "justify-center px-0",
          pathname === href
            ? showExpandedContent
              ? "border-l-4 border-primary bg-surface-low pl-2 font-bold text-primary"
              : "bg-surface-low font-bold text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {showExpandedContent ? <span className="truncate">{label}</span> : null}
      </Link>
    ));

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 min-w-0 items-center bg-surface px-3 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <p className="ml-2 truncate text-sm font-semibold font-headline uppercase tracking-tight">
          CeresAnalytics
        </p>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-surface-low py-6 transition-[width,padding,transform] duration-200 ease-out",
          mobileOpen
            ? "flex h-[100dvh] min-h-0 w-64 max-w-[min(16rem,100vw)] translate-x-0 flex-col px-4"
            : "hidden -translate-x-full lg:flex lg:translate-x-0 lg:flex-col",
          collapsed ? "lg:w-14 lg:px-1.5" : "lg:w-64 lg:px-4",
          "lg:h-screen lg:min-h-0"
        )}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          className="absolute -right-3 top-1/2 z-50 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/50 bg-surface text-muted-foreground shadow-md hover:bg-surface-low hover:text-foreground lg:flex"
          aria-label={collapsed ? "Afficher le menu latéral" : "Masquer le menu latéral"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
        </button>

        {showExpandedContent ? (
          <div className="shrink-0 px-2">
            <p className="text-2xl font-bold uppercase tracking-widest font-headline text-foreground">
              CeresAnalytics
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Precision Agronomy
            </p>
            <p className="mt-2 truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        ) : (
          <div className="flex shrink-0 justify-center px-0" aria-hidden>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-xs font-black text-primary">
              C
            </span>
          </div>
        )}

        <nav className="mt-6 min-h-0 shrink-0 space-y-1 overflow-y-auto overflow-x-hidden">
          {renderNav(mainItems)}
        </nav>

        <div className="mt-auto shrink-0 border-t border-border/10 pt-6">
          <nav className="space-y-1">{renderNav(bottomItems)}</nav>
          <Button
            variant="outline"
            className={cn(
              "mt-3 gap-2",
              showExpandedContent ? "w-full justify-start" : "w-full justify-center px-0"
            )}
            onClick={handleSignOut}
            aria-label="Déconnexion"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {showExpandedContent ? "Sign out" : null}
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
