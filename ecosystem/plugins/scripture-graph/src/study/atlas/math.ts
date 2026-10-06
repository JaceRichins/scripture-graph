export type XY = [number, number];
export function distanceKm(a: XY, b: XY): number {
  const r = Math.PI / 180, p = a[1] * r, q = b[1] * r;
  const h = Math.sin((q - p) / 2) ** 2 + Math.cos(p) * Math.cos(q) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12742.0176 * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Local equirectangular atlas projection, corrected at the viewport midpoint. */
export function projection(bounds: number[]) {
  const [w = -180, s = -60, e = 180, n = 80] = bounds;
  const cos = Math.cos((n + s) / 2 * Math.PI / 180);
  const scale = Math.min(920 / ((e - w) * cos), 550 / (n - s));
  return (p: number[]): XY => [500 + (p[0]! - (w + e) / 2) * cos * scale,
    310 - (p[1]! - (n + s) / 2) * scale];
}
export function travelKm(days: number, kmPerDay: number): number { return days * kmPerDay; }
