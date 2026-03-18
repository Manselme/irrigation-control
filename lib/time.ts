export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return "jamais vu";
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "à l'instant";
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "à l'instant";
  if (diffMs < hour) return `il y a ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `il y a ${Math.floor(diffMs / hour)} h`;
  return `il y a ${Math.floor(diffMs / day)} j`;
}

