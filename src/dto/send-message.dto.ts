import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProductType } from '../schema/send-message.schema';

export class SendMessageDto {
  @ApiProperty({ description: 'Nome do remetente', example: 'João da Silva' })
  @IsString()
  senderName: string;

  @ApiProperty({ description: 'Telefone do remetente com DDI e DDD', example: '5581999887766' })
  @IsString()
  senderPhone: string;

  @ApiProperty({ description: 'Mensagem a ser enviada anonimamente', example: 'Você é incrível!' })
  @IsString()
  senderMessage: string;

  @ApiProperty({ description: 'Nome do destinatário', example: 'Maria Souza' })
  @IsString()
  recipientName: string;

  @ApiProperty({ description: 'Número de WhatsApp do destinatário com DDI e DDD', example: '5581988776655' })
  @IsString()
  recipientPhone: string;

  @ApiProperty({
    description: 'Tipo de produto contratado',
    enum: ['MESSAGE_ONLY', 'MESSAGE_TUNNEL', 'UNLIMITED'],
    example: 'MESSAGE_ONLY',
  })
  @IsString()
  @IsIn(['MESSAGE_ONLY', 'MESSAGE_TUNNEL', 'UNLIMITED'])
  productType: ProductType;
}
