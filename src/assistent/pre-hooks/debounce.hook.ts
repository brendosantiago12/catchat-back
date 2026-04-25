import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMessageHook, MessageContext } from './interfaces/message-hook.interface';
import { Debouncer } from '../../common/utils/debouncer';

@Injectable()
export class DebounceHook implements IMessageHook {
  private readonly logger = new Logger(DebounceHook.name);
  private readonly debouncer = new Debouncer();
  private readonly delayMs: number;

  constructor(private readonly configService: ConfigService) {
    this.delayMs = this.configService.getOrThrow<number>('DEBOUNCE_DELAY_MS');
  }

  async handle(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.debouncer.enqueue(
        ctx.phone,
        { message: ctx.rawItems[0].message },
        async (items) => {
          try {
            const combinedText = items
              .map((item) => item.message.body)
              .join('\n')
              .trim();

            ctx.text = combinedText;
            ctx.rawItems = items;

            this.logger.log(
              `Debounce consolidou ${items.length} mensagem(ns) de ${ctx.phone}`,
            );

            await next();
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        this.delayMs,
      );
    });
  }
}
