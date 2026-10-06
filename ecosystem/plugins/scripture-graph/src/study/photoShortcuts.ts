import { Platform, type Plugin } from "obsidian";

export function registerPhotoShortcuts(plugin: Plugin, ensurePhoto: () => void, nextPhoto: () => void): void {
  if (Platform.isMobile) return;
  let previousFocus: HTMLElement | null = null;
  const showingPhoto = () => document.body.classList.contains("sg-photo-only");
  const exit = () => {
    document.body.classList.remove("sg-photo-only");
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  };
  const toggle = () => {
    if (showingPhoto()) { exit(); return; }
    ensurePhoto();
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousFocus?.blur();
    document.body.classList.add("sg-photo-only");
  };
  plugin.addCommand({ id: "toggle-photo-only", name: "Toggle photo-only view", callback: toggle });
  plugin.addCommand({ id: "next-background-photo", name: "Next background photo", callback: nextPhoto });
  // These are the user's explicit replacements for Ctrl+P and Ctrl+N.
  // Capture them before Obsidian opens its command palette or creates a note.
  plugin.registerDomEvent(window, "keydown", (event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.shiftKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    const toggleKey = event.ctrlKey && key === "p";
    const nextKey = event.ctrlKey && key === "n";
    const escape = !event.ctrlKey && key === "escape" && showingPhoto();
    if (!toggleKey && !nextKey && !escape) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (escape) exit();
    else if (toggleKey) toggle();
    else nextPhoto();
  }, { capture: true });
  plugin.register(exit);
}
