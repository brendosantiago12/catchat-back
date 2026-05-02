export type RecipientState = 'WAITING_READ' | 'WAITING_TUNNEL' | 'TUNNEL_ACTIVE' | 'DONE';
export type ProductType = 'MESSAGE_ONLY' | 'MESSAGE_TUNNEL' | 'UNLIMITED';

export interface SendMessage {
  id?: string;
  senderName: string;
  senderPhone: string;
  senderMessage: string;
  recipientName: string;
  recipientPhone: string;
  status: boolean;
  recipientState: RecipientState;
  productType: ProductType;
  created_at?: string;
  updated_at?: string;
}
