import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  UserConversationModel,
  ConversationMessage,
  UserConversation,
} from './conversation.schema';
import { SendMessage } from '../../schema/send-message.schema';

@Injectable()
export class ConversationService implements OnModuleInit {
  private readonly logger = new Logger(ConversationService.name);

  private conversations: Map<string, UserConversation> = new Map();

  private readonly INACTIVITY_LIMIT_HOURS = 24;
  private readonly MEMORY_CLEANUP_MINUTES = 30;
  private readonly MAX_MESSAGES_TO_LOAD = 10;

  constructor(
    @InjectModel(UserConversationModel.name)
    private userConversationModel: Model<UserConversationModel>,
    @InjectModel(SendMessage.name)
    private sendMessageModel: Model<SendMessage>,
  ) { }

  /**
   * Inicializa o serviço quando o módulo é carregado
   */
  async onModuleInit() {
    // Configurar intervalos periódicos
    setInterval(
      () => this.cleanupMemoryConversations(),
      1000 * 60 * this.MEMORY_CLEANUP_MINUTES,
    );

    this.logger.log('ConversationService inicializado');
  }

  /**
   * Adiciona uma mensagem do usuário ao histórico e salva imediatamente no MongoDB
   */
  async addMsgUserHistory(userId: string, content: string): Promise<void> {
    this.ensureUserExists(userId);

    const message: ConversationMessage = {
      role: 'user',
      content,
      timestamp: new Date(),
    };

    // Atualizar em memória
    const conversation = this.conversations.get(userId);
    if (!conversation) {
      this.logger.error(`Conversa não encontrada para o usuário ${userId}`);
      return;
    }
    conversation.messages.push(message);
    conversation.lastActivity = new Date();
    this.conversations.set(userId, conversation);

    // Salvar imediatamente no MongoDB
    try {
      await this.userConversationModel.findOneAndUpdate(
        { userId },
        {
          $push: { messages: message },
          $set: { lastActivity: new Date() },
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error(
        `Erro ao salvar mensagem do usuário ${userId} no MongoDB`,
        error,
      );
    }
  }

  /**
   * Adiciona uma resposta do assistente ao histórico e salva imediatamente no MongoDB
   */
  async addAssistantResponse(userId: string, content: string): Promise<void> {
    this.ensureUserExists(userId);

    const message: ConversationMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
    };

    // Atualizar em memória
    const conversation = this.conversations.get(userId);
    if (!conversation) {
      this.logger.error(`Conversa não encontrada para o usuário ${userId}`);
      return;
    }
    conversation.messages.push(message);
    conversation.lastActivity = new Date();
    this.conversations.set(userId, conversation);

    // Salvar imediatamente no MongoDB
    try {
      await this.userConversationModel.findOneAndUpdate(
        { userId },
        {
          $push: { messages: message },
          $set: { lastActivity: new Date() },
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error(
        `Erro ao salvar resposta para ${userId} no MongoDB`,
        error,
      );
      // Continua executando normalmente mesmo em caso de erro com o MongoDB
    }
  }

  /**
   * Retorna o histórico de conversa de um usuário do cache ou carrega do MongoDB se necessário
   */
  getUserHistory(userId: string, limit: number = 10): ConversationMessage[] {
    // Se não existe em memória, tenta carregar do MongoDB
    if (!this.conversations.has(userId)) {
      this.loadUserConversationFromDB(userId);
      return []; // Retorna vazio imediatamente, o carregamento é assíncrono
    }

    // Obter as últimas X mensagens
    const conversation = this.conversations.get(userId);
    if (!conversation) {
      this.logger.error(`Conversa não encontrada para o usuário ${userId}`);
      return [];
    }
    return conversation.messages.slice(-limit);
  }

  /**
   * Limpa o histórico de conversa de um usuário (em memória e no MongoDB)
   */
  async clearUserHistory(userId: string): Promise<void> {
    this.ensureUserExists(userId);

    // Limpar em memória
    const conversation = this.conversations.get(userId);
    if (!conversation) {
      this.logger.error(`Conversa não encontrada para o usuário ${userId}`);
      return;
    }
    conversation.messages = [];
    conversation.lastActivity = new Date();
    this.conversations.set(userId, conversation);

    // Limpar no MongoDB
    try {
      await this.userConversationModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            messages: [],
            lastActivity: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error(
        `Erro ao limpar conversa de ${userId} no MongoDB`,
        error,
      );
    }
  }

  /**
   * Garante que o usuário existe no mapa de conversas
   * Se não existir, cria uma nova conversa em memória e tenta carregar do MongoDB
   */
  private ensureUserExists(userId: string): void {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, {
        userId,
        messages: [],
        lastActivity: new Date(),
      });

      // Carregar histórico do MongoDB de forma assíncrona
      this.loadUserConversationFromDB(userId);
    }
  }

  /**
   * Carrega a conversa do usuário do MongoDB para a memória
   */
  private async loadUserConversationFromDB(userId: string): Promise<void> {
    try {
      // Buscar apenas as últimas mensagens para economizar memória
      const conversation = await this.userConversationModel.findOne(
        { userId },
        { messages: { $slice: -this.MAX_MESSAGES_TO_LOAD } },
      );

      if (conversation) {
        this.conversations.set(userId, {
          userId,
          messages: conversation.messages || [],
          lastActivity: conversation.lastActivity || new Date(),
        });
        this.logger.debug(`Conversa de ${userId} carregada do MongoDB`);
      }
    } catch (error) {
      this.logger.error(
        `Erro ao carregar conversa de ${userId} do MongoDB`,
        error,
      );
    }
  }

  /**
   * Remove conversas inativas da memória para liberar recursos
   * Conversas já estão salvas no MongoDB, então podem ser removidas com segurança
   */
  private cleanupMemoryConversations(): void {
    const now = new Date();
    let removedCount = 0;

    for (const [userId, conversation] of this.conversations.entries()) {
      const minutesInactive =
        (now.getTime() - conversation.lastActivity.getTime()) / (1000 * 60);

      // Se inativo por mais de 30 minutos, remove da memória (já está no MongoDB)
      if (minutesInactive > 30) {
        this.conversations.delete(userId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(
        `Removidas ${removedCount} conversas inativas da memória`,
      );
    }
  }

  /**
   * Remove conversas antigas do MongoDB (executa diariamente)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldConversations(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - this.INACTIVITY_LIMIT_HOURS);

      const result = await this.userConversationModel.deleteMany({
        lastActivity: { $lt: cutoffDate },
      });

      this.logger.log(
        `Removidas ${result.deletedCount} conversas antigas do MongoDB`,
      );
    } catch (error) {
      this.logger.error('Erro ao limpar conversas antigas', error);
    }
  }

  /**
   * Busca uma lista de mensagens com status falso enviada para o usuário (recipientPhone)
   */
  async getSecretMessagesForUser(
    recipientPhone: string,
  ): Promise<SendMessage[]> {
    return await this.sendMessageModel
      .find({ recipientPhone, status: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getSecretMessageDocForUser(senderPhone: string): Promise<any | null> {
    return await this.sendMessageModel
      .findOne({ senderPhone })
      .sort({ createdAt: -1 });
  }

  async updateSecretMessageStatus(recipientPhone: string): Promise<void> {
    try {
      const result = await this.sendMessageModel.updateMany(
        { recipientPhone, status: false }, // Filtro
        { $set: { status: true } }      // Atualização
      );

      this.logger.log(
        `Atualizado o status de ${result.modifiedCount} mensagens para usuário ${recipientPhone} para verdadeiro`,
      );
    } catch (error) {
      this.logger.error('Erro ao atualizar o status das mensagens', error);
    }
  }
}
