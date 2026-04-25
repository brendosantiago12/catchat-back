export const MESSAGE_SENDER = 'MESSAGE_SENDER';

export interface IMessageSender {
  send(phone: string, message: string): Promise<void>;
}
