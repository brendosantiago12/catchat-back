export interface OtpEntry {
  id?: string;
  userPhone: string;
  code: string;
  expiresAt: Date;
  used: boolean;
  created_at?: string;
}
