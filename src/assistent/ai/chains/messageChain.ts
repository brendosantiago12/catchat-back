import { BaseChain } from './baseChain';
import { ConversationService } from '../../conversation/conversation.service';

export class MessageChain extends BaseChain {
  private conversationService: ConversationService;

  constructor(conversationService: ConversationService) {
    super();
    this.conversationService = conversationService;
  }

  async call(values: { input: string; userId: string }): Promise<any> {
    this.logger.log(`MessageChain called with input: `, values);
    // Busca a mensagem original do admirador secreto
    const message = await this.conversationService.getSecretMessageForUser(
      values.userId,
    );
    if (!message) {
      return {
        response:
          'Não foi encontrada uma carta para você. Talvez o admirador ainda não enviou!',
        intent: 'MESSAGE',
      };
    }
    return {
      response: `_Admirer_:  \n\n _${message}_  \n\n\n Acesse abaixo para enviar mensagens anônimas também:\n catchat.com.br`,
      intent: 'MESSAGE',
    };
  }
}
