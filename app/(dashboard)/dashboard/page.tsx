"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAlertNotifications } from "@/lib/hooks/useAlerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplets, Bell } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { notifications } = useAlertNotifications(user?.uid);
  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-muted-foreground">
          Bienvenue, {user?.email}. Gérez votre irrigation depuis ici.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Accès rapide
            </CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Utilisez le menu pour accéder au <strong>Matériel</strong>, à la{" "}
              <strong>Carte</strong>, au <strong>Pilotage</strong>, à
              l&apos;<strong>Historique</strong> et aux <strong>Alertes</strong>.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alertes
            </CardTitle>
            {unread.length > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700">
                {unread.length}
              </span>
            )}
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {unread.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune alerte non lue.
              </p>
            ) : (
              <p className="text-sm">
                {unread.length} alerte{unread.length > 1 ? "s" : ""} non lue
                {unread.length > 1 ? "s" : ""}.
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link href="/alerts">Voir les alertes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
