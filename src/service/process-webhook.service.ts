import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Payment, Message } from '../schema/schemas';
import { SendMessageService } from './send-message.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { ConfigService } from '@nestjs/config';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

const SUBSCRIPTION_DURATION_DAYS = 30;

@Injectable()
export class ProcessWebHookService {

    private readonly startRateLimit: number;

    constructor(
        @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
        private readonly sendMessageService: SendMessageService,
        private readonly configService: ConfigService,
    ) {
        this.startRateLimit = this.configService.get<number>('START_RATE_LIMIT')!;
    }

    async processWebHook(payload: any): Promise<void> {
        const idCompra = payload.data.id;
        const statusCompra = payload.data.status;

        const payment = await this.findByCompraId(idCompra);
        await this.validaAtualizaStatus(statusCompra, payment.id_compra);

        const customerMessage = await this.findLastOrderByUserIdAndStatus(payment.user_id, 'PENDING');
        if (!customerMessage) {
            throw new HttpException('Nenhuma mensagem pendente encontrada', HttpStatus.NOT_FOUND);
        }

        await this.sendMessageService.sendMessage(this.mapToSendMessageDto(customerMessage));

        console.log('Atualizando mensagem para SENT');
        await this.supabase
            .from('messages')
            .update({ status_message: 'SENT', updated_at: new Date().toISOString() })
            .eq('id_mensagem', customerMessage.id_mensagem);

        if (payment.productType === 'UNLIMITED') {
            await this.createOrRenewSubscription(customerMessage.numeroRemetente);
        } else {
            await this.updateRateLimt(payment.user_id);
        }
    }

    async updateRateLimt(user_id: string): Promise<void> {
        console.log('Atualizando rate_limit do usuário');
        await this.supabase.rpc('increment_rate_limit', {
            p_user_id: user_id,
            p_amount: this.startRateLimit,
        });
    }

    async createOrRenewSubscription(userPhone: string): Promise<void> {
        const { data: existing } = await this.supabase
            .from('subscriptions')
            .select('id, expires_at')
            .eq('user_phone', userPhone)
            .eq('status', 'ACTIVE')
            .maybeSingle();

        // Se já tem assinatura ativa, soma 30 dias a partir do vencimento atual
        // (preserva dias restantes); caso contrário, começa de hoje
        const baseDate = existing ? new Date(existing.expires_at) : new Date();
        baseDate.setDate(baseDate.getDate() + SUBSCRIPTION_DURATION_DAYS);
        const expiresAt = baseDate;

        if (existing) {
            await this.supabase
                .from('subscriptions')
                .update({ expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
            await this.supabase
                .from('subscriptions')
                .insert({ user_phone: userPhone, status: 'ACTIVE', expires_at: expiresAt.toISOString() });
        }
    }

    async findByCompraId(idCompra: string): Promise<Payment> {
        console.log('Buscando pagamento pelo id_compra:', idCompra);
        const { data } = await this.supabase
            .from('payments')
            .select('*')
            .eq('id_compra', idCompra)
            .maybeSingle();

        if (!data) {
            throw new HttpException('Pedido nao encontrado', HttpStatus.BAD_REQUEST);
        }

        return this.mapPayment(data);
    }

    async findLastOrderByUserIdAndStatus(idUser: string, statusMessage: string): Promise<Message | null> {
        console.log('Buscando mensagem mais antiga do usuário');
        const { data } = await this.supabase
            .from('messages')
            .select('*')
            .eq('id_user', idUser)
            .eq('status_message', statusMessage)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        console.log('Mensagem encontrada:', data);
        if (!data) return null;
        return this.mapMessage(data);
    }

    async updatePaymentStatus(id_compra: string, status: string): Promise<Payment | null> {
        console.log('atualizando status do pagamento');
        const { data } = await this.supabase
            .from('payments')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id_compra', id_compra)
            .select()
            .single();

        return data ? this.mapPayment(data) : null;
    }

    async validaAtualizaStatus(status: string, idCompra: string): Promise<void> {
        console.log('validando status do pagamento');
        if (status === 'paid') {
            await this.updatePaymentStatus(idCompra, status);
        }
    }

    private mapToSendMessageDto(message: Message): SendMessageDto {
        const dto = new SendMessageDto();
        dto.senderName = message.userName;
        dto.senderPhone = message.numeroRemetente;
        dto.senderMessage = message.mensagem;
        dto.recipientName = message.nomeDestinario;
        dto.recipientPhone = message.numeroDestinario;
        dto.productType = message.productType;
        return dto;
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
