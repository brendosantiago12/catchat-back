import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SendMessage } from '../schema/send-message.schema';
import { SendMessageDto } from '../dto/send-message.dto';
import { AiService } from '../assistent/ai/ai.service';
import { WhatsappService } from 'src/assistent/whatsapp/whatsapp.service';

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
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsApp: WhatsappService,
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
      status: false, // Inicialmente, a mensagem não foi enviada
    });
    // Chama o AI
    this.aiService.processMessage(
      this.formatPhoneNumber(dto.recipientPhone),
      'boas vindas',
    );

    console.log('enviando resposta pra o remetente');
    this.whatsApp.sendMessage(
      this.formatPhoneNumber(dto.senderPhone),
      `Olá ${dto.senderName}, sua mensagem foi encaminhada!! \n\nClick abaixo e continue enviando mensagens:\ncatchat.com.br/FormPage `,
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
