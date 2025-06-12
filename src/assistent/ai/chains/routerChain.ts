import { BaseChain } from './baseChain';
import { GeneralChain } from './generalChain';
import { MessageChain } from './messageChain';
import { WelcomeChain } from './welcomeChain';
import { ChatOpenAI } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';
import { ConversationService } from '../../conversation/conversation.service';
import { AlertOfSendChain } from './alertOfSendChain';

// Responda apenas com 'WELCOME' se o usuário está iniciando a conversa e deve receber uma mensagem de boas-vindas.

const routerSystemPrompt = `
Sua tarefa é classificar a intenção da mensagem do usuário para um assistente do amor.
Responda apenas com 'MESSAGE' se o usuário está pedindo para ler a carta/mensagem do admirador secreto.
Responda apenas com 'GENERAL' para qualquer outro caso.
Não explique, não adicione nada além de 'MESSAGE' ou 'GENERAL'.

Histórico da conversa:
{history}

Mensagem: {input}
`;

export class RouterChain extends BaseChain {
  private generalChain: GeneralChain;
  private messageChain: MessageChain;
  private welcomeChain: WelcomeChain;
  private alertOfSendChain: AlertOfSendChain;
  private llmChain: LLMChain;

  constructor(model: ChatOpenAI, conversationService: ConversationService) {
    super();
    this.generalChain = new GeneralChain(model);
    this.messageChain = new MessageChain(conversationService);
    this.welcomeChain = new WelcomeChain(conversationService);
    this.alertOfSendChain = new AlertOfSendChain(conversationService);
    const prompt = new PromptTemplate({
      template: routerSystemPrompt,
      inputVariables: ['input', 'history'],
    });
    this.llmChain = new LLMChain({
      prompt,
      llm: model,
      outputKey: 'output',
    });
  }

  async call(values: {
    input: string;
    history: any[];
    userId: string;
    recipientName?: string;
    secretMessage?: string;
  }): Promise<any> {
    this.logger.log(`RouterChain called with input: `, values);

    if (values.input.trim().toLowerCase() === 'boas vindas') {
      return this.welcomeChain.call({
        input: '',
        userId: values.userId,
      });
    }

    if (values.input.trim().toLowerCase() === 'alerta de envio') {
      return this.alertOfSendChain.call({
        input: '',
        userId: values.userId,
      });
    }

    // Formata o histórico para o prompt, igual ao generalChain
    const recentHistory = values.history ? values.history.slice(-7) : [];
    const formattedHistory = this.formatHistoryInput('', recentHistory);

    const result = await this.llmChain.call({
      input: values.input,
      history: formattedHistory,
    });
    const intent = (result.output || '').toString().trim().toUpperCase();
    this.logger.log(`Intent detected: `, intent);

    if (intent === 'MESSAGE') {
      return this.messageChain.call(values);
    }
    return this.generalChain.call(values);
  }
}
