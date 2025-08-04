/**
 * Controlador Centralizado de Processamento de Mensagens
 * CONTROLE ÚNICO: Evita processamento duplo e garante que apenas o batch system processe mensagens
 */

export class MessageProcessingController {
  private static instance: MessageProcessingController;
  private globalLocks: Map<string, number | boolean> = new Map();
  private processedMessages: Set<string> = new Set();
  private recentResponses: Map<string, { timestamp: number; content: string }> = new Map();
  private activeBatches: Set<string> = new Set();

  private constructor() {}

  static getInstance(): MessageProcessingController {
    if (!MessageProcessingController.instance) {
      MessageProcessingController.instance = new MessageProcessingController();
    }
    return MessageProcessingController.instance;
  }

  /**
   * Verificar se uma mensagem pode ser processada com controle rigoroso por chat_id
   */
  canProcessMessage(messageId: string, chatId: string): boolean {
    const chatLockKey = `chat_${chatId}`;
    const messageLockKey = `msg_${messageId}`;

    // PRIORITÁRIO: Verificar se chat está com lock (bloqueia TODO o chat)
    if (this.isChatLocked(chatId)) {
      console.log('🔒 [CONTROLLER] Chat com lock ativo - BLOQUEANDO:', chatId);
      return false;
    }

    // SECUNDÁRIO: Verificar se mensagem específica já foi processada
    if (this.processedMessages.has(messageLockKey)) {
      console.log('✅ [CONTROLLER] Mensagem específica já processada:', messageId);
      return false;
    }

    console.log('✅ [CONTROLLER] Mensagem PODE ser processada:', { messageId, chatId });
    return true;
  }

  /**
   * Verificar se uma mensagem pode ser processada com timestamp
   */
  canProcessMessageWithTimestamp(messageId: string, chatId: string, timestamp?: number): boolean {
    const chatLockKey = `chat_${chatId}`;
    const messageLockKey = `msg_${messageId}`;
    const currentTime = Date.now();

    // Verificar se chat está com lock baseado em timestamp
    const lockTime = this.globalLocks.get(chatLockKey);
    if (lockTime) {
      if (typeof lockTime === 'number' && (currentTime - lockTime) < 10000) { // 10s timeout
        console.log('🔒 [CONTROLLER] Chat com lock ativo (timestamp):', chatId, `há ${currentTime - lockTime}ms`);
        return false;
      } else if (typeof lockTime === 'boolean' && lockTime) {
        console.log('🔒 [CONTROLLER] Chat com lock ativo (boolean):', chatId);
        return false;
      }
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
    this.globalLocks.set(chatLockKey, Date.now());
    console.log('🔒 [CONTROLLER] Lock aplicado no chat:', chatId);
  }

  /**
   * Aplicar lock com timestamp customizado
   */
  lockChatWithTimestamp(chatId: string, timestamp?: number): void {
    const chatLockKey = `chat_${chatId}`;
    this.globalLocks.set(chatLockKey, timestamp || Date.now());
    console.log('🔒 [CONTROLLER] Lock aplicado no chat com timestamp:', chatId);
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
    const lockTime = this.globalLocks.get(chatLockKey);
    
    if (!lockTime) return false;
    
    // Se é timestamp, verificar se ainda é válido (10s timeout)
    if (typeof lockTime === 'number') {
      const currentTime = Date.now();
      if ((currentTime - lockTime) > 10000) {
        // Lock expirado, remover
        this.globalLocks.delete(chatLockKey);
        console.log('⏰ [CONTROLLER] Lock expirado removido:', chatId);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Verificar se mensagem já foi processada
   */
  isMessageProcessed(messageId: string): boolean {
    const messageLockKey = `msg_${messageId}`;
    return this.processedMessages.has(messageLockKey);
  }

  /**
   * Verificar se uma resposta recente já foi enviada para evitar duplicação
   */
  hasRecentResponse(chatId: string, content: string): boolean {
    const responseKey = `${chatId}_${content.substring(0, 50)}`;
    const recent = this.recentResponses.get(responseKey);
    
    if (recent && (Date.now() - recent.timestamp) < 30000) { // 30 segundos
      console.log('🔄 [CONTROLLER] Resposta recente detectada - EVITANDO DUPLICAÇÃO:', responseKey);
      return true;
    }
    
    return false;
  }

  /**
   * Registrar resposta enviada para evitar duplicações futuras
   */
  registerResponse(chatId: string, content: string): void {
    const responseKey = `${chatId}_${content.substring(0, 50)}`;
    this.recentResponses.set(responseKey, {
      timestamp: Date.now(),
      content: content
    });
    
    console.log('📝 [CONTROLLER] Resposta registrada:', responseKey);
  }

  /**
   * Verificar e bloquear batch para processamento
   */
  canProcessBatch(batchId: string): boolean {
    if (this.activeBatches.has(batchId)) {
      console.log('🔒 [CONTROLLER] Batch já está sendo processado:', batchId);
      return false;
    }
    
    this.activeBatches.add(batchId);
    console.log('✅ [CONTROLLER] Batch bloqueado para processamento:', batchId);
    return true;
  }

  /**
   * Liberar batch após processamento
   */
  releaseBatch(batchId: string): void {
    this.activeBatches.delete(batchId);
    console.log('🔓 [CONTROLLER] Batch liberado:', batchId);
  }

  /**
   * Limpar processados antigos (executar periodicamente)
   */
  cleanupOldProcessed(): void {
    const currentTime = Date.now();
    
    // Limpar mensagens processadas antigas
    if (this.processedMessages.size > 1000) {
      const entries = Array.from(this.processedMessages);
      const toKeep = entries.slice(-500); // Manter últimos 500
      this.processedMessages.clear();
      toKeep.forEach(entry => this.processedMessages.add(entry));
      console.log('🧹 [CONTROLLER] Limpeza de mensagens processadas executada');
    }
    
    // Limpar respostas antigas (mais de 1 hora)
    for (const [key, response] of this.recentResponses.entries()) {
      if ((currentTime - response.timestamp) > 3600000) { // 1 hora
        this.recentResponses.delete(key);
      }
    }
    
    console.log('🧹 [CONTROLLER] Limpeza completa executada');
  }

  /**
   * Status do controlador
   */
  getStatus(): {
    activeLocks: number;
    processedMessages: number;
    recentResponses: number;
    activeBatches: number;
  } {
    return {
      activeLocks: this.globalLocks.size,
      processedMessages: this.processedMessages.size,
      recentResponses: this.recentResponses.size,
      activeBatches: this.activeBatches.size
    };
  }
}

// Export singleton
export const messageProcessingController = MessageProcessingController.getInstance();