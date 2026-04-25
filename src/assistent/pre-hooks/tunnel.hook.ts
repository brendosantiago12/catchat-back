import { Injectable, Logger, Inject } from '@nestjs/common';
import { IMessageHook, MessageContext } from './interfaces/message-hook.interface';
import { TunnelService } from '../services/tunnel.service';
import { IMessageSender, MESSAGE_SENDER } from '../../common/messaging/messaging.interface';

@Injectable()
export class TunnelHook implements IMessageHook {
  private readonly logger = new Logger(TunnelHook.name);

  constructor(
    private readonly tunnelService: TunnelService,
    @Inject(MESSAGE_SENDER)
    private readonly messageSender: IMessageSender,
  ) {}

  async handle(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const tag = this.extractTag(ctx.text);

    if (tag) {
      // Mensagem com #tag — tenta rotear para o túnel correspondente
      const session = await this.tunnelService.findSessionByTag(ctx.phone, tag);

      if (session) {
        const messageWithoutTag = ctx.text.replace(/^#\S+\s*/, '').trim();
        this.logger.log(`Mensagem de ${ctx.phone} roteada para túnel #${tag}`);
        await this.tunnelService.relay(session, ctx.phone, messageWithoutTag);
        return;
      }

      // Tag informada mas não encontrada — avisa e encerra
      await this.messageSender.send(
        ctx.phone,
        `❌ Nenhum túnel ativo encontrado para *#${tag}*.\n` +
        `Verifique a tag e tente novamente.`,
      );
      return;
    }

    // Sem tag — verifica se o usuário tem algum túnel ativo
    const activeSessions = await this.tunnelService.findAllActiveSessions(ctx.phone);

    if (activeSessions.length > 0) {
      // Tem túnel(is) ativo(s) mas não usou # — instrui sobre como usar
      const tagList = activeSessions.map((s) => {
        const isSender = s.senderPhone === ctx.phone;
        return isSender ? `*#${s.tag}*` : `*#admirador*`;
      }).join(', ');

      await this.messageSender.send(
        ctx.phone,
        `💬 Você tem túnel(is) ativo(s)!\n\n` +
        `Para enviar uma mensagem, comece com a tag correspondente:\n${tagList}\n\n` +
        `Exemplo: #${activeSessions[0].tag} Oi! 😊`,
      );
      return;
    }

    // Nenhum túnel ativo — prossegue para próximo hook
    return next();
  }

  private extractTag(text: string): string | null {
    const match = text.trim().match(/^#(\S+)/);
    return match ? match[1].toLowerCase() : null;
  }
}
