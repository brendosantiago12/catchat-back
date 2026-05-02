import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConversationMessage, UserConversation } from './conversation.schema';
import { SendMessage } from '../../schema/send-message.schema';
import { SUPABASE_CLIENT } from '../../supabase/supabase.module';

@Injectable()
export class ConversationService implements OnModuleInit {
  private readonly logger = new Logger(ConversationService.name);

  private conversations: Map<string, UserConversation> = new Map();

  private readonly INACTIVITY_LIMIT_HOURS = 24;
  private readonly MEMORY_CLEANUP_MINUTES = 30;
  private readonly MAX_MESSAGES_TO_LOAD = 10;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async onModuleInit() {
    setInterval(
      () => this.cleanupMemoryConversations(),
      1000 * 60 * this.MEMORY_CLEANUP_MINUTES,
    );

    this.logger.log('ConversationService inicializado');
  }

  async addMsgUserHistory(userId: string, content: string): Promise<void> {
    this.ensureUserExists(userId);

    const message: ConversationMessage = {
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const conversation = this.conversations.get(userId);
    if (!conversation) {
      this.logger.error(`Conversa não encontrada para o usuário ${userId}`);
      return;
    }
    conversation.messages.push(message);
    conversation.lastActivity = new Date();
    this.conversations.set(userId, conversation);

    try {
      await this.upsertConversation(userId, conversation.messages, conversation.lastActivity);
    } catch (error) {
      this.logger.error(`Erro ao salvar mensagem do usuário ${userId} no Supabase`, error);
    }
  }

  async addAssistantResponse(userId: string, content: string): Promise<void> {
    this.ensureUserExists(userId);

    const message: ConversationMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
    };

    const conversation = this.conversations.get(userId);
    if (!conversation) {
      this.logger.error(`Conversa não encontrada para o usuário ${userId}`);
      return;
    }
    conversation.messages.push(message);
    conversation.lastActivity = new Date();
    this.conversations.set(userId, conversation);

    try {
      await this.upsertConversation(userId, conversation.messages, conversation.lastActivity);
    } catch (error) {
      this.logger.error(`Erro ao salvar resposta para ${userId} no Supabase`, error);
    }
  }

  getUserHistory(userId: string, limit: number = 10): ConversationMessage[] {
    if (!this.conversations.has(userId)) {
      this.loadUserConversationFromDB(userId);
      return [];
    }

    const conversation = this.conversations.get(userId);
    if (!conversation) {
      this.logger.error(`Conversa não encontrada para o usuário ${userId}`);
      return [];
    }
    return conversation.messages.slice(-limit);
  }

  async clearUserHistory(userId: string): Promise<void> {
    this.ensureUserExists(userId);

    const conversation = this.conversations.get(userId);
    if (!conversation) {
      this.logger.error(`Conversa não encontrada para o usuário ${userId}`);
      return;
    }
    conversation.messages = [];
    conversation.lastActivity = new Date();
    this.conversations.set(userId, conversation);

    try {
      await this.upsertConversation(userId, [], conversation.lastActivity);
    } catch (error) {
      this.logger.error(`Erro ao limpar conversa de ${userId} no Supabase`, error);
    }
  }

  private ensureUserExists(userId: string): void {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, {
        userId,
        messages: [],
        lastActivity: new Date(),
      });
      this.loadUserConversationFromDB(userId);
    }
  }

  private async loadUserConversationFromDB(userId: string): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('user_conversations')
        .select('messages, last_activity')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        const allMessages: ConversationMessage[] = data.messages ?? [];
        this.conversations.set(userId, {
          userId,
          messages: allMessages.slice(-this.MAX_MESSAGES_TO_LOAD),
          lastActivity: new Date(data.last_activity),
        });
        this.logger.debug(`Conversa de ${userId} carregada do Supabase`);
      }
    } catch (error) {
      this.logger.error(`Erro ao carregar conversa de ${userId} do Supabase`, error);
    }
  }

  private cleanupMemoryConversations(): void {
    const now = new Date();
    let removedCount = 0;

    for (const [userId, conversation] of this.conversations.entries()) {
      const minutesInactive =
        (now.getTime() - conversation.lastActivity.getTime()) / (1000 * 60);

      if (minutesInactive > 30) {
        this.conversations.delete(userId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(`Removidas ${removedCount} conversas inativas da memória`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldConversations(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - this.INACTIVITY_LIMIT_HOURS);

      const { error } = await this.supabase
        .from('user_conversations')
        .delete()
        .lt('last_activity', cutoffDate.toISOString());

      if (error) throw error;
      this.logger.log('Conversas antigas removidas do Supabase');
    } catch (error) {
      this.logger.error('Erro ao limpar conversas antigas', error);
    }
  }

  async getSecretMessagesForUser(recipientPhone: string): Promise<SendMessage[]> {
    const { data } = await this.supabase
      .from('send_messages')
      .select('*')
      .eq('recipient_phone', recipientPhone)
      .eq('status', false)
      .order('created_at', { ascending: false });

    return (data ?? []).map(this.mapSendMessage);
  }

  async getSecretMessageDocForUser(senderPhone: string): Promise<SendMessage | null> {
    const { data } = await this.supabase
      .from('send_messages')
      .select('*')
      .eq('sender_phone', senderPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data ? this.mapSendMessage(data) : null;
  }

  async updateSecretMessageStatus(recipientPhone: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('send_messages')
        .update({ status: true, updated_at: new Date().toISOString() })
        .eq('recipient_phone', recipientPhone)
        .eq('status', false);

      if (error) throw error;
      this.logger.log(`Status das mensagens atualizado para usuário ${recipientPhone}`);
    } catch (error) {
      this.logger.error('Erro ao atualizar o status das mensagens', error);
    }
  }

  private async upsertConversation(userId: string, messages: ConversationMessage[], lastActivity: Date): Promise<void> {
    const { error } = await this.supabase
      .from('user_conversations')
      .upsert(
        { user_id: userId, messages, last_activity: lastActivity.toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

    if (error) throw error;
  }

  private mapSendMessage(row: any): SendMessage {
    return {
      id: row.id,
      senderName: row.sender_name,
      senderPhone: row.sender_phone,
      senderMessage: row.sender_message,
      recipientName: row.recipient_name,
      recipientPhone: row.recipient_phone,
      status: row.status,
      recipientState: row.recipient_state,
      productType: row.product_type,
    };
  }
}
