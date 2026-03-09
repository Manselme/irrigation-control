"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  QUICK_ACCESS_AVAILABLE_PAGES,
  getDefaultQuickAccessItems,
  buildZoneQuickAccessItem,
  isZoneItemId,
  type QuickAccessItem,
} from "@/lib/quickAccess";
import { useZones } from "@/lib/hooks/useZones";
import { Map, Droplets, History, Bell, Wrench, MapPin, ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";

const ICON_BY_ID: Record<string, React.ComponentType<{ className?: string }>> = {
  material: Wrench,
  map: Map,
  irrigation: Droplets,
  history: History,
  alerts: Bell,
} as const;

function getIconForItem(item: QuickAccessItem): React.ComponentType<{ className?: string }> | null {
  if (isZoneItemId(item.id)) return MapPin;
  return ICON_BY_ID[item.id] ?? null;
}

interface QuickAccessEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: QuickAccessItem[];
  onSave: (items: QuickAccessItem[]) => Promise<void>;
  userId: string | undefined;
}

export function QuickAccessEditor({
  open,
  onOpenChange,
  items,
  onSave,
  userId,
}: QuickAccessEditorProps) {
  const [editing, setEditing] = useState<QuickAccessItem[]>([]);
  const [saving, setSaving] = useState(false);
  const { zones } = useZones(userId ?? undefined, null);

  useEffect(() => {
    if (open) {
      setEditing(items.length > 0 ? [...items] : getDefaultQuickAccessItems());
    }
  }, [open, items]);

  const availableToAdd = QUICK_ACCESS_AVAILABLE_PAGES.filter(
    (p) => !editing.some((e) => e.id === p.id)
  );
  const availableZonesToAdd = zones.filter(
    (z) => !editing.some((e) => isZoneItemId(e.id) && e.id === `zone:${z.id}`)
  );

  const move = (index: number, dir: "up" | "down") => {
    const next = [...editing];
    const i = dir === "up" ? index - 1 : index + 1;
    if (i < 0 || i >= next.length) return;
    [next[index], next[i]] = [next[i], next[index]];
    setEditing(next);
  };

  const remove = (index: number) => {
    setEditing((prev) => prev.filter((_, i) => i !== index));
  };

  const add = (item: QuickAccessItem) => {
    setEditing((prev) => [...prev, item]);
  };

  const addZone = (zoneId: string, label: string) => {
    setEditing((prev) => [...prev, buildZoneQuickAccessItem(zoneId, label)]);
  };

  const handleSave = async () => {
    if (editing.length === 0) return;
    setSaving(true);
    try {
      await onSave(editing);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personnaliser l&apos;accès rapide</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium mb-2">Ordre et contenu</p>
            <ul className="space-y-1">
              {editing.map((item, index) => {
                const Icon = getIconForItem(item);
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="flex-1">{item.label}</span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => move(index, "up")}
                        disabled={index === 0}
                        aria-label="Monter"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => move(index, "down")}
                        disabled={index === editing.length - 1}
                        aria-label="Descendre"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => remove(index)}
                        aria-label="Retirer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          {availableToAdd.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Ajouter une page</p>
              <div className="flex flex-wrap gap-2">
                {availableToAdd.map((item) => {
                  const Icon = ICON_BY_ID[item.id];
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => add(item)}
                      className="gap-1.5"
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      {item.label}
                      <Plus className="h-3.5 w-3" />
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
          {availableZonesToAdd.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Ajouter un champ (zone)</p>
              <p className="text-xs text-muted-foreground mb-2">
                Lien direct vers le pilotage de ce champ.
              </p>
              <div className="flex flex-wrap gap-2">
                {availableZonesToAdd.map((z) => (
                  <Button
                    key={z.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addZone(z.id, z.name)}
                    className="gap-1.5"
                  >
                    <MapPin className="h-4 w-4" />
                    {z.name || `Zone ${z.id}`}
                    <Plus className="h-3.5 w-3" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || editing.length === 0}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
