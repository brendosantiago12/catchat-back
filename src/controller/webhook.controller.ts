import { Controller, Post, Body, HttpException, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ProcessWebHookService } from '../service/process-webhook.service';

@ApiTags('Webhook')
@Controller('api')
export class WebhookController {
  constructor(private readonly processWebHookService: ProcessWebHookService) { }

  @Post('webhook')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Receber evento de pagamento do Pagar.me',
    description: 'Endpoint chamado automaticamente pelo Pagar.me quando o status de um pedido muda. Confirma o pagamento e dispara o envio da mensagem ao destinatário.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      example: {
        data: {
          id: 'order_abc123',
          status: 'paid',
        },
      },
    },
  })
  @ApiResponse({ status: 204, description: 'Evento processado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Pedido não encontrado.' })
  @ApiResponse({ status: 500, description: 'Erro interno ao processar o webhook.' })
  async processData(@Body() payload: any): Promise<void> {
    try {
      console.log('#################### WEBHOOK ################################');
      console.log('payload recebido', payload);
      this.processWebHookService.processWebHook(payload);
    } catch (error) {
      console.log('deu merda')
      throw new HttpException(
        error.message || 'Desculpe, não conseguimos processar sua solicitação',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
