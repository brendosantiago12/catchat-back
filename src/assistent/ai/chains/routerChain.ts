import { BaseChain } from './baseChain';
import { GeneralChain } from './generalChain';
import { ChatOpenAI } from '@langchain/openai';
import { ConversationService } from '../../conversation/conversation.service';
import { AlertOfSendChain } from './alertOfSendChain';

export class RouterChain extends BaseChain {
  private generalChain: GeneralChain;
  private alertOfSendChain: AlertOfSendChain;

  constructor(model: ChatOpenAI, conversationService: ConversationService) {
    super();
    this.generalChain = new GeneralChain(model);
    this.alertOfSendChain = new AlertOfSendChain(conversationService);
  }

  async call(values: {
    input: string;
    history: any[];
    userId: string;
  }): Promise<any> {
    this.logger.log(`RouterChain called with input: `, values);

    if (values.input.trim().toLowerCase() === 'alerta de envio') {
      return this.alertOfSendChain.call({ input: '', userId: values.userId });
    }

    return this.generalChain.call(values);
  }
}
