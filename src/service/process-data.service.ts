import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { User, Payment, Message } from '../schema/schemas';
import {
  PayloadDto,
  QrCodeResponseDto,
  UserDataDto,
  SubscriptionStatusResponseDto,
} from '../dto/dto';
import { PagarmeService } from './pagarme.service';
import { SendMessageService } from './send-message.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { WhatsappFormatter } from '../assistent/whatsapp/whatsappFormater.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

@Injectable()
export class ProcessDataService {
  private readonly logger = new Logger(ProcessDataService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly pagarmeService: PagarmeService,
    private readonly sendMessageService: SendMessageService,
    private readonly formatter: WhatsappFormatter,
  ) {}

  async processPayload(payload: PayloadDto): Promise<QrCodeResponseDto> {
    const user = await this.salvaUsuario(payload.userData);
    const payment = await this.geraQrCodePix(user.user_id, payload);
    const mensagem = await this.salvaDadosMensagem(user.user_id, payload, 'PENDING');
    return this.retornaQrCode(payment, mensagem);
  }

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

      if (hasSubscription) {
        payload.formData.productType = 'UNLIMITED';
      }

      await this.sendMessageService.sendMessage(this.mapToSendMessageDto(payload));

      if (!hasSubscription) {
        await this.supabase
          .from('users')
          .update({ rate_limit: user.rate_limit - 1, updated_at: new Date().toISOString() })
          .eq('user_id', user.user_id);
      }

      await this.salvaDadosMensagem(user.user_id, payload, 'SENT');

      return { rate_limit: user.rate_limit - (hasSubscription ? 0 : 1), hasSubscription };

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      throw error;
    }
  }

  async checkSubscriptionStatus(filters: { celular: string; taxId: string }): Promise<SubscriptionStatusResponseDto> {
    const user = await this.findOneByFilters(filters as UserDataDto);
    if (!user) return { hasSubscription: false, expiresAt: null, daysRemaining: null };

    const senderPhone = this.formatter.cleanPhoneNumber(
      this.formatter.formatPhoneNumber(filters.celular),
    );

    const now = new Date().toISOString();
    const { data } = await this.supabase
      .from('subscriptions')
      .select('expires_at')
      .eq('user_phone', senderPhone)
      .eq('status', 'ACTIVE')
      .gt('expires_at', now)
      .maybeSingle();

    if (!data) return { hasSubscription: false, expiresAt: null, daysRemaining: null };

    const expiresAt = new Date(data.expires_at);
    const daysRemaining = Math.ceil(
      (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return { hasSubscription: true, expiresAt: expiresAt.toISOString(), daysRemaining };
  }

  private async hasActiveSubscription(userPhone: string): Promise<boolean> {
    const now = new Date().toISOString();
    const { data } = await this.supabase
      .from('subscriptions')
      .select('id')
      .eq('user_phone', userPhone)
      .eq('status', 'ACTIVE')
      .gt('expires_at', now)
      .maybeSingle();
    return data !== null;
  }

  private async findOneByFilters(filters: UserDataDto): Promise<User | null> {
    const { data } = await this.supabase
      .from('users')
      .select('*')
      .eq('celular', filters.celular)
      .eq('tax_id', filters.taxId)
      .maybeSingle();

    if (!data) return null;
    return this.mapUser(data);
  }

  private async salvaUsuario(userData: UserDataDto): Promise<User> {
    const existing = await this.findOneByFilters(userData);
    if (existing) return existing;

    const user_id = uuidv4();
    const { data, error } = await this.supabase
      .from('users')
      .insert({
        user_id,
        nome: userData.nome,
        celular: userData.celular,
        email: userData.email,
        tax_id: userData.taxId,
        rate_limit: 0,
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao salvar usuário: ${error.message}`);
    this.logger.log('ProcessDataService: salvando dados do usuario');
    return this.mapUser(data);
  }

  private async geraQrCodePix(user_id: string, payload: PayloadDto): Promise<Payment> {
    this.logger.log('ProcessDataService: criando qrCode');
    const productType = payload.formData.productType;
    const pixQrCodeResponse = await this.pagarmeService.createPixQrCode(payload.userData, productType);

    const { data, error } = await this.supabase
      .from('payments')
      .insert({
        user_id,
        amount: Number(pixQrCodeResponse.amount),
        expires_at: pixQrCodeResponse.expiresAt,
        qr_code: pixQrCodeResponse.qrCode,
        qr_code_url: pixQrCodeResponse.qrCodeUrl,
        status: pixQrCodeResponse.status,
        id_compra: pixQrCodeResponse.id,
        product_type: productType,
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao salvar pagamento: ${error.message}`);
    return this.mapPayment(data);
  }

  private async salvaDadosMensagem(id_user: string, payload: PayloadDto, status: string): Promise<Message> {
    const id_mensagem = uuidv4();
    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        id_mensagem,
        id_user,
        user_name: payload.userData.nome,
        numero_remetente: payload.userData.celular,
        nome_destinario: payload.formData.nomeDestinario,
        numero_destinario: payload.formData.numeroDestinario,
        mensagem: Array.isArray(payload.formData.mensagem)
          ? payload.formData.mensagem.join('\n')
          : payload.formData.mensagem,
        status_message: status,
        product_type: payload.formData.productType,
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao salvar mensagem: ${error.message}`);
    return this.mapMessage(data);
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

  private mapUser(row: any): User {
    return {
      id: row.id,
      user_id: row.user_id,
      nome: row.nome,
      celular: row.celular,
      email: row.email,
      taxId: row.tax_id,
      rate_limit: row.rate_limit,
    };
  }

  private mapPayment(row: any): Payment {
    return {
      id: row.id,
      user_id: row.user_id,
      id_compra: row.id_compra,
      amount: row.amount,
      expiresAt: row.expires_at,
      qrCode: row.qr_code,
      qrCodeUrl: row.qr_code_url,
      status: row.status,
      productType: row.product_type,
    };
  }

  private mapMessage(row: any): Message {
    return {
      id: row.id,
      id_mensagem: row.id_mensagem,
      id_user: row.id_user,
      userName: row.user_name,
      numeroRemetente: row.numero_remetente,
      nomeDestinario: row.nome_destinario,
      numeroDestinario: row.numero_destinario,
      mensagem: row.mensagem,
      status_message: row.status_message,
      productType: row.product_type,
    };
  }
}
