import { BaseChain } from './baseChain';
import { ConversationService } from '../../conversation/conversation.service';

export class AlertOfSendChain extends BaseChain {
  private conversationService: ConversationService;

  constructor(conversationService: ConversationService) {
    super();
    this.conversationService = conversationService;
  }

  async call(values: { input: string; userId: string }): Promise<any> {
    this.logger.log(`AlertOfSendChain called with input: `, values);

    const doc = await this.conversationService.getSecretMessageDocForUser(
      values.userId,
    );

    return {
      response: `Ooi ${doc.senderName}!! 💌\n\n Passando pra avisar que sua carta foi enviada com sucesso para ${doc.recipientName}.`,
      intent: 'ALERT_OF_SEND',
    };

    /**
     * 
     // Caso o usuário opte pelo plano B com as opções de envio de feedback + resumo da conversa
     return {
      response: `Ooi ${doc.senderName}!! 💌
      \n\n Passando pra avisar que sua carta foi enviada com sucesso para ${doc.recipientName}.
      \n\n Logo mais te enviaremos um resumo da interação de ${doc.recipientName} com a sua carta.`,
      intent: 'ALERT_OF_SEND',
    };

    // Caso o usuário opte pelo plano C com as opções de envio de feedback + resumo da conversa
     return {
      response: `Ooi ${doc.senderName}!! 💌
      \n\n Passando pra avisar que sua carta foi enviada com sucesso para ${doc.recipientName}.
      \n\n Estamos aguardando ${doc.recipientName} aceitar o convite de ter uma conversa com você.`,
      intent: 'ALERT_OF_SEND',
    };
     *  */
  }
}
