"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { OfflineBanner } from "@/components/OfflineBanner";
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
    <div className="min-h-screen bg-surface">
      <OfflineBanner />
      <AutoPumpStopOnLowPressure userId={user.uid} config={config} modules={modules} />
      <Sidebar />
      <TopAppBar />
      {isFullCanvas ? (
        <main className="relative h-screen w-full min-w-0 overflow-hidden bg-surface-low pt-16 lg:pl-64">
          {children}
        </main>
      ) : (
        <main className="min-h-screen w-full min-w-0 pt-20 pb-20 pl-4 pr-4 sm:px-6 lg:ml-64 lg:pb-12">
          {children}
        </main>
      )}
    </div>
  );
}
