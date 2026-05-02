import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { TunnelSession } from '../../schema/tunnel-session.schema';
import { IMessageSender, MESSAGE_SENDER } from '../../common/messaging/messaging.interface';
import { generateTag } from '../../common/utils/tag-generator';
import { SUPABASE_CLIENT } from '../../supabase/supabase.module';

const TUNNEL_DURATION_HOURS = 24;
const TUNNEL_MESSAGE_LIMIT = 7;
const RECIPIENT_SENDER_TAG = 'admirador';

@Injectable()
export class TunnelService {
  private readonly logger = new Logger(TunnelService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(MESSAGE_SENDER) private readonly messageSender: IMessageSender,
  ) {}

  async open(senderPhone: string, recipientPhone: string, recipientName: string, senderName: string): Promise<void> {
    const tag = await this.generateUniqueTag(senderPhone, recipientName);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TUNNEL_DURATION_HOURS);

    const { error } = await this.supabase
      .from('tunnel_sessions')
      .insert({
        tunnel_id: uuidv4(),
        sender_phone: senderPhone,
        recipient_phone: recipientPhone,
        sender_name: senderName,
        status: 'ACTIVE',
        messages_remaining: TUNNEL_MESSAGE_LIMIT,
        expires_at: expiresAt.toISOString(),
        tag,
      });

    if (error) throw new Error(`Erro ao criar tunnel session: ${error.message}`);

    this.logger.log(`Túnel aberto entre ${senderPhone} e ${recipientPhone} com tag #${tag}`);

    await this.messageSender.send(
      senderPhone,
      `💌 Seu admirado aceitou entrar no túnel!\n\n` +
      `Você tem ${TUNNEL_MESSAGE_LIMIT} mensagens para enviar.\n\n` +
      `Para falar com ele(a), comece sua mensagem com *#${tag}*\n` +
      `Exemplo: #${tag} Oi, sou eu! 😊`,
    );

    await this.messageSender.send(
      recipientPhone,
      `✨ Túnel aberto! Aguarde a mensagem do seu admirador secreto...\n\n` +
      `Para responder, comece sua mensagem com *#${RECIPIENT_SENDER_TAG}*\n` +
      `Exemplo: #${RECIPIENT_SENDER_TAG} Que surpresa! 💬`,
    );
  }

  async findActiveSession(phone: string): Promise<TunnelSession | null> {
    const now = new Date().toISOString();
    const { data } = await this.supabase
      .from('tunnel_sessions')
      .select('*')
      .or(`sender_phone.eq.${phone},recipient_phone.eq.${phone}`)
      .eq('status', 'ACTIVE')
      .gt('expires_at', now)
      .limit(1)
      .maybeSingle();

    return data ? this.mapRow(data) : null;
  }

  async findSessionByTag(phone: string, tag: string): Promise<TunnelSession | null> {
    const now = new Date().toISOString();
    const normalizedTag = tag.toLowerCase();

    const { data: asSender } = await this.supabase
      .from('tunnel_sessions')
      .select('*')
      .eq('sender_phone', phone)
      .eq('tag', normalizedTag)
      .eq('status', 'ACTIVE')
      .gt('expires_at', now)
      .maybeSingle();

    if (asSender) return this.mapRow(asSender);

    if (normalizedTag === RECIPIENT_SENDER_TAG) {
      const { data } = await this.supabase
        .from('tunnel_sessions')
        .select('*')
        .eq('recipient_phone', phone)
        .eq('status', 'ACTIVE')
        .gt('expires_at', now)
        .maybeSingle();

      return data ? this.mapRow(data) : null;
    }

    return null;
  }

  async findAllActiveSessions(phone: string): Promise<TunnelSession[]> {
    const now = new Date().toISOString();
    const { data } = await this.supabase
      .from('tunnel_sessions')
      .select('*')
      .or(`sender_phone.eq.${phone},recipient_phone.eq.${phone}`)
      .eq('status', 'ACTIVE')
      .gt('expires_at', now);

    return (data ?? []).map(this.mapRow);
  }

  async relay(session: TunnelSession, fromPhone: string, message: string): Promise<void> {
    const isSender = session.senderPhone === fromPhone;

    if (isSender) {
      await this.relaySenderMessage(session, message);
    } else {
      await this.relayRecipientMessage(session, message);
    }
  }

  private async relaySenderMessage(session: TunnelSession, message: string): Promise<void> {
    const remaining = session.messagesRemaining - 1;

    await this.supabase
      .from('tunnel_sessions')
      .update({
        messages_remaining: remaining,
        ...(remaining === 0 && { status: 'DONE' }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (remaining > 0) {
      await this.messageSender.send(
        session.recipientPhone,
        `_Admirador_: ${message}\n\nRestam ${remaining} mensagens — agora é sua vez...\n` +
        `(Responda com *#${RECIPIENT_SENDER_TAG}* para ele(a) te ouvir)`,
      );

      await this.messageSender.send(
        session.senderPhone,
        `✓ Mensagem enviada! Restam *${remaining}* mensagens no túnel. Aguarde a resposta.`,
      );
    } else {
      await this.messageSender.send(
        session.recipientPhone,
        `_Admirador_: ${message}`,
      );

      await this.messageSender.send(
        session.senderPhone,
        `✓ Última mensagem enviada! O túnel será encerrado.`,
      );

      await this.closeTunnel(session);
    }
  }

  private async relayRecipientMessage(session: TunnelSession, message: string): Promise<void> {
    await this.messageSender.send(
      session.senderPhone,
      `_${session.senderName}_: ${message}`,
    );

    await this.messageSender.send(
      session.recipientPhone,
      `✓ Mensagem enviada!`,
    );
  }

  private async closeTunnel(session: TunnelSession): Promise<void> {
    this.logger.log(`Túnel encerrado entre ${session.senderPhone} e ${session.recipientPhone}`);

    const closeMessage =
      `💫 O túnel chegou ao fim!\n\n` +
      `Foi uma experiência única, não foi? Continue enviando mensagens anônimas pelo CatChat:\n` +
      `catchat.com.br`;

    await this.messageSender.send(session.senderPhone, closeMessage);
    await this.messageSender.send(session.recipientPhone, closeMessage);
  }

  @Cron('0 * * * *')
  async expireActiveSessions(): Promise<void> {
    const now = new Date().toISOString();
    const { data: expired } = await this.supabase
      .from('tunnel_sessions')
      .select('*')
      .eq('status', 'ACTIVE')
      .lte('expires_at', now);

    for (const row of expired ?? []) {
      await this.expireSession(this.mapRow(row));
    }
  }

  async expireSession(session: TunnelSession): Promise<void> {
    await this.supabase
      .from('tunnel_sessions')
      .update({ status: 'DONE', updated_at: new Date().toISOString() })
      .eq('id', session.id);

    const expiredMessage =
      `⏰ O túnel expirou após ${TUNNEL_DURATION_HOURS}h de inatividade.\n\n` +
      `Acesse o CatChat para uma nova experiência:\ncatchat.com.br`;

    await this.messageSender.send(session.senderPhone, expiredMessage);
    await this.messageSender.send(session.recipientPhone, expiredMessage);
  }

  private async generateUniqueTag(senderPhone: string, recipientName: string): Promise<string> {
    const { data } = await this.supabase
      .from('tunnel_sessions')
      .select('tag')
      .eq('sender_phone', senderPhone)
      .eq('status', 'ACTIVE');

    const existingTags = (data ?? []).map((s: any) => s.tag);
    return generateTag(recipientName, existingTags);
  }

  private mapRow(row: any): TunnelSession {
    return {
      id: row.id,
      tunnel_id: row.tunnel_id,
      senderPhone: row.sender_phone,
      recipientPhone: row.recipient_phone,
      senderName: row.sender_name,
      status: row.status,
      messagesRemaining: row.messages_remaining,
      expiresAt: row.expires_at,
      tag: row.tag,
    };
  }
}
