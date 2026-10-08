import { PaymentOrder, Entitlement, UserAccountInfo } from './types';
import { getUserStorageKey, purgeLegacyGlobalStorage } from '../persistence/storageNamespace';
import { authService } from '../persistence/authService';
import { getSupabase } from '../persistence/supabaseClient';

export class PaymentService {
  private memoryOrders: PaymentOrder[] | null = null;
  private memoryAccount: UserAccountInfo | null = null;
  private currentUserId: string | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    purgeLegacyGlobalStorage();
    this.initAuthListener();
  }

  private initAuthListener(): void {
    authService.onAuthStateChange((user) => {
      const newUserId = user?.id || null;
      if (newUserId !== this.currentUserId) {
        this.currentUserId = newUserId;
        this.memoryOrders = null;
        this.memoryAccount = null;
        this.loadCloudData();
        this.notify();
      }
    });
  }

  private getEffectiveUserId(): string | null {
    if (this.currentUserId) return this.currentUserId;
    return authService.getCurrentUser()?.id || null;
  }

  private getAccountKey(): string {
    return getUserStorageKey('account', this.getEffectiveUserId());
  }

  private getOrdersKey(): string {
    return getUserStorageKey('orders', this.getEffectiveUserId());
  }

  private getEntitlementsKey(): string {
    return getUserStorageKey('entitlements', this.getEffectiveUserId());
  }

  /**
   * Loads orders and entitlements from Supabase if authenticated
   */
  public async loadCloudData(): Promise<void> {
    const supabase = getSupabase();
    const user = authService.getCurrentUser();

    if (!supabase || !user) return;

    try {
      // 1. Fetch Cloud Orders
      const { data: cloudOrders, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!orderErr && cloudOrders) {
        const mappedOrders: PaymentOrder[] = cloudOrders.map((row: any) => ({
          orderId: row.id,
          productId: row.product_id || row.id,
          productName: row.product_name || row.id,
          amount: row.total_amount,
          currency: row.currency || 'VND',
          status: row.status,
          createdAt: row.created_at,
          paidAt: row.updated_at,
        }));

        const current = this.memoryOrders || [];
        const merged = [...current];
        for (const m of mappedOrders) {
          const idx = merged.findIndex((o) => o.orderId === m.orderId);
          if (idx >= 0) {
            merged[idx] = m;
          } else {
            merged.push(m);
          }
        }

        this.memoryOrders = merged;
        try {
          localStorage.setItem(this.getOrdersKey(), JSON.stringify(merged));
        } catch {}
      }

      // 2. Fetch Cloud Entitlements
      const { data: cloudEntitlements, error: entErr } = await supabase
        .from('entitlements')
        .select('*')
        .eq('user_id', user.id);

      if (!entErr && cloudEntitlements) {
        const entKeys = cloudEntitlements.map((e: any) => e.feature_key || e.product_id).filter(Boolean);
        const acc = this.getAccountInfo();
        acc.entitlements = Array.from(new Set([...acc.entitlements, ...entKeys]));
        this.memoryAccount = acc;
        try {
          localStorage.setItem(this.getAccountKey(), JSON.stringify(acc));
        } catch {}
      }

      this.notify();
    } catch (err) {
      console.warn('Error loading cloud payment data:', err);
    }
  }

  public getAccountInfo(): UserAccountInfo {
    if (this.memoryAccount) {
      return this.memoryAccount;
    }

    const userId = this.getEffectiveUserId();
    const user = authService.getCurrentUser();

    try {
      const raw = localStorage.getItem(this.getAccountKey());
      if (raw) {
        this.memoryAccount = JSON.parse(raw);
        return this.memoryAccount!;
      }
    } catch {}

    const defaultAcc: UserAccountInfo = {
      id: userId || 'guest',
      email: user?.email || 'guest@circuitcraft.io',
      plan: 'free',
      aiQueriesUsed: 0,
      aiQueriesLimit: 50,
      projectsCount: 0,
      projectsLimit: 10,
      entitlements: [],
    };

    this.memoryAccount = defaultAcc;
    try {
      localStorage.setItem(this.getAccountKey(), JSON.stringify(defaultAcc));
    } catch {}

    return defaultAcc;
  }

  public updatePlan(plan: 'free' | 'student' | 'creator'): void {
    const acc = this.getAccountInfo();
    acc.plan = plan;
    if (plan === 'student') {
      acc.aiQueriesLimit = 200;
      acc.projectsLimit = 50;
      acc.entitlements = acc.entitlements.filter(
        (e) => e !== 'plan-creator' && e !== 'creator_tier'
      );
    } else if (plan === 'creator') {
      acc.aiQueriesLimit = 1000;
      acc.projectsLimit = 500;
      if (!acc.entitlements.includes('plan-creator')) {
        acc.entitlements.push('plan-creator');
      }
      if (!acc.entitlements.includes('creator_tier')) {
        acc.entitlements.push('creator_tier');
      }
    } else {
      acc.aiQueriesLimit = 50;
      acc.projectsLimit = 10;
      acc.entitlements = acc.entitlements.filter(
        (e) => e !== 'plan-creator' && e !== 'creator_tier' && e !== 'plan-student'
      );
    }
    this.memoryAccount = acc;
    try {
      localStorage.setItem(this.getAccountKey(), JSON.stringify(acc));
    } catch {}

    // Sync user role with purchased plan
    authService.updateRole(plan === 'creator' ? 'creator' : plan === 'student' ? 'pro' : 'user').catch(() => {});

    // Also sync to Supabase subscriptions if connected
    const supabase = getSupabase();
    const user = authService.getCurrentUser();
    if (supabase && user) {
      supabase
        .from('subscriptions')
        .upsert(
          {
            user_id: user.id,
            plan_id: plan,
            status: 'active',
            ai_queries_limit: acc.aiQueriesLimit,
            projects_limit: acc.projectsLimit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.warn('Subscriptions table sync note:', error.message);
        });
    }

    this.notify();
  }

  public hasCreatorPlan(): boolean {
    const acc = this.getAccountInfo();
    return (
      acc.plan === 'creator' ||
      acc.entitlements.includes('plan-creator') ||
      acc.entitlements.includes('creator_tier')
    );
  }

  public recordAiQuery(): void {
    const acc = this.getAccountInfo();
    acc.aiQueriesUsed += 1;
    this.memoryAccount = acc;
    try {
      localStorage.setItem(this.getAccountKey(), JSON.stringify(acc));
    } catch {}
    this.notify();
  }

  public hasEntitlement(productId: string): boolean {
    const acc = this.getAccountInfo();
    return acc.entitlements.includes(productId);
  }

  public grantEntitlement(productId: string): void {
    const acc = this.getAccountInfo();
    if (!acc.entitlements.includes(productId)) {
      acc.entitlements.push(productId);
      this.memoryAccount = acc;
      try {
        localStorage.setItem(this.getAccountKey(), JSON.stringify(acc));
      } catch {}
      this.notify();
    }
  }

  /**
   * Creates a sandbox payment order
   */
  public async createOrder(productId: string, productName: string, amount: number): Promise<PaymentOrder> {
    const user = authService.getCurrentUser();
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const order: PaymentOrder = {
      orderId,
      productId,
      productName,
      amount,
      currency: 'VND',
      status: 'pending',
      createdAt: nowIso,
    };

    // Save locally under user's key
    const orders = this.getOrders();
    orders.unshift(order);
    this.memoryOrders = orders;
    try {
      localStorage.setItem(this.getOrdersKey(), JSON.stringify(orders));
    } catch {}

    // Save to Supabase orders table if authenticated
    const supabase = getSupabase();
    if (supabase && user) {
      try {
        await supabase.from('orders').insert({
          id: orderId,
          user_id: user.id,
          status: 'pending',
          total_amount: amount,
          currency: 'VND',
          created_at: nowIso,
          updated_at: nowIso,
        });
      } catch (err) {
        console.warn('Could not insert order to Supabase:', err);
      }
    }

    this.notify();
    return order;
  }

  /**
   * Registers or updates an order in client memory and storage
   */
  public registerOrder(orderData: Partial<PaymentOrder> & { orderId: string }): PaymentOrder {
    const orders = this.getOrders();
    const existingIndex = orders.findIndex((o) => o.orderId === orderData.orderId);

    const fullOrder: PaymentOrder = {
      orderId: orderData.orderId,
      productId: orderData.productId || (orderData as any).courseId || 'product-unknown',
      productName:
        orderData.productName ||
        (orderData as any).productTitle ||
        (orderData as any).courseTitle ||
        'Sản phẩm CircuitCraft',
      amount: orderData.amount || 0,
      currency: 'VND',
      status: orderData.status || 'pending',
      createdAt: orderData.createdAt || new Date().toISOString(),
      paidAt: orderData.paidAt,
    };

    if (existingIndex >= 0) {
      orders[existingIndex] = { ...orders[existingIndex], ...fullOrder };
    } else {
      orders.unshift(fullOrder);
    }

    this.memoryOrders = orders;
    try {
      localStorage.setItem(this.getOrdersKey(), JSON.stringify(orders));
    } catch {}

    this.notify();
    return fullOrder;
  }

  /**
   * Simulates Sandbox Payment Execution (Idempotent, assigns entitlement)
   */
  public async processSandboxPayment(
    orderId: string,
    fallback?: Partial<PaymentOrder>
  ): Promise<{ success: boolean; order: PaymentOrder }> {
    const orders = this.getOrders();
    let target = orders.find((o) => o.orderId === orderId);

    // 1. If not found in local cache, query backend status endpoint
    if (!target && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.order) {
            target = this.registerOrder({
              orderId: data.order.orderId || orderId,
              productId: data.order.productId,
              productName: data.order.productTitle || data.order.productId,
              amount: data.order.amount,
              currency: data.order.currency || 'VND',
              status: data.order.status || 'pending',
              createdAt: data.order.createdAt,
            });
          }
        }
      } catch (e) {
        console.warn('Could not query order status from server:', e);
      }
    }

    // 2. If still not found and fallback provided, register fallback order
    if (!target && fallback) {
      target = this.registerOrder({
        orderId,
        productId: fallback.productId || 'product-unknown',
        productName: fallback.productName || 'Sản phẩm CircuitCraft',
        amount: fallback.amount || 0,
        currency: 'VND',
        status: 'pending',
      });
    }

    // 3. Fallback: synthesize valid order so payment flow never fails with fatal error
    if (!target) {
      target = this.registerOrder({
        orderId,
        productId: orderId,
        productName: `Đơn hàng ${orderId}`,
        amount: 0,
        currency: 'VND',
        status: 'pending',
      });
    }

    const nowIso = new Date().toISOString();
    target.status = 'paid';
    target.paidAt = nowIso;
    this.memoryOrders = orders;
    try {
      localStorage.setItem(this.getOrdersKey(), JSON.stringify(orders));
    } catch {}

    // Grant entitlement to current account
    const acc = this.getAccountInfo();
    if (!acc.entitlements.includes(target.productId)) {
      acc.entitlements.push(target.productId);
      this.memoryAccount = acc;
      try {
        localStorage.setItem(this.getAccountKey(), JSON.stringify(acc));
      } catch {}
    }

    // Sync status and entitlement to Supabase if connected
    const supabase = getSupabase();
    const user = authService.getCurrentUser();
    if (supabase && user) {
      try {
        // Update order status
        await supabase
          .from('orders')
          .update({
            status: 'paid',
            updated_at: nowIso,
          })
          .eq('id', orderId)
          .eq('user_id', user.id);

        // Insert entitlement
        const entId = `ent_${user.id.substring(0, 8)}_${target.productId}`;
        await supabase.from('entitlements').upsert(
          {
            id: entId,
            user_id: user.id,
            feature_key: target.productId,
            granted_at: nowIso,
          },
          { onConflict: 'id' }
        );
      } catch (err) {
        console.warn('Supabase order/entitlement payment sync error:', err);
      }
    }

    this.notify();
    return { success: true, order: target };
  }

  public getOrders(): PaymentOrder[] {
    if (this.memoryOrders !== null) {
      return this.memoryOrders;
    }

    try {
      const raw = localStorage.getItem(this.getOrdersKey());
      if (raw) {
        this.memoryOrders = JSON.parse(raw);
        return this.memoryOrders || [];
      }
    } catch {}

    this.memoryOrders = [];
    return [];
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {}
    }
  }

  public clearCache(): void {
    this.memoryOrders = null;
    this.memoryAccount = null;
    this.notify();
  }
}

export const paymentService = new PaymentService();
