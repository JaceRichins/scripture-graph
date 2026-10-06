// Test boundary for Obsidian's native icons and notices; production uses Obsidian.
export class Notice { constructor(message){(window.playerNotices??=[]).push(message);} }
export class Menu {}
export const requestUrl=async()=>({status:200});
const shapes={
  'skip-back':'<path d="m19 20-9-8 9-8z"/><path d="M5 19V5"/>',
  'skip-forward':'<path d="m5 4 9 8-9 8z"/><path d="M19 5v14"/>',
  rewind:'<path d="m11 19-9-7 9-7zM22 19l-9-7 9-7z"/>',
  'fast-forward':'<path d="m2 5 9 7-9 7zM13 5l9 7-9 7z"/>',
  play:'<path d="m6 3 14 9-14 9z"/>',pause:'<path d="M7 4v16M17 4v16"/>',
  'rotate-ccw':'<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
  x:'<path d="m6 6 12 12M6 18 18 6"/>',music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
};
export function setIcon(el,name){el.innerHTML='<svg class="lucide lucide-'+name+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(shapes[name]||'')+'</svg>';}
