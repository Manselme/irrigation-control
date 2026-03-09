/**
 * Accès rapide personnalisable : type et liste des pages éligibles
 * (pages + champs/zones vers le pilotage).
 */

export interface QuickAccessItem {
  id: string;
  href: string;
  label: string;
}

/** Préfixe des éléments d'accès rapide de type "champ" (zone) */
export const QUICK_ACCESS_ZONE_PREFIX = "zone:";

export function isZoneItemId(id: string): boolean {
  return id.startsWith(QUICK_ACCESS_ZONE_PREFIX);
}

/** Crée un item d'accès rapide vers le pilotage d'une zone */
export function buildZoneQuickAccessItem(zoneId: string, label: string): QuickAccessItem {
  return {
    id: `${QUICK_ACCESS_ZONE_PREFIX}${zoneId}`,
    href: `/irrigation?zone=${encodeURIComponent(zoneId)}`,
    label: label || `Champ ${zoneId}`,
  };
}

const PAGE_HREFS = new Set([
  "/material",
  "/map",
  "/irrigation",
  "/history",
  "/alerts",
]);

/** Vérifie qu'un href est autorisé (page fixe ou lien pilotage zone) */
export function isValidQuickAccessHref(href: string): boolean {
  if (PAGE_HREFS.has(href)) return true;
  try {
    if (!href.startsWith("/irrigation?")) return false;
    const u = new URL(href, "https://x");
    return u.searchParams.has("zone") && u.searchParams.get("zone")?.length !== 0;
  } catch {
    return false;
  }
}

/** Ordre par défaut affiché si l'utilisateur n'a rien enregistré */
const DEFAULT_ORDER: QuickAccessItem[] = [
  { id: "irrigation", href: "/irrigation", label: "Pilotage" },
  { id: "map", href: "/map", label: "Carte" },
  { id: "material", href: "/material", label: "Matériel" },
  { id: "history", href: "/history", label: "Historique" },
  { id: "alerts", href: "/alerts", label: "Alertes" },
];

/** Toutes les pages qu'on peut mettre dans l'accès rapide (sans Tableau de bord) */
export const QUICK_ACCESS_AVAILABLE_PAGES: QuickAccessItem[] = [
  { id: "material", href: "/material", label: "Matériel" },
  { id: "map", href: "/map", label: "Carte" },
  { id: "irrigation", href: "/irrigation", label: "Pilotage" },
  { id: "history", href: "/history", label: "Historique" },
  { id: "alerts", href: "/alerts", label: "Alertes" },
];

export function getDefaultQuickAccessItems(): QuickAccessItem[] {
  return [...DEFAULT_ORDER];
}
