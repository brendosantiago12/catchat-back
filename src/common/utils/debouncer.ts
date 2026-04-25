/* eslint-disable @typescript-eslint/no-misused-promises */
import { Message, MessageMedia } from 'whatsapp-web.js';

export interface MessageQueueItem {
  message: Message;
  media?: MessageMedia;
}

export class Debouncer {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private messageQueues: Map<string, MessageQueueItem[]> = new Map();
  private readonly DEFAULT_DELAY = 5000; // 5 segundos

  /**
   * Adiciona uma mensagem à fila para processamento em lote
   * @param key Identificador único (número de telefone)
   * @param messageItem Item da mensagem a ser enfileirado
   * @param processFn Função a ser executada após o tempo de espera
   * @param delay Tempo de espera em milissegundos
   */
  enqueue(
    key: string,
    messageItem: MessageQueueItem,
    processFn: (items: MessageQueueItem[]) => Promise<void>,
    delay: number = this.DEFAULT_DELAY,
  ): void {
    // Inicializa a fila se ainda não existir para este usuário
    if (!this.messageQueues.has(key)) {
      this.messageQueues.set(key, []);
    }

    const queue = this.messageQueues.get(key);

    // Se a nova mensagem contém mídia e é uma imagem, remove mensagens anteriores com imagem
    if (
      messageItem.media &&
      messageItem.media.mimetype.includes('image') &&
      queue
    ) {
      const filteredQueue = queue.filter(
        (item) => !item.media || !item.media.mimetype.includes('image'),
      );
      filteredQueue.push(messageItem);
      this.messageQueues.set(key, filteredQueue);
    } else {
      // Caso contrário, apenas adiciona à fila
      if (queue) queue.push(messageItem);
    }

    // Configura ou reseta o timeout
    this.debounce(
      key,
      async () => {
        const itemsToProcess = this.messageQueues.get(key) || [];
        // Limpa a fila após obter os itens
        this.messageQueues.set(key, []);

        // Processa os itens em lote
        await processFn(itemsToProcess);
      },
      delay,
    );
  }

  /**
   * Implementação básica do debounce que reseta o temporizador quando chamado
   */
  private debounce(key: string, fn: () => void, delay: number): void {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }

    const timeout = setTimeout(() => {
      fn();
      this.timeouts.delete(key);
    }, delay);

    this.timeouts.set(key, timeout);
  }

  /**
   * Força o processamento imediato da fila para um determinado usuário
   */
  flushQueue(key: string): MessageQueueItem[] {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }

    const items = this.messageQueues.get(key) || [];
    this.messageQueues.set(key, []);
    return items;
  }

  /**
   * Verifica se existe uma fila em processamento para o usuário
   */
  hasQueue(key: string): boolean {
    const queue = this.messageQueues.get(key);
    return !!queue && queue.length > 0;
  }
}
