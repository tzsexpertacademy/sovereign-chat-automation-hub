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
  typingSpeed: number;
  humanizedDelays: boolean;
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
      
      smartLogs.info('MESSAGE', 'Configurações de blocos carregadas', {
        config,
        messageLength: options.message.length,
        shouldSplit: config.enabled && options.message.length > config.maxCharsPerChunk,
        assistantId: options.assistantId
      });

      // 2. VERIFICAR SE DEVE DIVIDIR MENSAGEM
      // CRITÉRIO: enabled=true E mensagem > maxCharsPerChunk
      const shouldSplit = config.enabled && options.message.length > config.maxCharsPerChunk;
      
      if (!shouldSplit) {
        smartLogs.info('MESSAGE', 'ENVIO DIRETO (não precisa dividir)', {
          enabled: config.enabled,
          messageLength: options.message.length,
          maxChars: config.maxCharsPerChunk,
          shouldSplit: false
        });
        
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

      // 3. APLICAR SISTEMA DE BLOCOS - MENSAGEM LONGA DETECTADA
      smartLogs.info('MESSAGE', '🔥 SISTEMA DE BLOCOS ATIVADO', {
        messageLength: options.message.length,
        maxCharsPerChunk: config.maxCharsPerChunk,
        assistantId: options.assistantId,
        messagePreview: options.message.substring(0, 100) + '...'
      });

      // 4. DIVIDIR MENSAGEM EM BLOCOS
      const chunks = this.splitMessage(options.message, config.maxCharsPerChunk);
      
      smartLogs.info('MESSAGE', `🧩 MENSAGEM DIVIDIDA EM ${chunks.length} BLOCOS`, {
        chunks: chunks.map((chunk, i) => ({
          index: i + 1,
          length: chunk.length,
          preview: chunk.substring(0, 50) + '...'
        }))
      });

      // 5. ENVIO COM TYPING CONTÍNUO - NOVA VERSÃO
      const results: UnifiedMessageResult[] = [];
      const messageIds: string[] = [];
      const errors: string[] = [];

      smartLogs.info('MESSAGE', '🚀 INICIANDO envio sequencial dos blocos', {
        totalChunks: chunks.length,
        delayBetweenChunks: config.delayBetweenChunks,
        typingEnabled: config.typingEnabled
      });

      // 🎯 TYPING CONTÍNUO: Iniciar uma única vez no primeiro bloco
      let typingStarted = false;
      if (config.typingEnabled && options.onTypingStart) {
        smartLogs.info('MESSAGE', '🔄 INICIANDO TYPING CONTÍNUO para toda a sequência');
        options.onTypingStart();
        typingStarted = true;
      }

      for (let i = 0; i < chunks.length; i++) {
        if (!this.activeProcesses.get(processKey)) {
          smartLogs.warn('MESSAGE', '❌ Processo cancelado pelo usuário');
          break;
        }

        const chunk = chunks[i];
        const chunkNumber = i + 1;
        const isLastChunk = i === chunks.length - 1;

        smartLogs.info('MESSAGE', `📤 ENVIANDO BLOCO ${chunkNumber}/${chunks.length}`, {
          chunkLength: chunk.length,
          chunkPreview: chunk.substring(0, 100) + '...',
          isLastChunk,
          typingContinuo: typingStarted
        });

        // SIMULAR DIGITAÇÃO para este bloco específico
        if (config.typingEnabled) {
          const typingDuration = this.calculateTypingDuration(chunk, config);
          smartLogs.info('MESSAGE', `⌨️ SIMULANDO digitação por ${typingDuration}ms (bloco ${chunkNumber})`, {
            chunkNumber,
            chunkLength: chunk.length,
            typingSpeed: config.typingSpeed
          });
          await this.delay(typingDuration);
        }

        // ENVIAR BLOCO
        smartLogs.info('MESSAGE', `🎯 DISPARANDO envio do bloco ${chunkNumber}`, {
          instanceId: options.instanceId,
          chatId: options.chatId,
          messageLength: chunk.length
        });

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
          smartLogs.info('MESSAGE', `✅ BLOCO ${chunkNumber} ENVIADO COM SUCESSO`, {
            messageId: result.messageId,
            timestamp: result.timestamp
          });
        } else if (result.error) {
          errors.push(result.error);
          smartLogs.error('MESSAGE', `❌ FALHA NO BLOCO ${chunkNumber}`, {
            error: result.error,
            chunkContent: chunk.substring(0, 100)
          });
        }

        // CALLBACK DE PROGRESSO
        if (options.onProgress) {
          smartLogs.info('MESSAGE', `📊 CALLBACK: Progress ${chunkNumber}/${chunks.length}`);
          options.onProgress(chunkNumber, chunks.length);
        }

        // DELAY ENTRE BLOCOS (exceto no último)
        if (!isLastChunk && this.activeProcesses.get(processKey)) {
          const baseDelay = config.delayBetweenChunks;
          const randomDelay = config.humanizedDelays ? Math.floor(Math.random() * 1000) : 0;
          const finalDelay = Math.max(500, baseDelay + randomDelay);
          
          smartLogs.info('MESSAGE', `⏱️ AGUARDANDO ${finalDelay}ms antes do bloco ${chunkNumber + 1}`, {
            baseDelay,
            randomDelay,
            finalDelay,
            nextChunk: chunkNumber + 1
          });
          
          await this.delay(finalDelay);
        }
      }

      // 🛑 TYPING CONTÍNUO: Parar apenas no final de toda a sequência
      if (typingStarted && config.typingEnabled && options.onTypingStop) {
        smartLogs.info('MESSAGE', '🛑 FINALIZANDO TYPING CONTÍNUO - sequência completa');
        options.onTypingStop();
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
      maxTypingDuration: 3000,
      typingSpeed: 50,
      humanizedDelays: true
    };

    smartLogs.info('MESSAGE', '🔧 CARREGAR CONFIGURAÇÕES DE BLOCOS', {
      assistantId,
      hasAssistant: !!assistantId,
      defaultConfig: {
        enabled: defaultConfig.enabled,
        maxCharsPerChunk: defaultConfig.maxCharsPerChunk,
        delayBetweenChunks: defaultConfig.delayBetweenChunks
      }
    });

    if (!assistantId) {
      smartLogs.warn('MESSAGE', '❌ SEM ASSISTANTID - USANDO CONFIGURAÇÃO PADRÃO', { defaultConfig });
      return defaultConfig;
    }

    try {
      smartLogs.info('MESSAGE', '🔍 BUSCANDO CONFIGURAÇÕES NO BANCO', { assistantId });
      
      const { data: assistant, error } = await supabase
        .from('assistants')
        .select('advanced_settings')
        .eq('id', assistantId)
        .single();

      if (error) {
        smartLogs.error('MESSAGE', '❌ ERRO AO BUSCAR ASSISTENTE', { assistantId, error });
        return defaultConfig;
      }

      if (!assistant?.advanced_settings) {
        smartLogs.warn('MESSAGE', '⚠️ ASSISTENTE SEM ADVANCED_SETTINGS', { assistantId, assistant });
        return defaultConfig;
      }

      smartLogs.info('MESSAGE', '✅ ADVANCED_SETTINGS ENCONTRADAS', {
        assistantId,
        advanced_settings: assistant.advanced_settings
      });

      const settings = typeof assistant.advanced_settings === 'string' 
        ? JSON.parse(assistant.advanced_settings)
        : assistant.advanced_settings;

      smartLogs.info('MESSAGE', '📋 SETTINGS PARSEADOS', {
        assistantId,
        settings,
        messageHandling: settings.messageHandling,
        typing: settings.typing
      });

      // MAPEAR CONFIGURAÇÕES - VERSÃO DEFINITIVA
      const enabled = settings.messageHandling?.splitLongMessages ?? true; // Default: SEMPRE ATIVO
      
      const maxCharsPerChunk = settings.messageHandling?.maxCharsPerChunk ?? 350;
      
      const delayBetweenChunks = settings.messageHandling?.delayBetweenChunks ?? 
                                (settings.response_delay_seconds ? settings.response_delay_seconds * 1000 : defaultConfig.delayBetweenChunks);
      
      const typingEnabled = settings.typing?.enabled ?? 
                           (settings.typing_indicator_enabled ?? defaultConfig.typingEnabled);

      smartLogs.info('MESSAGE', '⚙️ CONFIGURAÇÕES FINAIS MAPEADAS', {
        enabled: `${enabled} (fonte: ${settings.messageHandling?.splitLongMessages !== undefined ? 'messageHandling' : 'default'})`,
        maxCharsPerChunk: `${maxCharsPerChunk} (fonte: ${settings.messageHandling?.maxCharsPerChunk !== undefined ? 'messageHandling' : 'default'})`,
        delayBetweenChunks: `${delayBetweenChunks} (fonte: ${settings.messageHandling?.delayBetweenChunks !== undefined ? 'messageHandling' : settings.response_delay_seconds ? 'response_delay_seconds' : 'default'})`,
        typingEnabled: `${typingEnabled} (fonte: ${settings.typing?.enabled !== undefined ? 'typing' : settings.typing_indicator_enabled !== undefined ? 'typing_indicator_enabled' : 'default'})`
      });

      smartLogs.info('MESSAGE', '🔧 CONFIGURAÇÕES DE BLOCOS MAPEADAS', {
        assistantId,
        enabled,
        maxCharsPerChunk,
        delayBetweenChunks,
        typingEnabled,
        messageHandling: settings.messageHandling,
        typing: settings.typing,
        fallbackUsed: !settings.messageHandling?.splitLongMessages
      });

      return {
        enabled,
        maxCharsPerChunk,
        delayBetweenChunks,
        typingEnabled,
        minTypingDuration: settings.typing?.minDuration ?? defaultConfig.minTypingDuration,
        maxTypingDuration: settings.typing?.maxDuration ?? defaultConfig.maxTypingDuration,
        typingSpeed: settings.typing?.speed ?? defaultConfig.typingSpeed,
        humanizedDelays: settings.humanizedDelays ?? defaultConfig.humanizedDelays
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