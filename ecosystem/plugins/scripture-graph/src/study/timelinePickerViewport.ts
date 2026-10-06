import { fitMobileModal } from './mobileModalViewport';

export function fitTimelinePicker(modal: HTMLElement): () => void {
  return fitMobileModal(modal, 'sg-tlp-mobile', 'sg-tlp-keyboard');
}
