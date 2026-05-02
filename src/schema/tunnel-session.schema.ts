export type TunnelStatus = 'ACTIVE' | 'DONE';

export interface TunnelSession {
  id?: string;
  tunnel_id?: string;
  senderPhone: string;
  recipientPhone: string;
  senderName: string;
  status: TunnelStatus;
  messagesRemaining: number;
  expiresAt: Date;
  tag: string;
  created_at?: string;
  updated_at?: string;
}
