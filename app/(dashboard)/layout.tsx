"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { OfflineBanner } from "@/components/OfflineBanner";
import { DashboardMain } from "@/components/layout/DashboardMain";
import { SidebarLayoutProvider } from "@/components/layout/sidebar-layout";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopAppBar } from "@/components/layout/TopAppBar";
import { useAlertConfig } from "@/lib/hooks/useAlerts";
import { useModules } from "@/lib/hooks/useModules";
import { AutoPumpStopOnLowPressure } from "@/components/Safety/AutoPumpStopOnLowPressure";

const FULL_CANVAS_ROUTES = ["/irrigation"];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { config } = useAlertConfig(user?.uid);
  const { modules } = useModules(user?.uid, {
    offlineThresholdMinutes: config?.offlineMinutesThreshold ?? 5,
  });

  const isFullCanvas = FULL_CANVAS_ROUTES.some((r) => pathname?.startsWith(r));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarLayoutProvider>
      <div className="min-h-screen w-full min-w-0 bg-surface">
        <OfflineBanner />
        <AutoPumpStopOnLowPressure userId={user.uid} config={config} modules={modules} />
        <Sidebar />
        <TopAppBar />
        <DashboardMain isFullCanvas={isFullCanvas}>{children}</DashboardMain>
      </div>
    </SidebarLayoutProvider>
  );
}
