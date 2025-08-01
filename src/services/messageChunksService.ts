/**
 * SERVIÇO DE MENSAGENS EM BLOCOS - TOTALMENTE INTEGRADO
 * 
 * Sistema unificado que usa:
 * - Configurações do assistente no banco
 * - unifiedMessageService para envios
 * - Typing indicators realistas
 * - Logs detalhados para debug
 */

import { supabase } from "@/integrations/supabase/client";
import { unifiedMessageService, type UnifiedMessageOptions, type UnifiedMessageResult } from "./unifiedMessageService";
import { smartLogs } from "./smartLogsService";

export interface ChunkConfig {
  enabled: boolean;
  maxCharsPerChunk: number;
  delayBetweenChunks: number;
  typingEnabled: boolean;
  minTypingDuration: number;
  maxTypingDuration: number;
}

export interface ChunkedMessageOptions {
  instanceId: string;
  chatId: string;
  message: string;
  clientId?: string;
  assistantId?: string;
  source?: 'manual' | 'ai' | 'automation';
  onProgress?: (sent: number, total: number) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export interface ChunkedMessageResult {
  success: boolean;
  totalChunks: number;
  sentChunks: number;
  messageIds: string[];
  errors: string[];
  timestamp: number;
}

class MessageChunksService {
  private activeProcesses: Map<string, boolean> = new Map();

  /**
   * MÉTODO PRINCIPAL - ENVIO COM CONFIGURAÇÕES DINÂMICAS
   */
  async sendMessageInChunks(options: ChunkedMessageOptions): Promise<ChunkedMessageResult> {
    const processKey = `${options.chatId}_${Date.now()}`;
    
    try {
      this.activeProcesses.set(processKey, true);
      
      smartLogs.info('MESSAGE', 'Iniciando envio em blocos', {
        chatId: options.chatId,
        messageLength: options.message.length,
        assistantId: options.assistantId,
        source: options.source
      });

      // 1. CARREGAR CONFIGURAÇÕES DO ASSISTENTE
      const config = await this.loadChunkConfig(options.assistantId);
      smartLogs.info('MESSAGE', 'Configurações carregadas', config);

      // 2. VERIFICAR SE DEVE DIVIDIR MENSAGEM
      if (!config.enabled || options.message.length <= config.maxCharsPerChunk) {
        smartLogs.info('MESSAGE', 'Mensagem curta - enviando direto');
        
        const result = await unifiedMessageService.sendMessage({
          instanceId: options.instanceId,
          chatId: options.chatId,
          message: options.message,
          clientId: options.clientId,
          source: options.source || 'manual'
        });

        return {
          success: result.success,
          totalChunks: 1,
          sentChunks: result.success ? 1 : 0,
          messageIds: result.messageId ? [result.messageId] : [],
          errors: result.error ? [result.error] : [],
          timestamp: Date.now()
        };
      }

      // 3. DIVIDIR MENSAGEM EM BLOCOS
      const chunks = this.splitMessage(options.message, config.maxCharsPerChunk);
      smartLogs.info('MESSAGE', `Mensagem dividida em ${chunks.length} blocos`);

      // 4. ENVIAR CADA BLOCO COM DELAYS E TYPING
      const results: UnifiedMessageResult[] = [];
      const messageIds: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        if (!this.activeProcesses.get(processKey)) {
          smartLogs.warn('MESSAGE', 'Processo cancelado');
          break;
        }

        const chunk = chunks[i];
        smartLogs.info('MESSAGE', `Enviando bloco ${i + 1}/${chunks.length}`, {
          chunkLength: chunk.length,
          chunkPreview: chunk.substring(0, 50)
        });

        // SIMULAR TYPING
        if (config.typingEnabled && i < chunks.length - 1) {
          options.onTypingStart?.();
          const typingDuration = this.calculateTypingDuration(chunk, config);
          smartLogs.info('MESSAGE', `Simulando digitação por ${typingDuration}ms`);
          await this.delay(typingDuration);
          options.onTypingStop?.();
        }

        // ENVIAR BLOCO
        const result = await unifiedMessageService.sendMessage({
          instanceId: options.instanceId,
          chatId: options.chatId,
          message: chunk,
          clientId: options.clientId,
          source: options.source || 'ai',
          humanized: true,
          delay: 0 // Delay já controlado aqui
        });

        results.push(result);

        if (result.success && result.messageId) {
          messageIds.push(result.messageId);
        } else if (result.error) {
          errors.push(result.error);
        }

        // CALLBACK DE PROGRESSO
        options.onProgress?.(i + 1, chunks.length);

        // DELAY ENTRE BLOCOS (exceto no último)
        if (i < chunks.length - 1 && this.activeProcesses.get(processKey)) {
          const delayVariation = Math.random() * 500 - 250; // ±250ms de variação
          const finalDelay = Math.max(500, config.delayBetweenChunks + delayVariation);
          
          smartLogs.info('MESSAGE', `Aguardando ${finalDelay}ms antes do próximo bloco`);
          await this.delay(finalDelay);
        }
      }

      // 5. RESULTADO FINAL
      const totalSent = results.filter(r => r.success).length;
      const finalResult: ChunkedMessageResult = {
        success: totalSent > 0,
        totalChunks: chunks.length,
        sentChunks: totalSent,
        messageIds,
        errors,
        timestamp: Date.now()
      };

      smartLogs.info('MESSAGE', 'Envio em blocos concluído', {
        totalChunks: finalResult.totalChunks,
        sentChunks: finalResult.sentChunks,
        success: finalResult.success
      });

      return finalResult;

    } catch (error: any) {
      smartLogs.error('MESSAGE', 'Erro crítico no envio em blocos', { error: error.message });
      
      return {
        success: false,
        totalChunks: 0,
        sentChunks: 0,
        messageIds: [],
        errors: [error.message || 'Erro desconhecido'],
        timestamp: Date.now()
      };
    } finally {
      this.activeProcesses.delete(processKey);
    }
  }

  /**
   * CARREGAR CONFIGURAÇÕES DO ASSISTENTE
   */
  private async loadChunkConfig(assistantId?: string): Promise<ChunkConfig> {
    const defaultConfig: ChunkConfig = {
      enabled: true,
      maxCharsPerChunk: 350,
      delayBetweenChunks: 2500,
      typingEnabled: true,
      minTypingDuration: 1000,
      maxTypingDuration: 3000
    };

    if (!assistantId) {
      return defaultConfig;
    }

    try {
      const { data: assistant, error } = await supabase
        .from('assistants')
        .select('advanced_settings')
        .eq('id', assistantId)
        .single();

      if (error || !assistant?.advanced_settings) {
        return defaultConfig;
      }

      const settings = typeof assistant.advanced_settings === 'string' 
        ? JSON.parse(assistant.advanced_settings)
        : assistant.advanced_settings;

      return {
        enabled: settings.messageHandling?.splitLongMessages ?? defaultConfig.enabled,
        maxCharsPerChunk: settings.messageHandling?.maxCharsPerChunk ?? defaultConfig.maxCharsPerChunk,
        delayBetweenChunks: settings.messageHandling?.delayBetweenChunks ?? defaultConfig.delayBetweenChunks,
        typingEnabled: settings.typing?.enabled ?? defaultConfig.typingEnabled,
        minTypingDuration: settings.typing?.minDuration ?? defaultConfig.minTypingDuration,
        maxTypingDuration: settings.typing?.maxDuration ?? defaultConfig.maxTypingDuration
      };

    } catch (error) {
      smartLogs.error('MESSAGE', 'Erro ao carregar configurações', { assistantId, error });
      return defaultConfig;
    }
  }

  /**
   * DIVIDIR MENSAGEM RESPEITANDO PONTUAÇÃO
   */
  private splitMessage(message: string, maxChars: number): string[] {
    if (message.length <= maxChars) {
      return [message];
    }

    // Dividir por frases primeiro
    const sentences = message.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      // Se a frase sozinha é maior que o limite, dividir por palavras
      if (sentence.length > maxChars) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // Dividir frase longa por palavras
        const words = sentence.split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          if ((wordChunk + ' ' + word).length > maxChars) {
            if (wordChunk) {
              chunks.push(wordChunk.trim());
              wordChunk = word;
            } else {
              // Palavra muito longa, forçar quebra
              chunks.push(word);
            }
          } else {
            wordChunk = wordChunk ? wordChunk + ' ' + word : word;
          }
        }
        
        if (wordChunk) {
          currentChunk = wordChunk;
        }
      } else {
        // Verificar se cabe no chunk atual
        if ((currentChunk + ' ' + sentence).length > maxChars) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * CALCULAR DURAÇÃO DE DIGITAÇÃO REALISTA
   */
  private calculateTypingDuration(text: string, config: ChunkConfig): number {
    // Base: 40 WPM (palavras por minuto) = ~200 caracteres por minuto
    const baseWPM = 40;
    const charsPerMinute = baseWPM * 5; // ~5 chars por palavra
    const charsPerSecond = charsPerMinute / 60;
    
    // Tempo base calculado
    const baseTime = (text.length / charsPerSecond) * 1000;
    
    // Adicionar variação humana (±30%)
    const variation = 0.3;
    const minTime = baseTime * (1 - variation);
    const maxTime = baseTime * (1 + variation);
    
    // Aplicar limites das configurações
    const finalTime = Math.max(
      config.minTypingDuration,
      Math.min(config.maxTypingDuration, Math.random() * (maxTime - minTime) + minTime)
    );
    
    return Math.round(finalTime);
  }

  /**
   * DELAY COM PROMISE
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * CANCELAR PROCESSO ATIVO
   */
  cancelProcess(chatId: string): void {
    for (const [key] of this.activeProcesses) {
      if (key.includes(chatId)) {
        this.activeProcesses.set(key, false);
        smartLogs.info('MESSAGE', 'Processo cancelado', { chatId, processKey: key });
      }
    }
  }

  /**
   * MÉTODO DE CONVENIÊNCIA PARA IA
   */
  async sendAIMessageInChunks(
    instanceId: string, 
    chatId: string, 
    message: string, 
    clientId?: string, 
    assistantId?: string,
    callbacks?: {
      onProgress?: (sent: number, total: number) => void;
      onTypingStart?: () => void;
      onTypingStop?: () => void;
    }
  ): Promise<ChunkedMessageResult> {
    return this.sendMessageInChunks({
      instanceId,
      chatId,
      message,
      clientId,
      assistantId,
      source: 'ai',
      ...callbacks
    });
  }
}

export const messageChunksService = new MessageChunksService();