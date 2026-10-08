export type PaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export interface PaymentOrder {
  orderId: string;
  productId: string;
  productName: string;
  amount: number;
  currency: 'VND';
  status: PaymentOrderStatus;
  createdAt: string;
  paidAt?: string;
}

export interface Entitlement {
  id: string;
  productId: string;
  acquiredAt: string;
  type: 'purchase' | 'subscription';
}

export interface UserAccountInfo {
  id: string;
  email: string;
  plan: 'free' | 'student' | 'creator';
  aiQueriesUsed: number;
  aiQueriesLimit: number;
  projectsCount: number;
  projectsLimit: number;
  entitlements: string[]; // product IDs owned
}
