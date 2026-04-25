import { Injectable, Logger } from '@nestjs/common';
import { IMessageHook, MessageContext } from './interfaces/message-hook.interface';
import { MessageGuardHook } from './message-guard.hook';
import { RateLimitHook } from './rate-limit.hook';
import { DebounceHook } from './debounce.hook';
import { TunnelHook } from './tunnel.hook';
import { ClassificationHook } from './classification.hook';

@Injectable()
export class MessagePipelineService {
  private readonly logger = new Logger(MessagePipelineService.name);
  private readonly hooks: IMessageHook[];

  constructor(
    messageGuardHook: MessageGuardHook,
    rateLimitHook: RateLimitHook,
    debounceHook: DebounceHook,
    tunnelHook: TunnelHook,
    classificationHook: ClassificationHook,
  ) {
    this.hooks = [messageGuardHook, rateLimitHook, debounceHook, tunnelHook, classificationHook];
  }

  async run(ctx: MessageContext, finalHandler: (ctx: MessageContext) => Promise<void>): Promise<void> {
    const execute = (index: number): () => Promise<void> => {
      if (index >= this.hooks.length) {
        return () => finalHandler(ctx);
      }
      return () => this.hooks[index].handle(ctx, execute(index + 1));
    };

    try {
      await execute(0)();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro na pipeline de mensagens para ${ctx.phone}: ${message}`);
    }
  }
}
