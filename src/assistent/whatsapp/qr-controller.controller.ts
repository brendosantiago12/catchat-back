import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProduces } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { Response } from 'express';

@ApiTags('Autenticação')
@Controller('qr-controller')
export class QrControllerController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get()
  @ApiOperation({
    summary: 'Obter QR Code de autenticação do WhatsApp',
    description: 'Retorna a imagem PNG do QR Code que deve ser escaneado para autenticar o cliente WhatsApp. Necessário apenas na primeira execução ou após expiração da sessão.',
  })
  @ApiProduces('image/png')
  @ApiResponse({
    status: 200,
    description: 'Imagem PNG do QR Code gerada com sucesso.',
    content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({
    status: 500,
    description: 'Falha ao gerar o QR Code.',
    schema: { example: { message: 'Failed to generate QR code', error: 'string', details: 'string' } },
  })
  async getQrCode(@Res() res: Response) {
    try {
      const qrCodeDataUrl = await this.whatsappService.generateQrCodeDataUrl();

      res.setHeader('Content-Type', 'image/png');

      const base64Data = qrCodeDataUrl.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');

      res.status(HttpStatus.OK).send(imageBuffer);
    } catch (error) {
      console.error('QR Code Generation Error:', error);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to generate QR code',
        error: error.message,
        details: 'Make sure the WhatsApp client is initializing correctly',
      });
    }
  }
}
