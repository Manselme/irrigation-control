"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useModules } from "@/lib/hooks/useModules";
import { useAlertConfig, useAlertNotifications, useAlertDetection } from "@/lib/hooks/useAlerts";
import { useLatestSensorMap } from "@/lib/hooks/useLatestSensorMap";
import { AlertConfigForm } from "@/components/Alerts/AlertConfigForm";
import { AlertList } from "@/components/Alerts/AlertList";

export default function AlertsPage() {
  const { user } = useAuth();
  const { config, updateConfig } = useAlertConfig(user?.uid);
  const { modules } = useModules(user?.uid, {
    offlineThresholdMinutes: config?.offlineMinutesThreshold ?? 5,
  });
  const { notifications, markAsRead, addNotification } = useAlertNotifications(
    user?.uid
  );
  const latestSensorByModule = useLatestSensorMap(user?.uid, modules);

  useAlertDetection(
    user?.uid,
    modules,
    config,
    latestSensorByModule,
    notifications,
    addNotification
  );

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    await Promise.all(unreadIds.map((id) => markAsRead(id)));
  };

  const criticalCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">
            Alerts &amp; Configuration
          </h1>
          <p className="text-muted-foreground font-medium text-xs mt-1">
            Paramétrez les seuils et consultez les notifications.
          </p>
        </div>
        {criticalCount > 0 && (
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-[10px] font-bold uppercase text-destructive">
            {criticalCount} Critical
          </span>
        )}
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-8 space-y-6">
          <AlertConfigForm config={config} onUpdate={updateConfig} />
        </section>
        <aside className="col-span-12 lg:col-span-4">
          <AlertList
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
          />
        </aside>
      </div>
    </div>
  );
}
