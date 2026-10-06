/** Build offscreen, then replace a page atomically. Background refreshes must
 * not clear a live reader or restore an outdated scroll position after a read. */
export class PageRefresh {
  private revision = 0;
  private displayed: string | null = null;

  cancel() { ++this.revision; }

  begin(target: HTMLElement, key: string) {
    const revision = ++this.revision;
    const root = createDiv();
    const current = () => revision === this.revision;
    return { root, current, commit: () => {
      if (!current()) return false;
      // Capture at commit, not at the start of async work: the reader may
      // have continued scrolling while Markdown or annotations were loading.
      const top = this.displayed === key ? target.scrollTop : 0;
      const left = this.displayed === key ? target.scrollLeft : 0;
      target.replaceChildren(...Array.from(root.childNodes));
      target.scrollTop = top;
      target.scrollLeft = left;
      this.displayed = key;
      return true;
    } };
  }
}
