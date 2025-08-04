/**
 * Controlador de processamento de mensagens
 * Gerencia locks de chat e prevenção de duplicação
 */

class MessageProcessingController {
  private static instance: MessageProcessingController;
  private chatLocks: Set<string> = new Set();
  private chatLockTimestamps: Map<string, number> = new Map();
  private processedMessages: Set<string> = new Set();
  private recentResponses: Map<string, { content: string; timestamp: number }> = new Map();
  private activeBatches: Set<string> = new Set();
  private readonly LOCK_TIMEOUT = 10000; // 10 segundos
  private readonly RESPONSE_CACHE_TIMEOUT = 30000; // 30 segundos para evitar duplicação
  private readonly MAX_PROCESSED_MESSAGES = 10000;

  private constructor() {}

  static getInstance(): MessageProcessingController {
    if (!MessageProcessingController.instance) {
      MessageProcessingController.instance = new MessageProcessingController();
    }
    return MessageProcessingController.instance;
  }

  /**
   * Verifica se uma mensagem pode ser processada
   */
  canProcessMessage(messageId: string, chatId: string): boolean {
    // Verificar se mensagem já foi processada
    if (this.isMessageProcessed(messageId)) {
      console.log('🔒 [CONTROLLER] Mensagem já processada:', messageId);
      return false;
    }

    // Verificar se chat está bloqueado
    if (this.isChatLocked(chatId)) {
      console.log('🔒 [CONTROLLER] Chat bloqueado:', chatId);
      return false;
    }

    return true;
  }

  /**
   * Verifica se pode processar com timestamp
   */
  canProcessMessageWithTimestamp(messageId: string, chatId: string, timestamp?: number): boolean {
    if (!this.canProcessMessage(messageId, chatId)) {
      return false;
    }

    // Verificar timestamp específico do chat se fornecido
    if (timestamp) {
      const chatTimestamp = this.chatLockTimestamps.get(chatId);
      if (chatTimestamp && (Date.now() - chatTimestamp) < this.LOCK_TIMEOUT) {
        console.log('🔒 [CONTROLLER] Chat bloqueado por timestamp:', chatId);
        return false;
      }
    }

    return true;
  }

  /**
   * Bloquear chat
   */
  lockChat(chatId: string): void {
    this.chatLocks.add(chatId);
    this.chatLockTimestamps.set(chatId, Date.now());
    console.log('🔒 [CONTROLLER] Chat bloqueado:', chatId);
  }

  /**
   * Bloquear chat com timestamp específico (compatibilidade)
   */
  lockChatWithTimestamp(chatId: string, timestamp?: number): void {
    this.chatLocks.add(chatId);
    this.chatLockTimestamps.set(chatId, timestamp || Date.now());
    console.log('🔒 [CONTROLLER] Chat bloqueado com timestamp:', chatId);
  }

  /**
   * Desbloquear chat
   */
  unlockChat(chatId: string): void {
    this.chatLocks.delete(chatId);
    this.chatLockTimestamps.delete(chatId);
    console.log('🔓 [CONTROLLER] Chat desbloqueado:', chatId);
  }

  /**
   * Marcar mensagem como processada
   */
  markMessageProcessed(messageId: string): void {
    this.processedMessages.add(messageId);
    
    // Limpar mensagens antigas se necessário
    if (this.processedMessages.size > this.MAX_PROCESSED_MESSAGES) {
      this.cleanupOldProcessed();
    }
    
    console.log('✅ [CONTROLLER] Mensagem marcada como processada:', messageId);
  }

  /**
   * Marcar múltiplas mensagens como processadas (compatibilidade)
   */
  markMessagesProcessed(messageIds: string[]): void {
    messageIds.forEach(messageId => {
      this.markMessageProcessed(messageId);
    });
    console.log('✅ [CONTROLLER] Múltiplas mensagens marcadas como processadas:', messageIds.length);
  }

  /**
   * Verificar se mensagem foi processada
   */
  isMessageProcessed(messageId: string): boolean {
    return this.processedMessages.has(messageId);
  }

  /**
   * Verificar se chat está bloqueado
   */
  isChatLocked(chatId: string): boolean {
    // Verificar timestamp para expirar locks antigos
    const timestamp = this.chatLockTimestamps.get(chatId);
    if (timestamp && (Date.now() - timestamp) > this.LOCK_TIMEOUT) {
      this.unlockChat(chatId);
      return false;
    }
    
    return this.chatLocks.has(chatId);
  }

  /**
   * Verificar resposta duplicada
   */
  isDuplicateResponse(chatId: string, content: string): boolean {
    const recent = this.recentResponses.get(chatId);
    if (recent && (Date.now() - recent.timestamp) < this.RESPONSE_CACHE_TIMEOUT) {
      // Verificar similaridade de conteúdo
      const similarity = this.calculateSimilarity(content, recent.content);
      if (similarity > 0.8) {
        console.log('🚫 [CONTROLLER] Resposta duplicada detectada:', chatId);
        return true;
      }
    }
    return false;
  }

  /**
   * Registrar resposta enviada
   */
  registerResponse(chatId: string, content: string): void {
    this.recentResponses.set(chatId, {
      content: content,
      timestamp: Date.now()
    });
    console.log('📝 [CONTROLLER] Resposta registrada:', chatId);
  }

  /**
   * Verificar se batch está ativo
   */
  isBatchActive(batchId: string): boolean {
    return this.activeBatches.has(batchId);
  }

  /**
   * Marcar batch como ativo
   */
  markBatchActive(batchId: string): void {
    this.activeBatches.add(batchId);
    console.log('🔄 [CONTROLLER] Batch marcado como ativo:', batchId);
  }

  /**
   * Marcar batch como concluído
   */
  markBatchCompleted(batchId: string): void {
    this.activeBatches.delete(batchId);
    console.log('✅ [CONTROLLER] Batch concluído:', batchId);
  }

  /**
   * Calcular similaridade entre dois textos
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1.0;
    
    const normalize = (str: string) => str.toLowerCase().trim();
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 1.0;
    
    // Verificar se um texto contém o outro
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return 0.9;
    }
    
    // Verificar palavras em comum
    const words1 = norm1.split(/\s+/);
    const words2 = norm2.split(/\s+/);
    const common = words1.filter(word => words2.includes(word));
    
    return common.length / Math.max(words1.length, words2.length);
  }

  /**
   * Limpar mensagens processadas antigas
   */
  cleanupOldProcessed(): void {
    const array = Array.from(this.processedMessages);
    const keep = array.slice(-Math.floor(this.MAX_PROCESSED_MESSAGES * 0.8));
    this.processedMessages = new Set(keep);
    console.log('🧹 [CONTROLLER] Limpeza realizada, mantendo', keep.length, 'mensagens');
  }

  /**
   * Limpar caches expirados
   */
  cleanupExpired(): void {
    const now = Date.now();
    
    // Limpar respostas antigas
    for (const [chatId, response] of this.recentResponses.entries()) {
      if (now - response.timestamp > this.RESPONSE_CACHE_TIMEOUT) {
        this.recentResponses.delete(chatId);
      }
    }
    
    // Limpar locks expirados
    for (const [chatId, timestamp] of this.chatLockTimestamps.entries()) {
      if (now - timestamp > this.LOCK_TIMEOUT) {
        this.unlockChat(chatId);
      }
    }
  }

  /**
   * Obter status do controlador
   */
  getStatus(): { activeLocks: number; processedMessages: number; recentResponses: number; activeBatches: number } {
    this.cleanupExpired();
    return {
      activeLocks: this.chatLocks.size,
      processedMessages: this.processedMessages.size,
      recentResponses: this.recentResponses.size,
      activeBatches: this.activeBatches.size
    };
  }
}

// Exportar singleton
export const messageProcessingController = MessageProcessingController.getInstance();