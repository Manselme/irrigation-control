export type LngLat = [number, number];

export function isPointInPolygon(
  pointLngLat: LngLat,
  polygonCoordinates: number[][][]
): boolean {
  const ring = polygonCoordinates?.[0];
  if (!ring || ring.length < 3) return false;
  const [x, y] = pointLngLat;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

