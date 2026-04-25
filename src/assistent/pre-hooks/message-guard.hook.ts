import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMessageHook, MessageContext } from './interfaces/message-hook.interface';
import { BotStateService } from '../whatsapp/bot-state.service';

@Injectable()
export class MessageGuardHook implements IMessageHook {
  private readonly logger = new Logger(MessageGuardHook.name);
  private readonly toleranceSeconds: number;

  constructor(
    private readonly botState: BotStateService,
    private readonly configService: ConfigService,
  ) {
    this.toleranceSeconds = Math.floor(
      this.configService.getOrThrow<number>('STARTUP_MESSAGE_TOLERANCE_MS') / 1000,
    );
  }

  async handle(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const message = ctx.rawItems[0]?.message;

    if (!message) {
      return;
    }

    // Ignorar silenciosamente: bot, status, broadcast, grupos e corpo vazio
    if (
      message.fromMe ||
      message.isStatus ||
      message.broadcast ||
      message.from.endsWith('@g.us') ||
      !ctx.text?.trim()
    ) {
      this.logger.debug(`Mensagem descartada de ${message.from} [type=${message.type}]`);
      return;
    }

    // Avisar e ignorar mensagens que nao sao texto
    if (message.type !== 'chat') {
      this.logger.debug(`Mensagem de midia descartada de ${message.from} [type=${message.type}]`);
      await message.reply('Só consigo ler mensagens de texto 💬\n\nMe manda uma mensagem escrita!');
      return;
    }

    // Ignorar mensagens anteriores ao momento de inicializacao (com janela de tolerancia)
    const readyAt = this.botState.getReadyAt();

    if (readyAt === null) {
      this.logger.debug(`Bot ainda nao esta pronto, descartando mensagem de ${message.from}`);
      return;
    }

    if (message.timestamp < readyAt - this.toleranceSeconds) {
      this.logger.debug(
        `Mensagem antiga descartada de ${message.from} [msg=${message.timestamp}, readyAt=${readyAt}, tolerance=${this.toleranceSeconds}s]`,
      );
      return;
    }

    return next();
  }
}
