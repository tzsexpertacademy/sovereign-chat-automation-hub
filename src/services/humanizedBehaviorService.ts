/**
 * Serviço de Comportamento Humanizado
 * Implementa simulação de typing, presença e delays naturais usando CodeChat v2.2.1
 */

import unifiedYumerService from './unifiedYumerService';

export interface HumanizedConfig {
  enabled: boolean;
  typingSpeedWPM: number;
  minDelay: number;
  maxDelay: number;
  maxChunkSize: number;
  chunkDelay: number;
}

const DEFAULT_CONFIG: HumanizedConfig = {
  enabled: true,
  typingSpeedWPM: 45,
  minDelay: 2000,
  maxDelay: 5000,
  maxChunkSize: 350,
  chunkDelay: 2500
};

export class HumanizedBehaviorService {
  private config: HumanizedConfig = DEFAULT_CONFIG;
  private activeProcessing = new Map<string, NodeJS.Timeout>();
  
  // Configurar comportamento humanizado
  setConfig(newConfig: Partial<HumanizedConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🎭 [HUMANIZED] Configuração atualizada:', this.config);
  }

  // Calcular delay baseado no tamanho do texto
  private calculateTypingDelay(text: string): number {
    const words = text.split(' ').length;
    const baseTime = (words / this.config.typingSpeedWPM) * 60 * 1000; // Converter para ms
    const randomFactor = 0.3; // 30% de variação
    const variation = baseTime * randomFactor * (Math.random() - 0.5) * 2;
    
    return Math.max(
      this.config.minDelay,
      Math.min(this.config.maxDelay, baseTime + variation)
    );
  }

  // Dividir mensagem em chunks naturais
  private splitMessage(text: string): string[] {
    if (text.length <= this.config.maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 1 <= this.config.maxChunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        
        // Se a frase é muito longa, quebrar por palavras
        if (sentence.length > this.config.maxChunkSize) {
          const words = sentence.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            if (wordChunk.length + word.length + 1 <= this.config.maxChunkSize) {
              wordChunk += (wordChunk ? ' ' : '') + word;
            } else {
              if (wordChunk) {
                chunks.push(wordChunk.trim());
              }
              wordChunk = word;
            }
          }
          
          if (wordChunk) {
            currentChunk = wordChunk;
          } else {
            currentChunk = '';
          }
        } else {
          currentChunk = sentence;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  // Simular presença online
  async setOnline(instanceId: string, chatId: string): Promise<void> {
    try {
      await unifiedYumerService.setPresence(instanceId, chatId, 'available');
      console.log(`🟢 [HUMANIZED] Definido como online: ${chatId}`);
    } catch (error) {
      console.warn('⚠️ [HUMANIZED] Erro ao definir presença online:', error);
    }
  }

  // Simular typing indicator
  async simulateTyping(instanceId: string, chatId: string, duration: number): Promise<void> {
    try {
      // Iniciar typing
      await unifiedYumerService.setTyping(instanceId, chatId, true);
      console.log(`⌨️ [HUMANIZED] Iniciando typing por ${duration}ms: ${chatId}`);
      
      // Aguardar duração
      await new Promise(resolve => setTimeout(resolve, duration));
      
      // Parar typing
      await unifiedYumerService.setTyping(instanceId, chatId, false);
      console.log(`⌨️ [HUMANIZED] Parando typing: ${chatId}`);
    } catch (error) {
      console.warn('⚠️ [HUMANIZED] Erro ao simular typing:', error);
      // Tentar parar typing mesmo com erro
      try {
        await unifiedYumerService.setTyping(instanceId, chatId, false);
      } catch (stopError) {
        console.warn('⚠️ [HUMANIZED] Erro ao parar typing:', stopError);
      }
    }
  }

  // Cancelar processamento ativo
  cancelProcessing(chatId: string): void {
    const timeoutId = this.activeProcessing.get(chatId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeProcessing.delete(chatId);
      console.log(`❌ [HUMANIZED] Processamento cancelado: ${chatId}`);
    }
  }

  // Enviar mensagem com comportamento humanizado completo
  async sendHumanizedMessage(
    instanceId: string, 
    chatId: string, 
    message: string,
    onCancel?: () => boolean
  ): Promise<{ success: boolean; chunks: number; error?: string }> {
    
    if (!this.config.enabled) {
      // Se humanização desabilitada, enviar direto
      try {
        const result = await unifiedYumerService.sendTextMessage(instanceId, chatId, message);
        return { success: result.success, chunks: 1, error: result.error };
      } catch (error) {
        return { 
          success: false, 
          chunks: 0, 
          error: error instanceof Error ? error.message : 'Erro desconhecido' 
        };
      }
    }

    try {
      // 1. Definir como online
      await this.setOnline(instanceId, chatId);

      // 2. Dividir mensagem em chunks
      const chunks = this.splitMessage(message);
      console.log(`📝 [HUMANIZED] Enviando ${chunks.length} chunks para ${chatId}:`);

      // 3. Enviar cada chunk com comportamento humanizado
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Verificar cancelamento
        if (onCancel && onCancel()) {
          console.log(`❌ [HUMANIZED] Envio cancelado pelo usuário: ${chatId}`);
          return { success: false, chunks: i, error: 'Cancelado pelo usuário' };
        }

        // Calcular delay de typing
        const typingDuration = this.calculateTypingDelay(chunk);
        
        console.log(`📤 [HUMANIZED] Chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 50)}..." (typing: ${typingDuration}ms)`);

        // Simular typing
        await this.simulateTyping(instanceId, chatId, typingDuration);
        
        // Verificar cancelamento após typing
        if (onCancel && onCancel()) {
          console.log(`❌ [HUMANIZED] Envio cancelado após typing: ${chatId}`);
          return { success: false, chunks: i, error: 'Cancelado após typing' };
        }

        // Enviar chunk
        const result = await unifiedYumerService.sendTextMessage(instanceId, chatId, chunk);
        
        if (!result.success) {
          console.error(`❌ [HUMANIZED] Erro ao enviar chunk ${i + 1}:`, result.error);
          return { success: false, chunks: i, error: result.error };
        }

        // Delay entre chunks (exceto no último)
        if (i < chunks.length - 1) {
          const chunkDelay = this.config.chunkDelay + (Math.random() - 0.5) * 1000; // ±500ms de variação
          console.log(`⏳ [HUMANIZED] Aguardando ${chunkDelay}ms antes do próximo chunk...`);
          await new Promise(resolve => setTimeout(resolve, chunkDelay));
        }
      }

      console.log(`✅ [HUMANIZED] Mensagem completa enviada: ${chunks.length} chunks`);
      return { success: true, chunks: chunks.length };

    } catch (error) {
      console.error('❌ [HUMANIZED] Erro no envio humanizado:', error);
      return { 
        success: false, 
        chunks: 0, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  // Marcar mensagem como lida com delay natural
  async markAsReadWithDelay(instanceId: string, messageId: string, chatId: string): Promise<void> {
    try {
      // Delay natural para ler a mensagem (1-3 segundos)
      const readDelay = 1000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, readDelay));
      
      await unifiedYumerService.markAsRead(instanceId, messageId, chatId);
      console.log(`✅ [HUMANIZED] Mensagem marcada como lida após ${readDelay}ms: ${messageId}`);
    } catch (error) {
      console.warn('⚠️ [HUMANIZED] Erro ao marcar como lida:', error);
    }
  }

  // Processar com delay de 3 segundos (cancelável)
  async processWithDelay(
    chatId: string,
    processingFunction: () => Promise<void>,
    delay: number = 3000
  ): Promise<boolean> {
    
    // Cancelar processamento anterior se existir
    this.cancelProcessing(chatId);

    return new Promise((resolve) => {
      console.log(`⏳ [HUMANIZED] Iniciando delay de ${delay}ms para ${chatId}`);
      
      const timeoutId = setTimeout(async () => {
        this.activeProcessing.delete(chatId);
        
        try {
          await processingFunction();
          console.log(`✅ [HUMANIZED] Processamento concluído para ${chatId}`);
          resolve(true);
        } catch (error) {
          console.error(`❌ [HUMANIZED] Erro no processamento para ${chatId}:`, error);
          resolve(false);
        }
      }, delay);

      this.activeProcessing.set(chatId, timeoutId);
    });
  }

  // Status do serviço
  getStatus(): {
    enabled: boolean;
    config: HumanizedConfig;
    activeChats: string[];
  } {
    return {
      enabled: this.config.enabled,
      config: this.config,
      activeChats: Array.from(this.activeProcessing.keys())
    };
  }
}

// Export singleton
export const humanizedBehaviorService = new HumanizedBehaviorService();