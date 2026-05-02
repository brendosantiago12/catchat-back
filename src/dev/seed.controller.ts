import { Body, Controller, Delete, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProductType } from '../schema/send-message.schema';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

const SEED_USER_ID = 'user-teste-001';
const SENDER_PHONE = '5581992549672';
const RECIPIENT_PHONE = '5581992878362';

@ApiTags('Dev')
@Controller('dev')
export class SeedController {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
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
    },
  })
  @ApiResponse({ status: 201, description: 'Dados de seed criados.' })
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

    await this.supabase
      .from('users')
      .upsert(
        {
          user_id: SEED_USER_ID,
          nome: senderName,
          celular: senderPhone,
          email: 'brendo@teste.com',
          tax_id: '12345678901',
          rate_limit: 0,
        },
        { onConflict: 'user_id' },
      );

    await this.supabase
      .from('payments')
      .insert({
        user_id: SEED_USER_ID,
        id_compra: idCompra,
        amount: 500,
        expires_at: '2026-12-31T00:00:00.000Z',
        qr_code: 'fake-qrcode',
        qr_code_url: 'fake-url',
        status: 'pending',
        product_type: productType,
      });

    await this.supabase
      .from('messages')
      .insert({
        id_mensagem: idMensagem,
        id_user: SEED_USER_ID,
        user_name: senderName,
        numero_remetente: senderPhone,
        nome_destinario: recipientName,
        numero_destinario: recipientPhone,
        mensagem,
        status_message: 'PENDING',
        product_type: productType,
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
      this.supabase.from('users').delete().eq('user_id', SEED_USER_ID),
      this.supabase.from('payments').delete().eq('user_id', SEED_USER_ID),
      this.supabase.from('messages').delete().eq('id_user', SEED_USER_ID),
    ]);
  }
}
