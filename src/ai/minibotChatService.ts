import { AIChatMessage } from './types';
import { getUserStorageKey } from '../persistence/storageNamespace';
import { getSupabase } from '../persistence/supabaseClient';
import { authService } from '../persistence/authService';

export const DEFAULT_MINIBOT_WELCOME: AIChatMessage = {
  id: 'msg-welcome',
  role: 'assistant',
  content: 'Xin chào! Tôi là Minibot 3D. Tôi có thể hỗ trợ bạn thiết kế mạch, giải thích nguyên lý và kiểm tra quy tắc an toàn.',
  timestamp: new Date().toISOString(),
};

export class MinibotChatService {
  private currentUserId: string | null = null;
  private cachedMessages: AIChatMessage[] = [];
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;

  constructor() {
    // Initial sync with current logged in user if available
    const initialUser = authService.getCurrentUser();
    this.currentUserId = initialUser ? initialUser.id : null;
    this.loadMessagesFromStorage();

    // Listen to auth changes to switch conversation thread per account
    authService.onAuthStateChange((user) => {
      const newId = user ? user.id : null;
      if (this.currentUserId !== newId || !this.isInitialized) {
        this.currentUserId = newId;
        this.loadMessagesFromStorage();
        this.syncWithCloud();
        this.notify();
      }
    });
  }

  private getStorageKey(): string {
    return getUserStorageKey('minibot_chat_v1', this.currentUserId);
  }

  private loadMessagesFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      this.cachedMessages = [{ ...DEFAULT_MINIBOT_WELCOME, timestamp: new Date().toISOString() }];
      this.isInitialized = true;
      return;
    }

    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cachedMessages = parsed;
          this.isInitialized = true;
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to parse minibot chat from storage:', err);
    }

    // Default conversation for a fresh account
    this.cachedMessages = [{ ...DEFAULT_MINIBOT_WELCOME, timestamp: new Date().toISOString() }];
    this.isInitialized = true;
  }

  private saveMessagesToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.cachedMessages));
    } catch (err) {
      console.warn('Failed to save minibot chat to storage:', err);
    }
  }

  /**
   * Sync with Supabase cloud table if authenticated
   */
  public async syncWithCloud(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !this.currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('minibot_chat_messages')
        .select('*')
        .eq('user_id', this.currentUserId)
        .order('created_at', { ascending: true });

      if (error) {
        // Table may not exist yet if migration hasn't been run
        return;
      }

      if (data && data.length > 0) {
        const cloudMessages: AIChatMessage[] = data.map((row: any) => ({
          id: row.id,
          role: row.role as 'user' | 'assistant' | 'system',
          content: row.content,
          timestamp: row.created_at,
          proposal: row.proposal || undefined,
        }));

        this.cachedMessages = cloudMessages;
        this.saveMessagesToStorage();
        this.notify();
      }
    } catch (err) {
      console.warn('Minibot chat cloud sync notice:', err);
    }
  }

  public getMessages(): AIChatMessage[] {
    if (!this.isInitialized) {
      this.loadMessagesFromStorage();
    }
    return [...this.cachedMessages];
  }

  public async addMessage(msg: AIChatMessage): Promise<void> {
    this.cachedMessages.push(msg);
    this.saveMessagesToStorage();
    this.notify();

    // Async sync to Supabase
    const supabase = getSupabase();
    if (supabase && this.currentUserId) {
      try {
        await supabase.from('minibot_chat_messages').insert({
          id: msg.id,
          user_id: this.currentUserId,
          role: msg.role,
          content: msg.content,
          proposal: msg.proposal || null,
          created_at: msg.timestamp,
        });
      } catch (err) {
        // Silently catch if table is not yet deployed
      }
    }
  }

  public async clearChat(): Promise<void> {
    this.cachedMessages = [{ ...DEFAULT_MINIBOT_WELCOME, timestamp: new Date().toISOString() }];
    this.saveMessagesToStorage();
    this.notify();

    // Delete in Supabase if logged in
    const supabase = getSupabase();
    if (supabase && this.currentUserId) {
      try {
        await supabase
          .from('minibot_chat_messages')
          .delete()
          .eq('user_id', this.currentUserId);
      } catch (err) {
        // Silently catch
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Error in minibot chat subscriber:', e);
      }
    }
  }
}

export const minibotChatService = new MinibotChatService();
