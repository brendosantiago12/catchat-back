import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, Payment, Message } from '../schema/schemas';
import { Subscription } from '../schema/subscription.schema';
import { SendMessageService } from './send-message.service';
import { SendMessageDto } from 'src/dto/send-message.dto';
import { ConfigService } from '@nestjs/config';

const SUBSCRIPTION_DURATION_YEARS = 1;

@Injectable()
export class ProcessWebHookService {

    private readonly startRateLimit: number;

    constructor(
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Payment.name) private paymentModel: Model<Payment>,
        @InjectModel(Message.name) private messageModel: Model<Message>,
        @InjectModel(Subscription.name) private subscriptionModel: Model<Subscription>,
        private readonly sendMessageService: SendMessageService,
        private readonly configService: ConfigService,
    ) {
        this.startRateLimit = this.configService.get<number>('START_RATE_LIMIT')!;
    }

    /**
     * Método principal que processa toda a solicitação
     */
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

        customerMessage.status_message = 'SENT';
        console.log('Atualizando mensagem para SENT');
        await this.messageModel.findOneAndUpdate(
            { id_mensagem: customerMessage.id_mensagem },
            customerMessage,
            { new: true }
        ).exec();

        if (payment.productType === 'UNLIMITED') {
            await this.createOrRenewSubscription(customerMessage.numeroRemetente);
        } else {
            await this.updateRateLimt(payment.user_id);
        }
    }

    async updateRateLimt(user_id: string): Promise<void> {
        console.log('Atualizando rate_limit do usuário');
        await this.userModel.findOneAndUpdate(
            { user_id },
            { $inc: { rate_limit: this.startRateLimit } },
            { new: true }
        ).exec();
    }

    async createOrRenewSubscription(userPhone: string): Promise<void> {
        const existing = await this.subscriptionModel.findOne({
            userPhone,
            status: 'ACTIVE',
        }).exec();

        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + SUBSCRIPTION_DURATION_YEARS);

        if (existing) {
            // Renova estendendo a partir de hoje
            await this.subscriptionModel.findByIdAndUpdate(existing._id, { expiresAt });
        } else {
            await this.subscriptionModel.create({ userPhone, status: 'ACTIVE', expiresAt });
        }
    }

    async findByCompraId(idCompra: string): Promise<Payment> {
        console.log('Buscando pagamento pelo id_compra:', idCompra);
        const payment = await this.paymentModel.findOne({ id_compra: idCompra }).exec();
        if (payment == null) {
            throw new HttpException('Pedido nao encontrado', HttpStatus.BAD_REQUEST);
        }

        return payment;
    }

    async findLastOrderByUserIdAndStatus(idUser: string, statusMessage: string): Promise<Message | null> {
        console.log('Buscando mensagem mais antiga do usuário');
        const customerMessage = await this.messageModel
            .findOne({ id_user: idUser, status_message: statusMessage })
            .sort({ createdAt: 1 })
            .exec();
        console.log('Mensagem encontrada:', customerMessage);
        return customerMessage;
    }

    async updatePaymentStatus(id_compra: string, status: string): Promise<Payment | null> {
        console.log('atualizando status do pagamento')
        const payment = await this.findByCompraId(id_compra);
        payment.status = status;
        return this.paymentModel.findOneAndUpdate(
            { id_compra },                       // <-- aqui você busca pelo campo correto
            { status },                          // <-- atualiza o campo `status`
            { new: true }                        // <-- retorna o documento atualizado
        ).exec();
    }

    async validaAtualizaStatus(status: string, idCompra: string): Promise<void> {
        console.log('validando status do pagamento')
        if (status == 'paid') {
            await this.updatePaymentStatus(idCompra, status)
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
}