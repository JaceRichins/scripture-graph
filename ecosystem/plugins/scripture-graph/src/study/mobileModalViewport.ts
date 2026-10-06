/** Bound a mobile editor to the space above either the native iOS keyboard
 * or the browser visual viewport, without subtracting their overlap twice. */
export function fitMobileModal(modal: HTMLElement, pageClass: string, keyboardClass: string): () => void {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let fullHeight = Math.max(window.innerHeight, root.clientHeight);
  const fit = () => {
    const style = getComputedStyle(root);
    const keyboard = Math.max(0, parseFloat(style.getPropertyValue('--keyboard-height')) || 0);
    if (!keyboard) fullHeight = Math.max(window.innerHeight, root.clientHeight);
    const offset = viewport?.offsetTop ?? 0;
    const bottom = Math.min(offset + (viewport?.height ?? window.innerHeight), window.innerHeight, fullHeight - keyboard);
    const safeTop = parseFloat(style.getPropertyValue('--safe-area-inset-top')) || 0;
    const safeBottom = keyboard ? 0 : (parseFloat(style.getPropertyValue('--safe-area-inset-bottom')) || 0);
    const top = Math.max(offset, safeTop) + 8;
    modal.style.setProperty('--sg-modal-top', `${top}px`);
    modal.style.setProperty('--sg-modal-height', `${Math.max(0, bottom - top - safeBottom - 8)}px`);
    modal.classList.toggle(keyboardClass, keyboard > 0 || bottom - offset < fullHeight * 0.75);
  };
  modal.classList.add('sg-mobile-modal', pageClass);
  const observer = new MutationObserver(fit);
  observer.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
  observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
  viewport?.addEventListener('resize', fit);
  viewport?.addEventListener('scroll', fit);
  window.addEventListener('resize', fit);
  fit();
  return () => {
    observer.disconnect();
    viewport?.removeEventListener('resize', fit);
    viewport?.removeEventListener('scroll', fit);
    window.removeEventListener('resize', fit);
    modal.classList.remove('sg-mobile-modal', pageClass, keyboardClass);
    modal.style.removeProperty('--sg-modal-top');
    modal.style.removeProperty('--sg-modal-height');
  };
}
