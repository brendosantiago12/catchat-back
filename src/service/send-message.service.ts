import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SendMessage } from '../schema/send-message.schema';
import { SendMessageDto } from '../dto/send-message.dto';
import { AiService } from '../assistent/ai/ai.service';

// {
//     "senderName": "João Silva",
//     "senderPhone": "+5511999999999",
//     "senderMessage": "Olá, tudo bem? Gostaria de te conhecer melhor!",
//     "recipientName": "Brendo Santiago",
//     "recipientPhone": "8192549672"
//   }

// {
//     "senderName": "João Silva",
//     "senderPhone": "+5511999999999",
//     "senderMessage": "Olá, tudo bem? Gostaria de te conhecer melhor!",
//     "recipientName": "Brendo Santiago",
//     "recipientPhone": "+5581992549672"
//   }

@Injectable()
export class SendMessageService {
  constructor(
    @InjectModel(SendMessage.name)
    private sendMessageModel: Model<SendMessage>,
    private readonly aiService: AiService,
  ) {}

  async sendMessage(dto: SendMessageDto) {
    console.log('SendMessageService.sendMessage', dto);

    // Salva no banco
    await this.sendMessageModel.create({
      senderName: dto.senderName,
      senderPhone: this.formatPhoneNumber(dto.senderPhone),
      senderMessage: dto.senderMessage,
      recipientName: dto.recipientName,
      recipientPhone: this.formatPhoneNumber(dto.recipientPhone),
    });
    // Chama o AI
    await this.aiService.processMessage(
      this.formatPhoneNumber(dto.recipientPhone),
      'boas vindas',
    );

    return this.aiService.processMessage(
      this.formatPhoneNumber(dto.senderPhone),
      'alerta de envio',
    );
  }

  private formatPhoneNumber(phone: string): string {
    let cleanNumber = phone.replace(/\D/g, '');
    if (cleanNumber.length >= 11) {
      cleanNumber = cleanNumber.slice(0, 2) + cleanNumber.slice(3);
    }
    return cleanNumber;
  }
}
