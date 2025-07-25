// Simulação de serviços (será implementado depois)
const mockClientService = {
  setTypingStatus: async () => true,
  setRecordingStatus: async () => true,
  setOnlineStatus: async () => true,
  markAsRead: async () => true
};

interface HumanizedConfig {
  typingWPM: number;
  minDelay: number;
  maxDelay: number;
  baseDelay: number;
  showTyping: boolean;
  showRecording: boolean;
  showOnline: boolean;
  cancelOnNewMessage: boolean;
  variationFactor: number;
}

interface DelayConfig {
  typingTime: number;
  beforeSend: number;
  afterSend: number;
}

const defaultConfig: HumanizedConfig = {
  typingWPM: 45,
  minDelay: 1500,
  maxDelay: 8000,
  baseDelay: 3000,
  showTyping: true,
  showRecording: true,
  showOnline: true,
  cancelOnNewMessage: true,
  variationFactor: 0.3
};

class HumanizedBehaviorService {
  private config: HumanizedConfig = defaultConfig;
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private isProcessing: Map<string, boolean> = new Map();
  private ongoingOperations: Map<string, 'typing' | 'recording' | 'online'> = new Map();

  constructor() {
    console.log('🤖 HumanizedBehaviorService inicializado');
  }

  updateConfig(newConfig: Partial<HumanizedConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Configuração humanizada atualizada:', this.config);
  }

  /**
   * Calcula tempo de digitação baseado no conteúdo
   */
  calculateTypingTime(text: string): number {
    const words = text.trim().split(/\s+/).length;
    const baseTime = (words / this.config.typingWPM) * 60 * 1000;
    
    // Adicionar variação natural
    const variation = 1 + (Math.random() - 0.5) * this.config.variationFactor;
    
    // Fator de complexidade para textos longos
    const complexityFactor = text.length > 200 ? 1.3 : 
                            text.length > 100 ? 1.15 : 1.0;
    
    const finalTime = Math.max(
      this.config.minDelay,
      Math.min(this.config.maxDelay, baseTime * variation * complexityFactor)
    );

    console.log(`⌨️ Tempo calculado: ${finalTime}ms para ${words} palavras (${text.length} chars)`);
    return finalTime;
  }

  /**
   * Calcula tempo de gravação de áudio baseado na duração
   */
  calculateRecordingTime(audioDuration: number): number {
    // Simular tempo de "gravação" (processar + gravar)
    const processingTime = audioDuration * 1000 * 1.5; // 1.5x a duração do áudio
    const variation = 1 + (Math.random() - 0.5) * 0.2; // 20% de variação
    
    const finalTime = Math.max(
      this.config.minDelay,
      Math.min(this.config.maxDelay, processingTime * variation)
    );

    console.log(`🎤 Tempo de gravação calculado: ${finalTime}ms para ${audioDuration}s de áudio`);
    return finalTime;
  }

  /**
   * Divide mensagem longa em blocos naturais
   */
  splitMessage(text: string, maxLength: number = 350): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const blocks: string[] = [];
    let currentBlock = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      const potentialBlock = currentBlock 
        ? `${currentBlock}. ${trimmedSentence}`
        : trimmedSentence;

      if (potentialBlock.length <= maxLength) {
        currentBlock = potentialBlock;
      } else {
        if (currentBlock) {
          blocks.push(currentBlock + '.');
          currentBlock = trimmedSentence;
        } else {
          // Sentença muito longa, dividir por espaços
          const words = trimmedSentence.split(' ');
          let wordBlock = '';
          
          for (const word of words) {
            if ((wordBlock + ' ' + word).length <= maxLength) {
              wordBlock = wordBlock ? `${wordBlock} ${word}` : word;
            } else {
              if (wordBlock) {
                blocks.push(wordBlock);
                wordBlock = word;
              } else {
                blocks.push(word); // Palavra muito longa
              }
            }
          }
          
          if (wordBlock) {
            currentBlock = wordBlock;
          }
        }
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock + (currentBlock.endsWith('.') ? '' : '.'));
    }

    console.log(`📝 Mensagem dividida em ${blocks.length} blocos:`, blocks.map(b => b.substring(0, 30) + '...'));
    return blocks;
  }

  /**
   * Simula comportamento humano de digitação
   */
  async simulateTyping(chatId: string, instanceId: string): Promise<boolean> {
    if (!this.config.showTyping) return true;

    try {
      console.log(`⌨️ Iniciando simulação de digitação para ${chatId}`);
      this.ongoingOperations.set(chatId, 'typing');

      const success = await mockClientService.setTypingStatus();
      
      if (success) {
        console.log(`✅ Status de digitação ativado para ${chatId}`);
        return true;
      } else {
        console.log(`❌ Falha ao ativar digitação para ${chatId}`);
        this.ongoingOperations.delete(chatId);
        return false;
      }
    } catch (error) {
      console.error(`❌ Erro na simulação de digitação ${chatId}:`, error);
      this.ongoingOperations.delete(chatId);
      return false;
    }
  }

  /**
   * Para simulação de digitação
   */
  async stopTyping(chatId: string, instanceId: string): Promise<void> {
    if (!this.config.showTyping) return;

    try {
      console.log(`⌨️ Parando simulação de digitação para ${chatId}`);
      
      await mockClientService.setTypingStatus();
      this.ongoingOperations.delete(chatId);
      
      console.log(`✅ Digitação parada para ${chatId}`);
    } catch (error) {
      console.error(`❌ Erro ao parar digitação ${chatId}:`, error);
    }
  }

  /**
   * Simula comportamento humano de gravação
   */
  async simulateRecording(chatId: string, instanceId: string): Promise<boolean> {
    if (!this.config.showRecording) return true;

    try {
      console.log(`🎤 Iniciando simulação de gravação para ${chatId}`);
      this.ongoingOperations.set(chatId, 'recording');

      const success = await mockClientService.setRecordingStatus();
      
      if (success) {
        console.log(`✅ Status de gravação ativado para ${chatId}`);
        return true;
      } else {
        console.log(`❌ Falha ao ativar gravação para ${chatId}`);
        this.ongoingOperations.delete(chatId);
        return false;
      }
    } catch (error) {
      console.error(`❌ Erro na simulação de gravação ${chatId}:`, error);
      this.ongoingOperations.delete(chatId);
      return false;
    }
  }

  /**
   * Para simulação de gravação
   */
  async stopRecording(chatId: string, instanceId: string): Promise<void> {
    if (!this.config.showRecording) return;

    try {
      console.log(`🎤 Parando simulação de gravação para ${chatId}`);
      
      await mockClientService.setRecordingStatus();
      this.ongoingOperations.delete(chatId);
      
      console.log(`✅ Gravação parada para ${chatId}`);
    } catch (error) {
      console.error(`❌ Erro ao parar gravação ${chatId}:`, error);
    }
  }

  /**
   * Define status online
   */
  async setOnlineStatus(instanceId: string, online: boolean = true): Promise<void> {
    if (!this.config.showOnline) return;

    try {
      console.log(`📱 Definindo status online: ${online}`);
      
      await mockClientService.setOnlineStatus();
      
      console.log(`✅ Status online definido: ${online}`);
    } catch (error) {
      console.error(`❌ Erro ao definir status online:`, error);
    }
  }

  /**
   * Marca mensagem como lida
   */
  async markAsRead(chatId: string, instanceId: string, messageId?: string): Promise<void> {
    try {
      console.log(`✓✓ Marcando mensagem como lida para ${chatId}`);
      
      await mockClientService.markAsRead();
      
      console.log(`✅ Mensagem marcada como lida para ${chatId}`);
    } catch (error) {
      console.error(`❌ Erro ao marcar como lida ${chatId}:`, error);
    }
  }

  /**
   * Processo completo humanizado para texto
   */
  async processTextWithHumanBehavior(
    chatId: string,
    instanceId: string,
    text: string,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<DelayConfig> {
    const typingTime = this.calculateTypingTime(text);
    
    // Cancelar operações anteriores se necessário
    this.cancelOperation(chatId);
    
    const delays: DelayConfig = {
      typingTime,
      beforeSend: Math.random() * 1000 + 500, // 0.5-1.5s antes de enviar
      afterSend: Math.random() * 500 + 200    // 0.2-0.7s depois de enviar
    };

    console.log(`🤖 Processamento humanizado iniciado para ${chatId}:`, delays);

    // Marcar como processando
    this.isProcessing.set(chatId, true);

    try {
      // 1. Marcar como lido (se não for nossa mensagem)
      await this.markAsRead(chatId, instanceId);
      onProgress?.('reading', 10);

      // 2. Delay inicial
      await new Promise(resolve => setTimeout(resolve, this.config.baseDelay));
      onProgress?.('thinking', 30);

      // 3. Simular digitação
      await this.simulateTyping(chatId, instanceId);
      onProgress?.('typing', 50);

      // 4. Aguardar tempo de digitação
      await new Promise(resolve => setTimeout(resolve, typingTime));
      onProgress?.('finishing', 90);

      // 5. Parar digitação
      await this.stopTyping(chatId, instanceId);
      onProgress?.('ready', 100);

      return delays;

    } catch (error) {
      console.error(`❌ Erro no processamento humanizado ${chatId}:`, error);
      await this.stopTyping(chatId, instanceId);
      throw error;
    } finally {
      this.isProcessing.delete(chatId);
    }
  }

  /**
   * Processo completo humanizado para áudio
   */
  async processAudioWithHumanBehavior(
    chatId: string,
    instanceId: string,
    audioDuration: number,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<DelayConfig> {
    const recordingTime = this.calculateRecordingTime(audioDuration);
    
    // Cancelar operações anteriores
    this.cancelOperation(chatId);
    
    const delays: DelayConfig = {
      typingTime: recordingTime,
      beforeSend: Math.random() * 1000 + 500,
      afterSend: Math.random() * 500 + 200
    };

    console.log(`🎤 Processamento de áudio humanizado iniciado para ${chatId}:`, delays);

    this.isProcessing.set(chatId, true);

    try {
      // 1. Marcar como lido
      await this.markAsRead(chatId, instanceId);
      onProgress?.('reading', 10);

      // 2. Delay inicial
      await new Promise(resolve => setTimeout(resolve, this.config.baseDelay));
      onProgress?.('processing', 30);

      // 3. Simular gravação
      await this.simulateRecording(chatId, instanceId);
      onProgress?.('recording', 50);

      // 4. Aguardar tempo de gravação
      await new Promise(resolve => setTimeout(resolve, recordingTime));
      onProgress?.('finishing', 90);

      // 5. Parar gravação
      await this.stopRecording(chatId, instanceId);
      onProgress?.('ready', 100);

      return delays;

    } catch (error) {
      console.error(`❌ Erro no processamento de áudio humanizado ${chatId}:`, error);
      await this.stopRecording(chatId, instanceId);
      throw error;
    } finally {
      this.isProcessing.delete(chatId);
    }
  }

  /**
   * Cancela operação em andamento
   */
  cancelOperation(chatId: string): void {
    const timer = this.activeTimers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(chatId);
      console.log(`⏹️ Operação cancelada para ${chatId}`);
    }

    this.isProcessing.delete(chatId);
    this.ongoingOperations.delete(chatId);
  }

  /**
   * Verifica se está processando
   */
  isCurrentlyProcessing(chatId: string): boolean {
    return this.isProcessing.get(chatId) || false;
  }

  /**
   * Obtém status atual
   */
  getCurrentOperation(chatId: string): 'typing' | 'recording' | 'online' | null {
    return this.ongoingOperations.get(chatId) || null;
  }

  /**
   * Limpa todos os timers e operações
   */
  cleanup(): void {
    console.log('🧹 Limpando HumanizedBehaviorService');
    
    this.activeTimers.forEach(timer => clearTimeout(timer));
    this.activeTimers.clear();
    this.isProcessing.clear();
    this.ongoingOperations.clear();
  }
}

export const humanizedBehaviorService = new HumanizedBehaviorService();
export type { HumanizedConfig, DelayConfig };