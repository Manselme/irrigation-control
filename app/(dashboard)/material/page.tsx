"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useAlertConfig } from "@/lib/hooks/useAlerts";
import { AddModuleForm } from "@/components/AddModuleForm";
import { ModuleList } from "@/components/ModuleList";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function MaterialPage() {
  const { user } = useAuth();
  const { config: alertConfig } = useAlertConfig(user?.uid);
  const { farms, loading: farmsLoading, addFarm } = useFarms(user?.uid);
  const { modules, loading: modulesLoading, addModule, removeModule } =
    useModules(user?.uid, {
      offlineThresholdMinutes: alertConfig?.offlineMinutesThreshold ?? 5,
    });
  const [farmName, setFarmName] = useState("Ma ferme");
  const [addingFarm, setAddingFarm] = useState(false);

  const handleAddFarm = async () => {
    if (!farmName.trim()) return;
    setAddingFarm(true);
    try {
      await addFarm(farmName.trim());
      setFarmName("Ma ferme");
    } finally {
      setAddingFarm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Matériel</h1>
        <p className="text-muted-foreground">
          Gérez vos modules (Mère, Pompe, Champ) et leur affectation aux fermes.
        </p>
      </div>

      {farms.length === 0 && !farmsLoading && (
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row gap-3 items-start">
          <input
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm w-full sm:max-w-[200px]"
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
            placeholder="Nom de la ferme"
          />
          <Button onClick={handleAddFarm} disabled={addingFarm}>
            {addingFarm ? "Création…" : "Créer ma première ferme"}
          </Button>
        </div>
      )}

      <AddModuleForm
        farms={farms}
        onAdd={addModule}
        existingIds={modules.map((m) => m.id)}
      />
      <ModuleList
        modules={modules}
        loading={modulesLoading}
        onRemove={removeModule}
      />
    </div>
  );
}
