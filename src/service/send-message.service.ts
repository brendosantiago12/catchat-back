import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SendMessageDto } from '../dto/send-message.dto';
import { IMessageSender, MESSAGE_SENDER } from '../common/messaging/messaging.interface';
import { MessageDeliveryService } from '../assistent/services/message-delivery.service';
import { WhatsappFormatter } from '../assistent/whatsapp/whatsappFormater.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

@Injectable()
export class SendMessageService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(MESSAGE_SENDER) private readonly messageSender: IMessageSender,
    private readonly messageDeliveryService: MessageDeliveryService,
    private readonly formatter: WhatsappFormatter,
  ) {}

  async sendMessage(dto: SendMessageDto) {
    const senderPhone = this.formatter.formatPhoneNumber(dto.senderPhone).replace('@c.us', '');
    const recipientPhone = this.formatter.formatPhoneNumber(dto.recipientPhone).replace('@c.us', '');

    const { error } = await this.supabase
      .from('send_messages')
      .insert({
        sender_name: dto.senderName,
        sender_phone: senderPhone,
        sender_message: dto.senderMessage,
        recipient_name: dto.recipientName,
        recipient_phone: recipientPhone,
        status: false,
        recipient_state: 'WAITING_READ',
        product_type: dto.productType,
      });

    if (error) throw new Error(`Erro ao salvar send_message: ${error.message}`);

    await this.messageDeliveryService.sendWelcome(recipientPhone, dto.recipientName);

    await this.messageSender.send(
      dto.senderPhone,
      `Olá ${dto.senderName}, sua mensagem foi encaminhada!! \n\nClick abaixo e continue enviando mensagens:\ncatchat.com.br`,
    );
  }
}
