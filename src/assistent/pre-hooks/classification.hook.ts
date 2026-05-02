import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { IMessageHook, MessageContext, MessageIntent } from './interfaces/message-hook.interface';
import { MessageDeliveryService } from '../services/message-delivery.service';
import { SUPABASE_CLIENT } from '../../supabase/supabase.module';

const readMessagePrompt = `Você é um classificador de intenção para um sistema de cartas anônimas.
O destinatário recebeu uma notificação de que possui uma carta secreta e foi perguntado se deseja lê-la.

Classifique a mensagem abaixo como:
- READ_MESSAGE: se o usuário quer ler, confirma, aceita ou demonstra interesse na carta
- GENERAL: qualquer outro caso

Responda APENAS com READ_MESSAGE ou GENERAL, sem explicações.

Mensagem: {input}`;

const tunnelAcceptPrompt = `Você é um classificador de intenção para um sistema de cartas anônimas.
O destinatário acabou de ler uma carta secreta e foi perguntado se deseja entrar no túnel de mensagens com o admirador.

Classifique a mensagem abaixo como:
- TUNNEL_ACCEPT: se o usuário aceita, confirma, quer entrar no túnel ou demonstra interesse
- GENERAL: se o usuário recusa, ignora ou faz outra pergunta

Responda APENAS com TUNNEL_ACCEPT ou GENERAL, sem explicações.

Mensagem: {input}`;

@Injectable()
export class ClassificationHook implements IMessageHook {
  private readonly logger = new Logger(ClassificationHook.name);
  private readonly readMessageChain: RunnableSequence;
  private readonly tunnelAcceptChain: RunnableSequence;

  constructor(
    private readonly configService: ConfigService,
    private readonly messageDeliveryService: MessageDeliveryService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini-2024-07-18',
      temperature: 0,
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
    });

    this.readMessageChain = RunnableSequence.from([
      PromptTemplate.fromTemplate(readMessagePrompt),
      model,
      new StringOutputParser(),
    ]);

    this.tunnelAcceptChain = RunnableSequence.from([
      PromptTemplate.fromTemplate(tunnelAcceptPrompt),
      model,
      new StringOutputParser(),
    ]);
  }

  async handle(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    const { data: senderRow } = await this.supabase
      .from('send_messages')
      .select('id')
      .eq('sender_phone', ctx.phone)
      .limit(1)
      .maybeSingle();

    if (senderRow !== null) {
      this.logger.log(`${ctx.phone} identificado como remetente, encaminhando para AiService`);
      return next();
    }

    const { data: record } = await this.supabase
      .from('send_messages')
      .select('recipient_state')
      .eq('recipient_phone', ctx.phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const state = record?.recipient_state ?? 'WAITING_READ';

    ctx.intent = await this.classify(ctx.text, state);

    this.logger.log(`[${state}] Mensagem de ${ctx.phone} classificada como: ${ctx.intent}`);

    if (ctx.intent === 'READ_MESSAGE') {
      await this.messageDeliveryService.sendSecretMessage(ctx.phone);
      return;
    }

    if (ctx.intent === 'TUNNEL_ACCEPT') {
      await this.messageDeliveryService.openTunnel(ctx.phone);
      return;
    }

    return next();
  }

  private async classify(text: string, state: string): Promise<MessageIntent> {
    try {
      if (state === 'WAITING_READ') {
        const result = await this.readMessageChain.invoke({ input: text });
        return result.trim().toUpperCase() === 'READ_MESSAGE' ? 'READ_MESSAGE' : 'GENERAL';
      }

      if (state === 'WAITING_TUNNEL') {
        const result = await this.tunnelAcceptChain.invoke({ input: text });
        return result.trim().toUpperCase() === 'TUNNEL_ACCEPT' ? 'TUNNEL_ACCEPT' : 'GENERAL';
      }

      return 'GENERAL';
    } catch (error) {
      this.logger.error('Erro ao classificar mensagem, usando fallback GENERAL:', error);
      return 'GENERAL';
    }
  }
}
