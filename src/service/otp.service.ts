import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { IMessageSender, MESSAGE_SENDER } from '../common/messaging/messaging.interface';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;
const OTP_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

@Injectable()
export class OtpService {
  // Rate limit em memória: phone → { count, windowStart }
  private readonly attempts = new Map<string, { count: number; windowStart: number }>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(MESSAGE_SENDER) private readonly messageSender: IMessageSender,
  ) {}

  async generateAndSend(userPhone: string): Promise<void> {
    const code = String(Math.floor(100000 + Math.random() * 900000));

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await this.supabase.from('otps').insert({
      user_phone: userPhone,
      code,
      expires_at: expiresAt.toISOString(),
      used: false,
    });

    await this.messageSender.send(
      userPhone,
      `🔑 Seu código de verificação CatChat: *${code}*\n\nVálido por ${OTP_EXPIRY_MINUTES} minutos. Não compartilhe com ninguém.`,
    );
  }

  async verify(userPhone: string, code: string): Promise<boolean> {
    if (this.isRateLimited(userPhone)) {
      return false;
    }

    const now = new Date().toISOString();
    const { data } = await this.supabase
      .from('otps')
      .select('id')
      .eq('user_phone', userPhone)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      this.recordAttempt(userPhone);
      return false;
    }

    await this.supabase.from('otps').update({ used: true }).eq('id', data.id);
    this.clearAttempts(userPhone);
    return true;
  }

  private isRateLimited(userPhone: string): boolean {
    const entry = this.attempts.get(userPhone);
    if (!entry) return false;
    if (Date.now() - entry.windowStart > OTP_WINDOW_MS) {
      this.attempts.delete(userPhone);
      return false;
    }
    return entry.count >= OTP_MAX_ATTEMPTS;
  }

  private recordAttempt(userPhone: string): void {
    const now = Date.now();
    const entry = this.attempts.get(userPhone);
    if (!entry || now - entry.windowStart > OTP_WINDOW_MS) {
      this.attempts.set(userPhone, { count: 1, windowStart: now });
    } else {
      entry.count++;
    }
  }

  private clearAttempts(userPhone: string): void {
    this.attempts.delete(userPhone);
  }
}
