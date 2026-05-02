export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED';

export interface Subscription {
  id?: string;
  userPhone: string;
  status: SubscriptionStatus;
  expiresAt: Date;
  created_at?: string;
  updated_at?: string;
}
