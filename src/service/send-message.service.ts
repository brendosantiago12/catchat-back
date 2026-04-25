import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SendMessage } from '../schema/send-message.schema';
import { SendMessageDto } from '../dto/send-message.dto';
import { IMessageSender, MESSAGE_SENDER } from '../common/messaging/messaging.interface';
import { MessageDeliveryService } from '../assistent/services/message-delivery.service';
import { WhatsappFormatter } from '../assistent/whatsapp/whatsappFormater.service';

@Injectable()
export class SendMessageService {
  constructor(
    @InjectModel(SendMessage.name)
    private sendMessageModel: Model<SendMessage>,
    @Inject(MESSAGE_SENDER)
    private readonly messageSender: IMessageSender,
    private readonly messageDeliveryService: MessageDeliveryService,
    private readonly formatter: WhatsappFormatter,
  ) {}

  async sendMessage(dto: SendMessageDto) {
    const senderPhone = this.formatter.formatPhoneNumber(dto.senderPhone).replace('@c.us', '');
    const recipientPhone = this.formatter.formatPhoneNumber(dto.recipientPhone).replace('@c.us', '');

    await this.sendMessageModel.create({
      senderName: dto.senderName,
      senderPhone,
      senderMessage: dto.senderMessage,
      recipientName: dto.recipientName,
      recipientPhone,
      status: false,
      recipientState: 'WAITING_READ',
      productType: dto.productType,
    });

    await this.messageDeliveryService.sendWelcome(recipientPhone, dto.recipientName);

    await this.messageSender.send(
      dto.senderPhone,
      `Olá ${dto.senderName}, sua mensagem foi encaminhada!! \n\nClick abaixo e continue enviando mensagens:\ncatchat.com.br`,
    );
  }
}
