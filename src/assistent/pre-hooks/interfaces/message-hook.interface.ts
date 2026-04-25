import { MessageQueueItem } from '../../../common/utils/debouncer';

export type MessageIntent = 'READ_MESSAGE' | 'TUNNEL_ACCEPT' | 'GENERAL';

export interface MessageContext {
  phone: string;
  text: string;
  rawItems: MessageQueueItem[];
  intent?: MessageIntent;
}

export interface IMessageHook {
  handle(ctx: MessageContext, next: () => Promise<void>): Promise<void>;
}
