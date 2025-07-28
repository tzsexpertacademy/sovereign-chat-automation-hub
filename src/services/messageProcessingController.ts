/**
 * Controlador Centralizado de Processamento de Mensagens
 * CONTROLE ÚNICO: Evita processamento duplo e garante que apenas o batch system processe mensagens
 */

export class MessageProcessingController {
  private static instance: MessageProcessingController;
  private globalLocks: Map<string, boolean> = new Map();
  private processedMessages: Set<string> = new Set();

  private constructor() {}

  static getInstance(): MessageProcessingController {
    if (!MessageProcessingController.instance) {
      MessageProcessingController.instance = new MessageProcessingController();
    }
    return MessageProcessingController.instance;
  }

  /**
   * Verificar se uma mensagem pode ser processada
   */
  canProcessMessage(messageId: string, chatId: string): boolean {
    const chatLockKey = `chat_${chatId}`;
    const messageLockKey = `msg_${messageId}`;

    // Verificar se chat está com lock
    if (this.globalLocks.get(chatLockKey)) {
      console.log('🔒 [CONTROLLER] Chat com lock ativo:', chatId);
      return false;
    }

    // Verificar se mensagem já foi processada
    if (this.processedMessages.has(messageLockKey)) {
      console.log('✅ [CONTROLLER] Mensagem já processada:', messageId);
      return false;
    }

    return true;
  }

  /**
   * Aplicar lock em um chat
   */
  lockChat(chatId: string): void {
    const chatLockKey = `chat_${chatId}`;
    this.globalLocks.set(chatLockKey, true);
    console.log('🔒 [CONTROLLER] Lock aplicado no chat:', chatId);
  }

  /**
   * Liberar lock de um chat
   */
  unlockChat(chatId: string): void {
    const chatLockKey = `chat_${chatId}`;
    this.globalLocks.delete(chatLockKey);
    console.log('🔓 [CONTROLLER] Lock liberado do chat:', chatId);
  }

  /**
   * Marcar mensagem como processada
   */
  markMessageProcessed(messageId: string): void {
    const messageLockKey = `msg_${messageId}`;
    this.processedMessages.add(messageLockKey);
    console.log('✅ [CONTROLLER] Mensagem marcada como processada:', messageId);
  }

  /**
   * Marcar múltiplas mensagens como processadas
   */
  markMessagesProcessed(messageIds: string[]): void {
    messageIds.forEach(messageId => {
      this.markMessageProcessed(messageId);
    });
  }

  /**
   * Verificar se chat está com lock
   */
  isChatLocked(chatId: string): boolean {
    const chatLockKey = `chat_${chatId}`;
    return this.globalLocks.get(chatLockKey) || false;
  }

  /**
   * Verificar se mensagem já foi processada
   */
  isMessageProcessed(messageId: string): boolean {
    const messageLockKey = `msg_${messageId}`;
    return this.processedMessages.has(messageLockKey);
  }

  /**
   * Limpar processados antigos (executar periodicamente)
   */
  cleanupOldProcessed(): void {
    // Manter apenas os últimos 1000 processados para não consumir muita memória
    if (this.processedMessages.size > 1000) {
      const entries = Array.from(this.processedMessages);
      const toKeep = entries.slice(-500); // Manter últimos 500
      this.processedMessages.clear();
      toKeep.forEach(entry => this.processedMessages.add(entry));
      console.log('🧹 [CONTROLLER] Limpeza de mensagens processadas executada');
    }
  }

  /**
   * Status do controlador
   */
  getStatus(): {
    activeLocks: number;
    processedMessages: number;
  } {
    return {
      activeLocks: this.globalLocks.size,
      processedMessages: this.processedMessages.size
    };
  }
}

// Export singleton
export const messageProcessingController = MessageProcessingController.getInstance();