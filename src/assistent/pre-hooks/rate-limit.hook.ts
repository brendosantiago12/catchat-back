import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMessageHook, MessageContext } from './interfaces/message-hook.interface';
import { MESSAGE_SENDER, IMessageSender } from '../../common/messaging/messaging.interface';
import { Inject } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimitHook implements IMessageHook, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitHook.name);
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly cleanupInterval: NodeJS.Timeout;

  private readonly maxMessages: number;
  private readonly windowMs: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject(MESSAGE_SENDER)
    private readonly messageSender: IMessageSender,
  ) {
    this.maxMessages = this.configService.getOrThrow<number>('RATE_LIMIT_MAX_MESSAGES');
    this.windowMs = this.configService.getOrThrow<number>('RATE_LIMIT_WINDOW_MS');

    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.windowMs,
    );
  }

  async handle(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const now = Date.now();
    const entry = this.entries.get(ctx.phone);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.entries.set(ctx.phone, { count: 1, windowStart: now });
      return next();
    }

    if (entry.count >= this.maxMessages) {
      this.logger.warn(`Rate limit atingido para ${ctx.phone}`);
      await this.messageSender.send(
        ctx.phone,
        `Ops! Você enviou muitas mensagens em pouco tempo. Aguarde um momento antes de tentar novamente.`,
      );
      return;
    }

    entry.count++;
    return next();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [phone, entry] of this.entries) {
      if (now - entry.windowStart >= this.windowMs) {
        this.entries.delete(phone);
      }
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
