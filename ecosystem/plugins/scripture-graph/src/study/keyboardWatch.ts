/** The half-page bug, fixed at the root.
 *
 * Obsidian's phone app sizes the workspace from the keyboard: the native
 * side sets `--keyboard-height` on <html> when the keyboard rises and puts
 * it back to 0 when it goes. When a focused box is simply removed from the
 * page (a filter box on a shelf that navigates away, a search field that
 * re-renders), iOS drops the keyboard without a word, the variable stays at
 * keyboard height, and every page shows in the top half only.
 *
 * The watch: whenever nothing editable has focus, that variable must be 0.
 * Checked shortly after every focus change, tap, and viewport change, and on
 * a slow heartbeat as the backstop. Never touches anything while a box is
 * genuinely being typed in. */
import { Platform, type Plugin } from "obsidian";
import { trace } from "./trace";

export function registerKeyboardWatch(plugin: Plugin): void {
  if (!Platform.isMobile) return;
  const root = document.documentElement;
  const keyboardHeight = () => parseFloat(getComputedStyle(root).getPropertyValue("--keyboard-height")) || 0;
  const typing = () => {
    const ae = document.activeElement;
    if (!(ae instanceof HTMLElement) || ae === document.body) return false;
    return ae.matches("input, textarea, select, [contenteditable], [contenteditable='true']") || !!ae.closest(".cm-editor");
  };
  let timer: number | null = null;
  const check = () => {
    timer = null;
    if (typing()) return;
    const h = keyboardHeight();
    if (h <= 0) return;
    trace("keyboard.unstick", { height: h });
    root.style.setProperty("--keyboard-height", "0px");
    window.dispatchEvent(new Event("resize"));
  };
  const soon = () => { if (timer !== null) window.clearTimeout(timer); timer = window.setTimeout(check, 450); };
  plugin.registerDomEvent(window, "focusout", soon);
  plugin.registerDomEvent(document, "pointerdown", soon, { capture: true, passive: true } as AddEventListenerOptions);
  const vv = window.visualViewport;
  if (vv) { vv.addEventListener("resize", soon); plugin.register(() => vv.removeEventListener("resize", soon)); }
  plugin.registerInterval(window.setInterval(check, 2500));
}
