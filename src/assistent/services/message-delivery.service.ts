import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { IMessageSender, MESSAGE_SENDER } from '../../common/messaging/messaging.interface';
import { SendMessage } from '../../schema/send-message.schema';
import { TunnelService } from './tunnel.service';
import { SUPABASE_CLIENT } from '../../supabase/supabase.module';

@Injectable()
export class MessageDeliveryService {
  private readonly logger = new Logger(MessageDeliveryService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(MESSAGE_SENDER) private readonly messageSender: IMessageSender,
    private readonly tunnelService: TunnelService,
  ) {}

  async sendWelcome(phone: string, name: string): Promise<void> {
    await this.messageSender.send(
      phone,
      `Ooi ${name} 💌\nParece que você tem um admirador secreto...\nDeseja ler a mensagem que ele(a) enviou?`,
    );

    this.logger.log(`Boas-vindas enviadas para ${phone}`);
  }

  async sendSecretMessage(phone: string): Promise<void> {
    const { data: rows } = await this.supabase
      .from('send_messages')
      .select('*')
      .eq('recipient_phone', phone)
      .eq('status', false)
      .order('created_at', { ascending: true });

    const messages: SendMessage[] = (rows ?? []).map(this.mapRow);

    if (messages.length === 0) {
      await this.messageSender.send(
        phone,
        `Não encontrei nenhuma mensagem secreta para você ainda... 🤫\n\n` +
        `Mas que tal enviar uma para alguém especial?\nAcesse: catchat.com.br`,
      );
      return;
    }

    const content = messages.map((msg) => msg.senderMessage).join('\n\n');

    await this.messageSender.send(phone, `_Admirer_:\n\n${content}`);

    const hasTunnel = messages.some(
      (msg) => msg.productType === 'MESSAGE_TUNNEL' || msg.productType === 'UNLIMITED',
    );

    if (hasTunnel) {
      await this.supabase
        .from('send_messages')
        .update({ status: true, recipient_state: 'WAITING_TUNNEL', updated_at: new Date().toISOString() })
        .eq('recipient_phone', phone)
        .eq('status', false);

      this.logger.log(`Carta entregue para ${phone}, aguardando decisão sobre túnel`);
      await this.askTunnel(phone);
    } else {
      await this.supabase
        .from('send_messages')
        .update({ status: true, recipient_state: 'DONE', updated_at: new Date().toISOString() })
        .eq('recipient_phone', phone)
        .eq('status', false);

      this.logger.log(`Carta entregue para ${phone} (produto sem túnel), encerrando`);

      await this.messageSender.send(
        phone,
        `💌 Esperamos que tenha gostado da mensagem!\n\n` +
        `Se quiser enviar uma mensagem secreta para alguém especial:\ncatchat.com.br`,
      );
    }
  }

  async askTunnel(phone: string): Promise<void> {
    await this.messageSender.send(
      phone,
      `💬 Gostaria de entrar no túnel com seu admirador secreto?\n\n` +
      `No túnel vocês poderão trocar até 15 mensagens anônimas entre si.\n\n` +
      `Responda *sim* para entrar ou *não* para encerrar.`,
    );
  }

  async openTunnel(recipientPhone: string): Promise<void> {
    const { data } = await this.supabase
      .from('send_messages')
      .select('*')
      .eq('recipient_phone', recipientPhone)
      .eq('status', true)
      .eq('recipient_state', 'WAITING_TUNNEL')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      this.logger.warn(`Nenhuma mensagem encontrada para abrir túnel com ${recipientPhone}`);
      return;
    }

    const message = this.mapRow(data);

    await this.supabase
      .from('send_messages')
      .update({ recipient_state: 'TUNNEL_ACTIVE', updated_at: new Date().toISOString() })
      .eq('id', data.id);

    await this.tunnelService.open(message.senderPhone, recipientPhone, message.recipientName, message.senderName);
  }

  private mapRow(row: any): SendMessage {
    return {
      id: row.id,
      senderName: row.sender_name,
      senderPhone: row.sender_phone,
      senderMessage: row.sender_message,
      recipientName: row.recipient_name,
      recipientPhone: row.recipient_phone,
      status: row.status,
      recipientState: row.recipient_state,
      productType: row.product_type,
    };
  }
}
