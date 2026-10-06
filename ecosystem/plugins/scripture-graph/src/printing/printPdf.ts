import pdfMake from 'pdfmake/build/pdfmake';
import fonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

// pdfmake 0.2.23 exports the VFS directly; the 0.2 type package models an older wrapper.
pdfMake.vfs = fonts as unknown as Record<string, string>;
export interface PrintOptions { fontSize: number; paper: 'LETTER' | 'A4' }

/** Only document formatting enters the PDF. No plugin UI, styles, scripts or remote fetches. */
export function cleanPrintHtml(rendered: HTMLElement): string {
  const root = rendered.cloneNode(true) as HTMLElement;
  root.querySelectorAll('script,style,iframe,object,embed,button,input,textarea,select,canvas,svg,.frontmatter,.metadata-container').forEach(el => el.remove());
  root.querySelectorAll('audio,video,img,.internal-embed').forEach(el => {
    const caption = document.createElement('p');
    caption.textContent = `[Media: ${el.getAttribute('alt') || el.getAttribute('src')?.split('/').pop() || 'see original page'}]`;
    el.replaceWith(caption);
  });
  root.querySelectorAll('*').forEach(el => {
    const href = el.tagName === 'A' ? el.getAttribute('href') : null;
    const span = el.tagName === 'TD' || el.tagName === 'TH' ? { colspan: el.getAttribute('colspan'), rowspan: el.getAttribute('rowspan') } : null;
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    if (href && /^https?:\/\//i.test(href)) {
      el.setAttribute('href', href);
      if (el.textContent !== href) el.append(` (${href})`);
    }
    if (span) for (const [key, value] of Object.entries(span)) if (value && /^\d{1,2}$/.test(value)) el.setAttribute(key, value);
  });
  return root.innerHTML;
}

export function printDefinition(pages: { title: string; html: string }[], options: PrintOptions): TDocumentDefinitions {
  const content: Content[] = [];
  pages.forEach((page, i) => {
    const parsed = new DOMParser().parseFromString(page.html, 'text/html');
    const startsWithTitle = parsed.body.firstElementChild?.tagName === 'H1';
    const converted = htmlToPdfmake(page.html, { tableAutoSize: true, defaultStyles: {
      h1: { fontSize: options.fontSize + 10, bold: true, margin: [0, 0, 0, 14] },
      h2: { fontSize: options.fontSize + 4, bold: true, margin: [0, 14, 0, 6] },
      h3: { fontSize: options.fontSize + 1, bold: true, margin: [0, 10, 0, 5] },
      p: { margin: [0, 0, 0, 9] }, a: { color: '#222222', decoration: 'underline' },
    } });
    content.push({ stack: [
      ...(!startsWithTitle ? [{ text: page.title, fontSize: options.fontSize + 10, bold: true, margin: [0, 0, 0, 14] } as Content] : []),
      ...((Array.isArray(converted) ? converted : [converted]) as unknown as Content[]),
    ], ...(i ? { pageBreak: 'before' as const } : {}) });
  });
  return {
    info: { title: pages[0]?.title ?? 'Lesson', creator: 'Scripture Graph' },
    pageSize: options.paper, pageMargins: [42, 42, 42, 44],
    defaultStyle: { font: 'Roboto', fontSize: options.fontSize, lineHeight: 1.25, color: '#111111' },
    content,
    footer: (page, count) => ({ text: `${page} / ${count}`, alignment: 'center', fontSize: 9, color: '#555555', margin: [0, 14, 0, 0] }),
    pageBreakBefore: (node, following) => !!node.style && [node.style].flat().some(s => typeof s === 'string' && /^html-h[123]$/.test(s)) && !following.length,
  };
}

export function createPrintPdf(pages: { title: string; html: string }[], options: PrintOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try { pdfMake.createPdf(printDefinition(pages, options)).getBlob(resolve); }
    catch (error) { reject(error); }
  });
}
