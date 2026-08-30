/** Minimal Obsidian API shim so the REAL plugin modules run in a plain
 * browser page for interaction testing. Only what the study surface uses. */

// ---- Obsidian's HTMLElement helpers (used everywhere in plugin code) ------
declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, opts?: {
      cls?: string | string[]; text?: string; attr?: Record<string, string>;
    }): HTMLElementTagNameMap[K];
    createDiv(opts?: { cls?: string | string[]; text?: string }): HTMLDivElement;
    createSpan(opts?: { cls?: string | string[]; text?: string;
      attr?: Record<string, string> }): HTMLSpanElement;
    empty(): void;
    setText(t: string): void;
    appendText(t: string): void;
    addClass(c: string): void;
    removeClass(c: string): void;
    toggleClass(c: string, on: boolean): void;
  }
  interface Document {
    body: HTMLElement;
  }
}

function applyOpts(el: HTMLElement, opts?: {
  cls?: string | string[]; text?: string; attr?: Record<string, string>;
}) {
  if (!opts) return;
  if (opts.cls) {
    for (const c of Array.isArray(opts.cls) ? opts.cls : opts.cls.split(" ")) {
      if (c) el.classList.add(c);
    }
  }
  if (opts.text) el.textContent = opts.text;
  if (opts.attr) for (const [k, v] of Object.entries(opts.attr)) el.setAttribute(k, v);
}

// Obsidian also exposes global element factories
(globalThis as unknown as Record<string, unknown>)["createDiv"] =
  (opts?: never) => { const d = document.createElement("div"); applyOpts(d, opts); return d; };
(globalThis as unknown as Record<string, unknown>)["createSpan"] =
  (opts?: never) => { const s = document.createElement("span"); applyOpts(s, opts); return s; };

const proto = HTMLElement.prototype;
proto.createEl = function (tag: string, opts?: never) {
  const el = document.createElement(tag);
  applyOpts(el, opts);
  this.appendChild(el);
  return el as never;
};
proto.createDiv = function (opts?: never) { return this.createEl("div", opts); };
proto.createSpan = function (opts?: never) { return this.createEl("span", opts); };
proto.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
proto.setText = function (t: string) { this.textContent = t; };
proto.appendText = function (t: string) { this.appendChild(document.createTextNode(t)); };
proto.addClass = function (c: string) { this.classList.add(c); };
proto.removeClass = function (c: string) { this.classList.remove(c); };
proto.toggleClass = function (c: string, on: boolean) { this.classList.toggle(c, on); };
proto.setAttr = function (k: string, v: string | number | boolean) {
  this.setAttribute(k, String(v));
};

// ------------------------------------------------------------------- Notice
export class Notice {
  constructor(message: string, _timeout = 4000) {
    const n = document.body.createDiv({ cls: "shim-notice", text: message });
    setTimeout(() => n.remove(), _timeout);
  }
}

// -------------------------------------------------------------------- Menu
export class Menu {
  private el = document.createElement("div");
  private items: HTMLElement[] = [];
  constructor() { this.el.className = "shim-menu"; }
  addItem(cb: (item: MenuItem) => void): this {
    const item = new MenuItem();
    cb(item);
    this.items.push(item.render(() => this.hide()));
    return this;
  }
  addSeparator(): this {
    const sep = document.createElement("div");
    sep.className = "shim-menu-sep";
    this.items.push(sep);
    return this;
  }
  showAtMouseEvent(evt: MouseEvent): void {
    this.showAtPosition({ x: evt.clientX, y: evt.clientY });
  }
  showAtPosition(pos: { x: number; y: number }): void {
    for (const i of this.items) this.el.appendChild(i);
    this.el.style.left = `${Math.min(pos.x, window.innerWidth - 240)}px`;
    this.el.style.top = `${Math.min(pos.y, window.innerHeight - 40 * this.items.length)}px`;
    document.body.appendChild(this.el);
    setTimeout(() => document.addEventListener("pointerdown", this.outside, true), 50);
  }
  private outside = (e: Event) => {
    if (!this.el.contains(e.target as Node)) this.hide();
  };
  hide(): void {
    document.removeEventListener("pointerdown", this.outside, true);
    this.el.remove();
  }
}
class MenuItem {
  private title = "";
  private handler: ((evt: MouseEvent) => void) | null = null;
  setTitle(t: string): this { this.title = t; return this; }
  setIcon(_i: string): this { return this; }
  onClick(fn: (evt: MouseEvent) => void): this { this.handler = fn; return this; }
  render(close: () => void): HTMLElement {
    const el = document.createElement("button");
    el.className = "shim-menu-item";
    el.textContent = this.title;
    el.onclick = (e) => { close(); this.handler?.(e); };
    return el;
  }
}

// ---------------------------------------------------------------- Component
export class Component {
  load(): void { /* shim */ }
  unload(): void { /* shim */ }
  addChild<T>(c: T): T { return c; }
}

// The sheet only needs a plausible rendering for layout smoke tests
export const MarkdownRenderer = {
  render: async (_app: unknown, md: string, el: HTMLElement): Promise<void> => {
    for (const block of md.split(/\n\n+/)) {
      const line = block.trim();
      if (!line) continue;
      const h = /^(#{1,3})\s+(.*)$/.exec(line.split("\n")[0]!);
      if (h) {
        el.createEl(`h${h[1]!.length}` as "h2", { text: h[2]! });
        const rest = line.split("\n").slice(1).join(" ").trim();
        if (rest) el.createEl("p", { text: rest });
      } else if (line.startsWith("---")) {
        continue; // frontmatter-ish
      } else {
        el.createEl("p", { text: line.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2") });
      }
    }
  },
};

// -------------------------------------------------------------------- Modal
export class Modal {
  contentEl: HTMLElement = document.createElement("div");
  modalEl: HTMLElement = document.createElement("div");
  private overlay: HTMLElement | null = null;
  constructor(public app: unknown) { this.contentEl.className = "shim-modal-content"; }
  open(): void {
    this.overlay = document.body.createDiv({ cls: "shim-modal-overlay" });
    const box = this.overlay.createDiv({ cls: "shim-modal" });
    this.modalEl = box;
    const x = box.createEl("button", { cls: "shim-modal-x", text: "✕" });
    x.onclick = () => this.close();
    box.appendChild(this.contentEl);
    (this as unknown as { onOpen?: () => void }).onOpen?.();
  }
  close(): void {
    (this as unknown as { onClose?: () => void }).onClose?.();
    this.overlay?.remove();
    this.overlay = null;
  }
}

// ------------------------------------------------------------------ Setting
export class Setting {
  settingEl: HTMLElement;
  constructor(container: HTMLElement) {
    this.settingEl = container.createDiv({ cls: "shim-setting" });
  }
  setName(n: string): this { this.settingEl.createSpan({ text: n }); return this; }
  setDesc(_d: string): this { return this; }
  addText(cb: (t: TextComponent) => void): this {
    const t = new TextComponent(this.settingEl);
    cb(t);
    return this;
  }
  addButton(cb: (b: ButtonComponent) => void): this {
    const b = new ButtonComponent(this.settingEl);
    cb(b);
    return this;
  }
}
class TextComponent {
  inputEl: HTMLInputElement;
  constructor(parent: HTMLElement) {
    this.inputEl = parent.createEl("input");
  }
  setValue(v: string): this { this.inputEl.value = v; return this; }
  getValue(): string { return this.inputEl.value; }
  setPlaceholder(p: string): this { this.inputEl.placeholder = p; return this; }
  onChange(fn: (v: string) => void): this {
    this.inputEl.addEventListener("input", () => fn(this.inputEl.value));
    return this;
  }
  then(cb: (t: this) => void): this { cb(this); return this; }
}
class ButtonComponent {
  buttonEl: HTMLButtonElement;
  constructor(parent: HTMLElement) { this.buttonEl = parent.createEl("button"); }
  setButtonText(t: string): this { this.buttonEl.textContent = t; return this; }
  setCta(): this { return this; }
  setWarning(): this { return this; }
  onClick(fn: () => void): this { this.buttonEl.onclick = fn; return this; }
}

// ----------------------------------------------------------------- various
export const Platform = { isMobile: true };
export class MarkdownView {}
export class TFile { path = ""; basename = ""; }
export class Plugin {
  registerDomEvent(el: EventTarget, ev: string, cb: (e: Event) => void,
    opts?: AddEventListenerOptions): void {
    el.addEventListener(ev, cb as EventListener, opts);
  }
}
export type MarkdownPostProcessorContext = unknown;
export type WorkspaceLeaf = unknown;
export async function requestUrl(): Promise<never> {
  throw new Error("network disabled in harness");
}
export class ItemView {}
export class MarkdownRenderer { static async render(): Promise<void> { /* noop */ } }
export class PluginSettingTab {}
