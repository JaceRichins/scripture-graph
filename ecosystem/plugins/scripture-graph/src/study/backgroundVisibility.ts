export const DEFAULT_BACKGROUND_VISIBILITY = 35;
export function backgroundVisibility(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value)) : DEFAULT_BACKGROUND_VISIBILITY;
}
export function applyBackgroundVisibility(style: Pick<CSSStyleDeclaration, 'setProperty'>, value: unknown): void {
  // Preserve existing shading at the default; higher visibility removes it.
  style.setProperty('--sg-scene-shade', String((100 - backgroundVisibility(value)) / 65));
}
