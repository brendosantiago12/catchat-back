import { IsString, IsEmail, ValidateNested, IsNotEmpty, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ProductType } from '../schema/send-message.schema';

export class UserDataDto {
  @ApiProperty({ description: 'Nome completo do remetente', example: 'João da Silva' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({ description: 'Número de celular com DDI e DDD', example: '5581999887766' })
  @IsString()
  @IsNotEmpty()
  celular: string;

  @ApiProperty({ description: 'Endereço de e-mail do remetente', example: 'joao@email.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'CPF do remetente (somente números)', example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  taxId: string;
}

export class FormDataDto {
  @ApiProperty({ description: 'Nome do destinatário da mensagem', example: 'Maria Souza' })
  @IsString()
  @IsNotEmpty()
  nomeDestinario: string;

  @ApiProperty({ description: 'Número de WhatsApp do destinatário com DDI e DDD', example: '5581988776655' })
  @IsString()
  @IsNotEmpty()
  numeroDestinario: string;

  @ApiProperty({
    description: 'Mensagem secreta a ser enviada',
    example: 'Você é incrível! Queria muito te dizer isso.',
  })
  @IsString()
  @IsNotEmpty()
  mensagem: string;

  @ApiProperty({
    description: 'Tipo de produto contratado',
    enum: ['MESSAGE_ONLY', 'MESSAGE_TUNNEL', 'UNLIMITED'],
    example: 'MESSAGE_ONLY',
  })
  @IsString()
  @IsIn(['MESSAGE_ONLY', 'MESSAGE_TUNNEL', 'UNLIMITED'])
  productType: ProductType;
}

export class PayloadDto {
  @ApiProperty({ description: 'Dados pessoais do remetente', type: () => UserDataDto })
  @ValidateNested()
  @Type(() => UserDataDto)
  userData: UserDataDto;

  @ApiProperty({ description: 'Dados do formulário de envio de mensagem', type: () => FormDataDto })
  @ValidateNested()
  @Type(() => FormDataDto)
  formData: FormDataDto;
}

export class QrCodeResponseDto {
  @ApiProperty({ description: 'Identificador único da mensagem', example: 'msg-1713300000000' })
  id_mensagem: string;

  @ApiProperty({ description: 'Código PIX em formato texto (copia e cola)', example: '00020101021...' })
  brCode: string;

  @ApiProperty({ description: 'QR Code PIX em formato Base64', example: 'iVBORw0KGgoAAAANSUhEUgAA...' })
  brCodeBase64: string;

  @ApiProperty({ description: 'Valor cobrado em centavos', example: 1700 })
  amount: number;
}

export class AbacatePayStatusResponseDto {
  @ApiProperty({ description: 'Status atual do pagamento', example: 'PENDING' })
  status: string;

  @ApiProperty({ description: 'Data de expiração do pagamento', example: '2026-12-31T00:00:00.000Z' })
  expiresAt: string;
}

export class PixResponseDto {
  @ApiProperty({ description: 'Identificador da cobrança PIX', example: 'pix-abc123' })
  id: string;

  @ApiProperty({ description: 'Valor em centavos', example: '500' })
  amount: string;

  @ApiProperty({ description: 'Status da cobrança', example: 'pending' })
  status: string;

  @ApiProperty({ description: 'Data de expiração', example: '2026-12-31T00:00:00.000Z' })
  expiresAt: string;

  @ApiProperty({ description: 'Código QR Code em texto', example: '00020101...' })
  qrCode: string;

  @ApiProperty({ description: 'URL da imagem do QR Code', example: 'https://api.pix.example.com/qr/abc' })
  qrCodeUrl: string;
}

export class HomePhoneDto {
  @ApiProperty({ description: 'Número do telefone', example: '99887766' })
  phone: string;

  @ApiProperty({ description: 'Código do país', example: '55' })
  countryCode: string;

  @ApiProperty({ description: 'Código de área (DDD)', example: '81' })
  area: string;
}

export class SubscriptionStatusResponseDto {
  @ApiProperty({ description: 'Indica se o usuário possui assinatura ativa', example: true })
  hasSubscription: boolean;

  @ApiProperty({ description: 'Data de expiração da assinatura (ISO 8601)', example: '2026-06-01T12:00:00.000Z', nullable: true })
  expiresAt: string | null;

  @ApiProperty({ description: 'Dias restantes na assinatura', example: 28, nullable: true })
  daysRemaining: number | null;
}

export class RequestOtpDto {
  @ApiProperty({ description: 'Celular do remetente (com DDI e DDD)', example: '5581999887766' })
  @IsString()
  @IsNotEmpty()
  celular: string;

  @ApiProperty({ description: 'CPF do remetente (somente números)', example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  taxId: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Celular do remetente (com DDI e DDD)', example: '5581999887766' })
  @IsString()
  @IsNotEmpty()
  celular: string;

  @ApiProperty({ description: 'CPF do remetente (somente números)', example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  taxId: string;

  @ApiProperty({ description: 'Código OTP de 6 dígitos recebido via WhatsApp', example: '123456' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
