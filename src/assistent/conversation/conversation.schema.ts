export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface UserConversation {
  userId: string;
  messages: ConversationMessage[];
  lastActivity: Date;
}
