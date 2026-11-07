/**
 * Independent Website Support AI Chat Service
 * Handles client-side messaging with account-level isolation and local persistence.
 */

export interface SupportChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface NavAction {
  target: 'landing' | 'projects' | 'courses' | 'marketplace' | 'membership' | 'creator' | 'admin' | 'account';
  labelVi: string;
  labelEn: string;
}

const GUEST_ID_KEY = 'circuitcraft_support_guest_id';

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'guest_default';
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }
  return guestId;
}

export function getStorageKey(userId?: string | null): string {
  if (userId) {
    return `circuitcraft_support_chat_user_${userId}`;
  }
  return `circuitcraft_support_chat_guest_${getOrCreateGuestId()}`;
}

export function loadSupportHistory(userId?: string | null): SupportChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load support chat history:', err);
    return [];
  }
}

export function saveSupportHistory(userId: string | null | undefined, messages: SupportChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(messages));
  } catch (err) {
    console.warn('Failed to save support chat history:', err);
  }
}

export function clearSupportHistory(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getStorageKey(userId));
  } catch (err) {
    console.warn('Failed to clear support chat history:', err);
  }
}

export async function sendSupportMessage(params: {
  prompt: string;
  history: SupportChatMessage[];
  locale: 'vi' | 'en';
  userId?: string | null;
}): Promise<string> {
  const { prompt, history, locale, userId } = params;
  const guestSessionId = userId ? undefined : getOrCreateGuestId();

  const res = await fetch('/api/support/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      history: history.slice(-8), // Send recent context window
      locale,
      userId: userId || null,
      guestSessionId,
    }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(
        locale === 'en'
          ? 'You are sending questions too fast. Please wait a moment!'
          : 'Bạn đang gửi câu hỏi quá nhanh. Vui lòng đợi trong giây lát!'
      );
    }
    throw new Error(
      locale === 'en'
        ? 'The assistant is busy or slow right now. Please send your question again.'
        : 'Trợ lý đang bận hoặc phản hồi chậm. Bạn gửi lại câu hỏi giúp mình nhé.'
    );
  }

  const data = await res.json();
  if (!data.reply) {
    throw new Error(locale === 'en' ? 'The assistant did not answer. Please send your question again.' : 'Trợ lý chưa trả lời. Bạn gửi lại câu hỏi giúp mình nhé.');
  }
  return data.reply;
}

/**
 * Extracts [nav:xyz] tokens and returns clean text + actions
 */
export function parseNavActions(text: string): { cleanText: string; actions: NavAction[] } {
  const navMap: Record<string, { labelVi: string; labelEn: string; target: NavAction['target'] }> = {
    projects: { labelVi: 'Vào Thiết kế 3D', labelEn: 'Launch 3D Lab', target: 'projects' },
    courses: { labelVi: 'Xem Khóa học', labelEn: 'Explore Courses', target: 'courses' },
    marketplace: { labelVi: 'Xem Cửa hàng', labelEn: 'Visit Marketplace', target: 'marketplace' },
    membership: { labelVi: 'Xem Gói thành viên', labelEn: 'View Memberships', target: 'membership' },
    creator: { labelVi: 'Studio Sáng tạo', labelEn: 'Creator Studio', target: 'creator' },
    account: { labelVi: 'Tài khoản của tôi', labelEn: 'My Account', target: 'account' },
    landing: { labelVi: 'Về Trang chủ', labelEn: 'Back to Home', target: 'landing' },
  };

  // The tag stands for a section name inside the sentence ("vào [nav:projects] để..."): keep a readable
  // name there, and offer the button below the answer
  const sectionNames: Record<string, string> = {
    projects: 'Thiết kế 3D',
    courses: 'Khóa học',
    marketplace: 'Cửa hàng',
    membership: 'Gói thành viên',
    creator: 'Studio Sáng tạo',
    account: 'Tài khoản',
    landing: 'Trang chủ',
  };
  const actions: NavAction[] = [];
  const cleanText = text
    // "[nav:projects] (Thiết kế 3D)": the words the model put in brackets become the inline name
    .replace(/\(?\[nav:([a-zA-Z0-9_-]+)\]\)?(?:\s*\(([^()\n]{1,40})\))?/g, (_, key: string, label?: string) => {
      const item = navMap[key.toLowerCase()];
      if (item && !actions.some((a) => a.target === item.target)) {
        actions.push(item);
      }
      if (!item) return label ? `(${label})` : '';
      return `**${(label || sectionNames[key.toLowerCase()]).trim()}**`;
    })
    .trim();

  return { cleanText, actions };
}
