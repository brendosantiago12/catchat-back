import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ConversationService } from '../conversation/conversation.service';
import {
  IMessageSender,
  MESSAGE_SENDER,
} from '../../common/messaging/messaging.interface';
import { RouterChain } from './chains/routerChain';

@Injectable()
export class AiService {
  private model: ChatOpenAI;
  private RouterChain: RouterChain;
  private readonly logger = new Logger(AiService.name);

  constructor(
    private conversationService: ConversationService,
    @Inject(MESSAGE_SENDER)
    private readonly messageSender: IMessageSender,
  ) {
    this.model = new ChatOpenAI({
      modelName: 'gpt-4o-mini-2024-07-18',
      temperature: 0.7,
    });
    this.RouterChain = new RouterChain(this.model, this.conversationService);
  }

  async processMessage(userId: string, message: string) {
    let responseText;
    let response;

    try {
      await this.conversationService.addMsgUserHistory(userId, message);

      const conversationHistory =
        this.conversationService.getUserHistory(userId);

      response = await this.RouterChain.call({
        input: message,
        history: conversationHistory,
        userId,
      });

      responseText = this.handleResponseText(response);
      await this.conversationService.addAssistantResponse(userId, responseText);
      this.messageSender.send(userId, responseText);

      return { text: responseText };
    } catch (error) {
      return this.handleProcessMessageError(error, userId);
    }
  }

  async clearUserHistory(userId: string): Promise<void> {
    await this.conversationService.clearUserHistory(userId);
  }

  private handleResponseText(response: any) {
    let responseText;
    if (response.response) {
      responseText = response.response;
    } else if (response.output) {
      responseText = response.output;
    } else {
      responseText =
        'Não foi possível gerar uma resposta. Por favor, tente novamente.';
    }
    return responseText;
  }

  private async handleProcessMessageError(error: any, userId: string) {
    this.logger.error('Erro ao processar mensagem:', error);

    const errorMessage =
      'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.';
    await this.conversationService.addAssistantResponse(userId, errorMessage);

    return {
      text: errorMessage,
      intent: 'ERROR',
    };
  }
}
