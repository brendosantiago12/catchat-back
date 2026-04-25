/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as QRCode from 'qrcode';
import { Client, RemoteAuth } from 'whatsapp-web.js';
import * as fs from 'fs';
import * as path from 'path';
import { Subject } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { WhatsappSessionStoreService } from './whatsappSessionStore';
import { WhatsappFormatter } from './whatsappFormater.service';
import { IMessageSender } from '../../common/messaging/messaging.interface';
import { MessagePipelineService } from '../pre-hooks/message-pipeline.service';
import { AiService } from '../ai/ai.service';
import { BotStateService } from './bot-state.service';

@Injectable()
export class WhatsappService implements OnModuleInit, IMessageSender {
  private currentQrCode: string | null = null;
  private qrCodeSubject = new Subject<string>();
  private readonly tempDir = path.join(process.cwd(), 'temp');
  private readonly logger = new Logger(WhatsappService.name);
  private readonly client: Client;
  private readonly formatter: WhatsappFormatter;
  private pipeline!: MessagePipelineService;
  private aiService!: AiService;
  private readonly readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly sessionStore: WhatsappSessionStoreService,
    private readonly configService: ConfigService,
    private readonly botState: BotStateService,
  ) {
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
    this.formatter = new WhatsappFormatter();
    this.client = this.initializeClient();
    this.setupEventListeners();
  }

  async onModuleInit(): Promise<void> {
    this.pipeline = this.moduleRef.get(MessagePipelineService, { strict: false });
    this.aiService = this.moduleRef.get(AiService, { strict: false });

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    await this.initializeWhatsapp();
  }

  private initializeClient(): Client {
    const clientId =
      this.configService.get<string>('WHATSAPP_CLIENT_ID') || 'whatsapp-client';

    this.logger.log(`Inicializando cliente WhatsApp com ID: ${clientId}`);

    return new Client({
      authStrategy: new RemoteAuth({
        clientId,
        store: this.sessionStore,
        backupSyncIntervalMs: 60_000,
      }),
      webVersion: '2.3000.1036821440',
      webVersionCache: {
        type: 'remote',
        remotePath:
          'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}-alpha.html',
      },
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-infobars',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--use-gl=egl',
        ].filter(Boolean),
      },
    });
  }

  private async initializeWhatsapp(): Promise<void> {
    try {
      await this.client.initialize();
    } catch (error) {
      this.logger.error('Erro ao inicializar WhatsApp:', error);
      throw new Error('Falha ao inicializar cliente WhatsApp');
    }
  }

  private setupEventListeners(): void {
    this.setupQRCodeListener();
    this.setupReadyListener();
    this.setupMessageListener();
  }

  private setupQRCodeListener(): void {
    this.client.on('qr', (qr) => {
      this.logger.log('Escaneie o QR Code para conectar:');
      this.currentQrCode = qr;
      this.qrCodeSubject.next(qr);
      this.logger.log('QR Code gerado:', this.currentQrCode);
    });
  }

  public async waitForQrCode(): Promise<string> {
    this.logger.log('Aguardando QR Code...');
    return new Promise((resolve, reject) => {
      if (this.currentQrCode) {
        return resolve(this.currentQrCode);
      }

      const subscription = this.qrCodeSubject.subscribe({
        next: (qr) => {
          subscription.unsubscribe();
          resolve(qr);
        },
        error: (err) => {
          subscription.unsubscribe();
          reject(err);
        },
      });
    });
  }

  public async generateQrCodeDataUrl(): Promise<string> {
    this.logger.log('Gerando QR Code Data URL...');
    try {
      const qrCode = this.currentQrCode || (await this.waitForQrCode());

      this.logger.log('QR Code Data URL...', qrCode);

      const qrCodeDataUrl = await QRCode.toDataURL(qrCode, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 400,
        margin: 2,
      });

      this.logger.log('QR Code ...', qrCodeDataUrl);

      return qrCodeDataUrl;
    } catch (error) {
      this.logger.error('Failed to generate QR code data URL', error);
      throw new Error('Could not generate QR code: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private setupReadyListener(): void {
    this.client.on('ready', () => {
      this.botState.setReadyAt(Math.floor(Date.now() / 1000));
      this.resolveReady();
      this.logger.log('WhatsApp Web conectado com sucesso!');
    });
  }

  private setupMessageListener(): void {
    this.client.on('message', async (message) => {
      try {
        const contact = await message.getContact();
        const phone = contact.number;

        this.logger.log(`Mensagem recebida de ${phone}: ${message.body}`);

        await this.pipeline.run(
          { phone, text: message.body, rawItems: [{ message }] },
          async (ctx) => { await this.aiService.processMessage(ctx.phone, ctx.text); },
        );
      } catch (error) {
        this.logger.error(`Erro ao processar mensagem: ${error instanceof Error ? error.message : String(error)}`);
        message.reply('Desculpe, ocorreu um erro ao processar sua mensagem.');
      }
    });
  }

  private handleSendMessageError(number: string, error: Error): void {
    const errorMessage = `Não foi possível enviar a mensagem para ${number}`;
    this.logger.error(errorMessage, error.stack);
    throw new Error(`${errorMessage}. Erro: ${error.message}`);
  }

  public async send(phone: string, message: string): Promise<void> {
    await this.readyPromise;
    try {
      const formattedNumber = this.formatter.formatPhoneNumber(phone);
      this.logger.debug(`Resolvendo número: ${formattedNumber}`);

      const numberId = await this.client.getNumberId(formattedNumber);
      if (!numberId) {
        throw new Error(`Número não encontrado no WhatsApp: ${formattedNumber}`);
      }

      this.logger.debug(`Enviando mensagem para: ${numberId._serialized}`);
      await this.client.sendMessage(numberId._serialized, message);
    } catch (error) {
      this.handleSendMessageError(phone, error instanceof Error ? error : new Error(String(error)));
    }
  }
}
