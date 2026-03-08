"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useModules } from "@/lib/hooks/useModules";
import { useAlertConfig, useAlertNotifications, useAlertDetection } from "@/lib/hooks/useAlerts";
import { useLatestSensorMap } from "@/lib/hooks/useLatestSensorMap";
import { AlertConfigForm } from "@/components/Alerts/AlertConfigForm";
import { AlertList } from "@/components/Alerts/AlertList";

export default function AlertsPage() {
  const { user } = useAuth();
  const { modules } = useModules(user?.uid);
  const { config, updateConfig } = useAlertConfig(user?.uid);
  const { notifications, markAsRead, addNotification } = useAlertNotifications(
    user?.uid
  );
  const moduleIds = modules.map((m) => m.id);
  const latestSensorByModule = useLatestSensorMap(user?.uid, moduleIds);

  useAlertDetection(
    user?.uid,
    modules,
    config,
    latestSensorByModule,
    notifications,
    addNotification
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertes</h1>
        <p className="text-muted-foreground">
          Paramétrez les seuils et consultez les notifications.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <AlertConfigForm config={config} onUpdate={updateConfig} />
        <AlertList notifications={notifications} onMarkAsRead={markAsRead} />
      </div>
    </div>
  );
}
