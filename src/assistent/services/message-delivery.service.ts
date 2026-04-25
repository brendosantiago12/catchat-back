import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessageSender, MESSAGE_SENDER } from '../../common/messaging/messaging.interface';
import { SendMessage } from '../../schema/send-message.schema';
import { TunnelService } from './tunnel.service';

@Injectable()
export class MessageDeliveryService {
  private readonly logger = new Logger(MessageDeliveryService.name);

  constructor(
    @InjectModel(SendMessage.name)
    private readonly sendMessageModel: Model<SendMessage>,
    @Inject(MESSAGE_SENDER)
    private readonly messageSender: IMessageSender,
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
    const messages = await this.sendMessageModel
      .find({ recipientPhone: phone, status: false })
      .sort({ createdAt: 1 })
      .exec();

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

    // Verifica se alguma mensagem permite túnel
    const hasTunnel = messages.some(
      (msg) => msg.productType === 'MESSAGE_TUNNEL' || msg.productType === 'UNLIMITED',
    );

    if (hasTunnel) {
      await this.sendMessageModel.updateMany(
        { recipientPhone: phone, status: false },
        { $set: { status: true, recipientState: 'WAITING_TUNNEL' } },
      );

      this.logger.log(`Carta entregue para ${phone}, aguardando decisão sobre túnel`);
      await this.askTunnel(phone);
    } else {
      await this.sendMessageModel.updateMany(
        { recipientPhone: phone, status: false },
        { $set: { status: true, recipientState: 'DONE' } },
      );

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
    const message = await this.sendMessageModel
      .findOne({ recipientPhone, status: true, recipientState: 'WAITING_TUNNEL' })
      .sort({ createdAt: -1 })
      .exec();

    if (!message) {
      this.logger.warn(`Nenhuma mensagem encontrada para abrir túnel com ${recipientPhone}`);
      return;
    }

    await this.sendMessageModel.findByIdAndUpdate(message._id, {
      $set: { recipientState: 'TUNNEL_ACTIVE' },
    });

    await this.tunnelService.open(message.senderPhone, recipientPhone, message.recipientName, message.senderName);
  }
}
