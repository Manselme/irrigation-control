/**
 * Export CSV côté client des données d'historique de zone (même agrégat que les graphiques).
 * Nom du fichier : CeresAnalytics_Export_[NomZone]_[DateDebut]-[DateFin].csv
 */

export interface ZoneHistoryExportRow {
  date: string;
  zoneName: string;
  pluviometrie_mm: number;
  /** Volume d’irrigation estimé ou mesuré, en litres. */
  irrigation_liters: number;
  tension_sol_cb: number | null;
  humidite_10cm_pct: number | null;
  humidite_30cm_pct: number | null;
}

function escapeCsvCell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildZoneHistoryCsv(rows: ZoneHistoryExportRow[]): string {
  const header = "Date,Zone,Pluviometrie_mm,Irrigation_litres,Tension_Sol_cb,Humidite_10cm_%,Humidite_30cm_%";
  const lines = rows.map(
    (r) =>
      [
        r.date,
        escapeCsvCell(r.zoneName),
        r.pluviometrie_mm,
        r.irrigation_liters,
        r.tension_sol_cb ?? "",
        r.humidite_10cm_pct ?? "",
        r.humidite_30cm_pct ?? "",
      ].join(",")
  );
  return [header, ...lines].join("\r\n");
}

export function downloadZoneHistoryCsv(
  rows: ZoneHistoryExportRow[],
  zoneName: string,
  dateStart: string,
  dateEnd: string
): void {
  const csv = buildZoneHistoryCsv(rows);
  const safeName = zoneName.replace(/[^a-zA-Z0-9_\-\s]/g, "_").replace(/\s+/g, "_") || "Zone";
  const filename = `CeresAnalytics_Export_${safeName}_${dateStart}-${dateEnd}.csv`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
