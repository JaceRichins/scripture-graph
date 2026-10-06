import { Platform, setIcon, type App, type Plugin } from 'obsidian';

export function closeMobileSidebars(app: App): void {
  if (!Platform.isMobile) return;
  app.workspace.leftSplit.collapse();
  app.workspace.rightSplit.collapse();
}

/** Drawers must have an obvious exit even when the reading dock is hidden. */
export function registerSidebarNavigation(plugin: Plugin, openHome: () => void): void {
  if (!Platform.isMobile) return;
  let disposed = false, frame = 0;
  const rows = new Map<HTMLElement, HTMLElement>();
  const sync = () => {
    if (disposed) return;
    for (const [inner, row] of rows) {
      if (!inner.isConnected || row.parentElement !== inner) { row.remove(); rows.delete(inner); }
    }
    for (const inner of document.querySelectorAll<HTMLElement>('.workspace-drawer .workspace-drawer-inner')) {
      if (rows.has(inner)) continue;
      const row = document.createElement('nav');
      row.className = 'sg-sidebar-return';
      row.setAttribute('aria-label', 'Return to Scripture Graph');
      const home = document.createElement('button');
      home.type = 'button';
      home.className = 'sg-sidebar-home';
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true'); setIcon(icon, 'house');
      home.append(icon, document.createTextNode('Back to Home'));
      home.onclick = () => { closeMobileSidebars(plugin.app); openHome(); };
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'sg-sidebar-close';
      close.textContent = 'Close';
      close.setAttribute('aria-label', 'Close sidebar and return to reading');
      close.onclick = () => closeMobileSidebars(plugin.app);
      row.append(home, close);
      inner.prepend(row);
      rows.set(inner, row);
    }
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); };
  // Covers restored drawers and Obsidian rebuilding their inner containers.
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  plugin.registerEvent(plugin.app.workspace.on('layout-change', schedule));
  plugin.app.workspace.onLayoutReady(sync);
  sync();
  plugin.register(() => {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    for (const row of rows.values()) row.remove();
    rows.clear();
  });
}
