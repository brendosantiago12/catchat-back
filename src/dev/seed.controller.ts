import { Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, Payment, Message } from '../schema/schemas';
import { ProductType } from '../schema/send-message.schema';

const SEED_USER_ID = 'user-teste-001';
const SENDER_PHONE = '5581992549672';
const RECIPIENT_PHONE = '5581992878362';

@ApiTags('Dev')
@Controller('dev')
export class SeedController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
  ) {}

  @Post('seed')
  @ApiOperation({
    summary: 'Popular banco com dados de teste',
    description: 'APENAS AMBIENTE DE DESENVOLVIMENTO. Cria um usuário, pagamento e mensagem fictícios prontos para simular o fluxo completo sem passar pelo Pagar.me.',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        senderName:      { type: 'string', default: 'Brendo Teste' },
        senderPhone:     { type: 'string', default: SENDER_PHONE },
        recipientName:   { type: 'string', default: 'Maria' },
        recipientPhone:  { type: 'string', default: RECIPIENT_PHONE },
        mensagem:        { type: 'string', default: 'Você é incrível! Queria muito te dizer isso.' },
        productType:     { type: 'string', enum: ['MESSAGE_ONLY', 'MESSAGE_TUNNEL', 'UNLIMITED'], default: 'MESSAGE_ONLY' },
      },
      example: {
        senderName: 'Brendo Teste',
        senderPhone: SENDER_PHONE,
        recipientName: 'Maria',
        recipientPhone: RECIPIENT_PHONE,
        mensagem: 'Você é incrível! Queria muito te dizer isso.',
        productType: 'MESSAGE_ONLY',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Dados de seed criados. O campo curl já contém o comando para simular o webhook.',
    schema: { example: { id_compra: 'compra-teste-1713300000000', curl: 'curl -X POST http://localhost:3000/api/webhook ...' } },
  })
  async seed(@Body() body: {
    senderName?: string;
    senderPhone?: string;
    recipientName?: string;
    recipientPhone?: string;
    mensagem?: string;
    productType?: ProductType;
  } = {}) {
    const {
      senderName     = 'Brendo Teste',
      senderPhone    = SENDER_PHONE,
      recipientName  = 'Maria',
      recipientPhone = RECIPIENT_PHONE,
      mensagem       = 'Você é incrível! Queria muito te dizer isso.',
      productType    = 'MESSAGE_ONLY',
    } = body;

    const timestamp = Date.now();
    const idCompra = `compra-teste-${timestamp}`;
    const idMensagem = `msg-teste-${timestamp}`;

    await this.userModel.findOneAndUpdate(
      { user_id: SEED_USER_ID },
      {
        user_id: SEED_USER_ID,
        nome: senderName,
        celular: senderPhone,
        email: 'brendo@teste.com',
        taxId: '12345678901',
        rate_limit: 0,
      },
      { upsert: true, new: true },
    );

    await this.paymentModel.create({
      user_id: SEED_USER_ID,
      id_compra: idCompra,
      amount: 500,
      expiresAt: '2026-12-31T00:00:00.000Z',
      qrCode: 'fake-qrcode',
      qrCodeUrl: 'fake-url',
      status: 'pending',
      productType,
    });

    await this.messageModel.create({
      id_mensagem: idMensagem,
      id_user: SEED_USER_ID,
      userName: senderName,
      numeroRemetente: senderPhone,
      nomeDestinario: recipientName,
      numeroDestinario: recipientPhone,
      mensagem,
      status_message: 'PENDING',
      productType,
    });

    const curl = `curl -X POST http://localhost:3000/api/webhook -H "Content-Type: application/json" -d "{\\"data\\":{\\"id\\":\\"${idCompra}\\",\\"status\\":\\"paid\\"}}"`;

    return { id_compra: idCompra, curl };
  }

  @Delete('seed')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remover dados de teste do banco',
    description: 'APENAS AMBIENTE DE DESENVOLVIMENTO. Remove todos os registros criados pelo POST /dev/seed.',
  })
  @ApiResponse({ status: 204, description: 'Dados de seed removidos com sucesso.' })
  async clearSeed() {
    await Promise.all([
      this.userModel.deleteMany({ user_id: SEED_USER_ID }),
      this.paymentModel.deleteMany({ user_id: SEED_USER_ID }),
      this.messageModel.deleteMany({ id_user: SEED_USER_ID }),
    ]);
  }
}
