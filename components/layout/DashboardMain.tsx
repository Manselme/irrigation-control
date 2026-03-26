"use client";

import { cn } from "@/lib/utils";
import { useSidebarLayout } from "./sidebar-layout";

export function DashboardMain({
  children,
  isFullCanvas,
}: {
  children: React.ReactNode;
  isFullCanvas: boolean;
}) {
  const { collapsed } = useSidebarLayout();

  if (isFullCanvas) {
    return (
      <main
        className={cn(
          "relative box-border h-screen min-h-0 min-w-0 overflow-hidden bg-surface-low pt-16 pr-3 sm:pr-5 lg:pr-6",
          /* w-full + margin-left dépassent la largeur du viewport — lg:w-auto occupe seulement l'espace à droite du menu */
          "w-full max-w-full lg:max-w-none",
          collapsed ? "lg:ml-14 lg:w-auto" : "lg:ml-64 lg:w-auto"
        )}
      >
        {children}
      </main>
    );
  }

  return (
    <main
      className={cn(
        "box-border min-h-screen min-w-0 pt-20 pb-20 px-4 sm:px-6 lg:px-8 xl:px-10 lg:pb-12",
        "w-full max-w-full lg:max-w-none",
        collapsed ? "lg:ml-14 lg:w-auto" : "lg:ml-64 lg:w-auto"
      )}
    >
      {children}
    </main>
  );
}
