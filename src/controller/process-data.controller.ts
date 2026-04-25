import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ProcessDataService } from '../service/process-data.service';
import { PayloadDto, QrCodeResponseDto } from '../dto/dto';

@ApiTags('Mensagens')
@Controller('api')
export class ProcessDataController {
  constructor(private readonly processDataService: ProcessDataService) { }

  @Post('messages/qrcode')
  @ApiOperation({
    summary: 'Gerar QR Code PIX para pagamento',
    description: 'Recebe os dados do formulário, cria o pedido no Pagar.me e retorna o QR Code PIX para o remetente realizar o pagamento.',
  })
  @ApiBody({ type: PayloadDto })
  @ApiResponse({ status: 201, description: 'QR Code PIX gerado com sucesso.', type: QrCodeResponseDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos no corpo da requisição.' })
  @ApiResponse({ status: 500, description: 'Erro interno ao processar o pagamento.' })
  async processData(@Body() payload: PayloadDto): Promise<QrCodeResponseDto> {
    try {
      return await this.processDataService.processPayload(payload);
    } catch (error) {
      throw new HttpException(
        error.message || 'Desculpe, não conseguimos processar sua solicitação',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('messages')
  @ApiOperation({
    summary: 'Enviar mensagem anônima usando saldo existente',
    description: 'Envia a mensagem sem novo pagamento, usando o saldo de rate_limit do usuário ou uma Subscription ativa (produto Ilimitado).',
  })
  @ApiBody({ type: PayloadDto })
  @ApiResponse({
    status: 201,
    description: 'Mensagem enviada com sucesso.',
    schema: { example: { rate_limit: 1, hasSubscription: false } },
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou saldo insuficiente.' })
  @ApiResponse({ status: 500, description: 'Erro interno ao enviar mensagem.' })
  async getStatus(@Body() payload: PayloadDto): Promise<number> {
    try {
      return await this.processDataService.sendMessage(payload);
    } catch (error) {
      throw new HttpException(
        error.message || 'Desculpe, não conseguimos processar sua solicitação',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
