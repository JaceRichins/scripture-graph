/** Only shared reading pages may be sent by link; personal notes stay private. */
export function shareablePage(path: string): boolean {
  return path.length <= 1024 && path.startsWith('AI Library/') && path.endsWith('.md')
    && !path.startsWith('AI Library/00 System/') && !/[\\:#\x00-\x1f]/.test(path)
    && path.split('/').every(part => !!part && !part.startsWith('.'));
}

export interface PageRecipient { user_id: string; display_name: string }
export interface SharedPage {
  id: number; sender_name: string; path: string; title: string;
  message: string; created_at: string; read_at: string | null;
}
export interface PageInbox { items: SharedPage[]; unread: number; next: number | null }
export interface SentPage extends Omit<SharedPage, 'sender_name'> { recipient_name: string }
export interface PageOutbox { items: SentPage[]; next: number | null }
