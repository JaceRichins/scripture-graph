import { Platform, type Plugin } from 'obsidian';

/** Keep mobile drawers button-operated throughout the vault. Obsidian's
 * touch recognizer walks the target's ancestors and exits at ignoreSwipe.
 * This leaves native scrolling, clicks, and our chapter/pan gestures alone. */
export function registerSidebarSwipeGuard(plugin: Plugin): void {
  if (!Platform.isMobile) return;
  const root = plugin.app.workspace.containerEl;
  const previous = root.getAttribute('data-ignore-swipe');
  root.setAttribute('data-ignore-swipe', 'true');
  plugin.register(() => {
    if (root.getAttribute('data-ignore-swipe') !== 'true') return;
    if (previous === null) root.removeAttribute('data-ignore-swipe');
    else root.setAttribute('data-ignore-swipe', previous);
  });
}
