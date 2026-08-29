/** Device-side interaction trace: a ring buffer of what the input layer saw
 * and decided, so a phone can REPORT its behavior instead of us guessing.
 * Settings → "Copy debug log" puts it on the clipboard. */

interface Entry { t: number; kind: string; data: string }

const BUF: Entry[] = [];
const MAX = 300;
const START = Date.now();
let overlayEl: HTMLElement | null = null;

export function trace(kind: string, data: Record<string, unknown> = {}): void {
  const entry = {
    t: Date.now() - START,
    kind,
    data: Object.entries(data).map(([k, v]) => `${k}=${String(v)}`).join(" "),
  };
  BUF.push(entry);
  if (BUF.length > MAX) BUF.shift();
  if (overlayEl) {
    const last = BUF.slice(-4).map(e => `${(e.t / 1000).toFixed(1)}s ${e.kind} ${e.data}`);
    overlayEl.setText(last.join("\n"));
  }
}

export function traceDump(): string {
  return BUF.map(e => `${(e.t / 1000).toFixed(2)}s ${e.kind} ${e.data}`).join("\n");
}

export function setOverlay(on: boolean): void {
  if (on && !overlayEl) {
    overlayEl = document.body.createDiv({ cls: "sg-trace-overlay" });
  } else if (!on && overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}
