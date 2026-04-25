import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, Payment, Message } from '../schema/schemas';
import { Subscription } from '../schema/subscription.schema';
import {
  PayloadDto,
  QrCodeResponseDto,
  UserDataDto,
} from '../dto/dto';
import { PagarmeService } from './pagarme.service';
import { SendMessageService } from './send-message.service';
import { SendMessageDto } from 'src/dto/send-message.dto';
import { WhatsappFormatter } from '../assistent/whatsapp/whatsappFormater.service';

@Injectable()
export class ProcessDataService {
  private readonly logger = new Logger(ProcessDataService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<Subscription>,
    private readonly pagarmeService: PagarmeService,
    private readonly sendMessageService: SendMessageService,
    private readonly formatter: WhatsappFormatter,
  ) {}

  /**
   * Processa o payload recebido e gera QrCode PIX para pagamento
   */
  async processPayload(payload: PayloadDto): Promise<QrCodeResponseDto> {
    const user = await this.salvaUsuario(payload.userData);
    const payment = await this.geraQrCodePix(user.user_id, payload);
    const mensagem = await this.salvaDadosMensagem(user.user_id, payload, 'PENDING');
    return this.retornaQrCode(payment, mensagem);
  }

  /**
   * Envia uma mensagem diretamente usando saldo existente (rate_limit ou Subscription ativa).
   */
  async sendMessage(payload: PayloadDto): Promise<any> {
    try {
      const user = await this.findOneByFilters(payload.userData);

      if (user == null) {
        throw new Error('Usuário não encontrado');
      }

      const senderPhone = this.formatter.cleanPhoneNumber(
        this.formatter.formatPhoneNumber(payload.userData.celular),
      );

      const hasSubscription = await this.hasActiveSubscription(senderPhone);

      if (!hasSubscription && user.rate_limit <= 0) {
        return {
          saldo: 0,
          message: 'Saldo insuficiente para enviar mensagem',
        };
      }

      // Produto 3 sempre usa MESSAGE_TUNNEL; para os outros usa o productType do payload
      if (hasSubscription) {
        payload.formData.productType = 'UNLIMITED';
      }

      await this.sendMessageService.sendMessage(this.mapToSendMessageDto(payload));

      if (!hasSubscription) {
        user.rate_limit -= 1;
        await user.save();
      }

      await this.salvaDadosMensagem(user.user_id, payload, 'SENT');

      return { rate_limit: user.rate_limit, hasSubscription };

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      throw error;
    }
  }

  private async hasActiveSubscription(userPhone: string): Promise<boolean> {
    const now = new Date();
    const sub = await this.subscriptionModel.findOne({
      userPhone,
      status: 'ACTIVE',
      expiresAt: { $gt: now },
    }).exec();
    return sub !== null;
  }

  private async findOneByFilters(filters: UserDataDto): Promise<User | null> {
    return this.userModel.findOne({
      celular: filters.celular,
      taxId: filters.taxId,
    }).exec();
  }

  private async salvaUsuario(userData: UserDataDto): Promise<User> {
    const existingUser = await this.findOneByFilters(userData);
    if (existingUser) {
      return existingUser;
    }

    const user = new this.userModel(userData);
    user.rate_limit = 0;
    this.logger.log('ProcessDataService: salvando dados do usuario');
    return await user.save();
  }

  private async geraQrCodePix(user_id: string, payload: PayloadDto): Promise<Payment> {
    this.logger.log('ProcessDataService: criando qrCode');
    const productType = payload.formData.productType;
    const pixQrCodeResponse = await this.pagarmeService.createPixQrCode(payload.userData, productType);

    const payment = new this.paymentModel({
      user_id,
      amount: Number(pixQrCodeResponse.amount),
      expiresAt: pixQrCodeResponse.expiresAt,
      qrCode: pixQrCodeResponse.qrCode,
      qrCodeUrl: pixQrCodeResponse.qrCodeUrl,
      status: pixQrCodeResponse.status,
      id_compra: pixQrCodeResponse.id,
      productType,
    });

    return await payment.save();
  }

  private async salvaDadosMensagem(id_user: string, payload: PayloadDto, status: string): Promise<Message> {
    const messageData = {
      id_user,
      userName: payload.userData.nome,
      numeroRemetente: payload.userData.celular,
      nomeDestinario: payload.formData.nomeDestinario,
      numeroDestinario: payload.formData.numeroDestinario,
      mensagem: payload.formData.mensagem,
      status_message: status,
      productType: payload.formData.productType,
    };

    const message = new this.messageModel(messageData);
    return await message.save();
  }

  private retornaQrCode(payment: Payment, mensagem: Message): QrCodeResponseDto {
    return {
      id_mensagem: mensagem.id_mensagem,
      brCode: payment.qrCode,
      brCodeBase64: payment.qrCodeUrl,
      amount: payment.amount,
    };
  }

  private mapToSendMessageDto(payload: PayloadDto): SendMessageDto {
    const dto = new SendMessageDto();
    dto.senderName = payload.userData.nome;
    dto.senderPhone = payload.userData.celular;
    dto.senderMessage = payload.formData.mensagem;
    dto.recipientName = payload.formData.nomeDestinario;
    dto.recipientPhone = payload.formData.numeroDestinario;
    dto.productType = payload.formData.productType;
    return dto;
  }
}
