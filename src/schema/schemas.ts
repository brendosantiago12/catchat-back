import { ProductType } from './send-message.schema';

export interface User {
  id?: string;
  user_id: string;
  nome: string;
  celular: string;
  email?: string;
  taxId: string;
  rate_limit: number;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  id?: string;
  user_id: string;
  id_compra: string;
  amount: number;
  expiresAt: string;
  qrCode: string;
  qrCodeUrl: string;
  status: string;
  productType: ProductType;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id?: string;
  id_mensagem: string;
  id_user: string;
  userName: string;
  numeroRemetente: string;
  nomeDestinario: string;
  numeroDestinario: string;
  mensagem: string;
  status_message: string;
  productType: ProductType;
  created_at?: string;
  updated_at?: string;
}
