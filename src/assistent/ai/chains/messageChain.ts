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
    const message = await this.conversationService.getSecretMessagesForUser(
      values.userId,
    );
    if (message.length === 0) {
      return {
        response:
          'Não foi encontrada uma carta para você. Talvez o admirador ainda não enviou!',
        intent: 'MESSAGE',
      };
    }
    
    const arrayMessages = message.map((msg) => msg.senderMessage);
    const messagesString = arrayMessages.join('\n\n');
    await this.conversationService.updateSecretMessageStatus(values.userId)

    return {
      response: `_Admirer_:  \n\n${messagesString}\n\n Acesse abaixo para enviar mensagens anônimas também:\ncatchat.com.br`,
      intent: 'MESSAGE',
    };
  }
}
