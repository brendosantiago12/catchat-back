import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ProcessDataService } from '../service/process-data.service';
import { OtpService } from '../service/otp.service';
import { WhatsappFormatter } from '../assistent/whatsapp/whatsappFormater.service';
import {
  SubscriptionStatusResponseDto,
  RequestOtpDto,
  VerifyOtpDto,
} from '../dto/dto';

@ApiTags('Assinatura')
@Controller('api/subscription')
export class SubscriptionController {
  constructor(
    private readonly processDataService: ProcessDataService,
    private readonly otpService: OtpService,
    private readonly formatter: WhatsappFormatter,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Verificar status da assinatura UNLIMITED' })
  @ApiQuery({ name: 'celular', required: true, example: '5581999887766' })
  @ApiQuery({ name: 'taxId', required: true, example: '12345678901' })
  @ApiResponse({ status: 200, type: SubscriptionStatusResponseDto })
  async getSubscriptionStatus(
    @Query('celular') celular: string,
    @Query('taxId') taxId: string,
  ): Promise<SubscriptionStatusResponseDto> {
    if (!celular || !taxId) {
      throw new HttpException('celular e taxId são obrigatórios', HttpStatus.BAD_REQUEST);
    }
    return this.processDataService.checkSubscriptionStatus({ celular, taxId });
  }

  @Post('otp/request')
  @ApiOperation({ summary: 'Solicitar código OTP via WhatsApp para autenticar assinatura' })
  @ApiBody({ type: RequestOtpDto })
  @ApiResponse({ status: 201, description: 'Código enviado via WhatsApp' })
  @ApiResponse({ status: 403, description: 'Sem assinatura ativa' })
  async requestOtp(@Body() body: RequestOtpDto): Promise<{ message: string }> {
    const status = await this.processDataService.checkSubscriptionStatus(body);
    if (!status.hasSubscription) {
      throw new HttpException('Nenhuma assinatura UNLIMITED ativa para este número', HttpStatus.FORBIDDEN);
    }

    const phone = this.formatter.cleanPhoneNumber(
      this.formatter.formatPhoneNumber(body.celular),
    );
    await this.otpService.generateAndSend(phone);
    return { message: 'Código enviado via WhatsApp' };
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verificar código OTP e confirmar identidade do assinante' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({ status: 200, schema: { example: { valid: true, daysRemaining: 28 } } })
  @ApiResponse({ status: 400, description: 'Parâmetros inválidos' })
  @ApiResponse({ status: 403, description: 'Sem assinatura ativa' })
  async verifyOtp(@Body() body: VerifyOtpDto): Promise<{ valid: boolean; daysRemaining: number | null }> {
    if (!body.celular || !body.taxId || !body.code) {
      throw new HttpException('celular, taxId e code são obrigatórios', HttpStatus.BAD_REQUEST);
    }

    const status = await this.processDataService.checkSubscriptionStatus(body);
    if (!status.hasSubscription) {
      throw new HttpException('Nenhuma assinatura UNLIMITED ativa para este número', HttpStatus.FORBIDDEN);
    }

    const phone = this.formatter.cleanPhoneNumber(
      this.formatter.formatPhoneNumber(body.celular),
    );
    const valid = await this.otpService.verify(phone, body.code);
    return { valid, daysRemaining: valid ? status.daysRemaining : null };
  }
}
