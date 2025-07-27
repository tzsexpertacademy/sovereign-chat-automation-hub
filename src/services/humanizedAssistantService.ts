/**
 * Serviço Unificado de Assistente Humanizado - YUMER.AI
 * Integra todos os comportamentos humanizados com CodeChat v2.2.1
 * Fase 2: Comportamentos Fundamentais - ATUALIZADO
 */

import unifiedYumerService from './unifiedYumerService';
import { supabase } from '@/integrations/supabase/client';

// ===== INTERFACES =====
export interface HumanizedPersonality {
  id: string;
  name: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'empathetic';
  responseDelay: { min: number; max: number };
  typingSpeed: number; // WPM
  reactionProbability: number; // 0-1
  emotionalLevel: number; // 0-1
  contextAwareness: boolean;
  voiceSettings?: {
    enabled: boolean;
    voiceId?: string;
    elevenLabsApiKey?: string;
  };
}

export interface HumanizedConfig {
  enabled: boolean;
  personality: HumanizedPersonality;
  behavior: {
    typing: {
      enabled: boolean;
      minDuration: number;
      maxDuration: number;
      randomDelay: boolean;
    };
    presence: {
      enabled: boolean;
      showOnline: boolean;
      showTyping: boolean;
      showRecording: boolean;
    };
    messageHandling: {
      splitLongMessages: boolean;
      maxCharsPerChunk: number;
      delayBetweenChunks: number;
      markAsRead: boolean;
      readDelay: number;
    };
    aiIntegration: {
      enabled: boolean;
      openaiApiKey?: string;
      model: string;
      temperature: number;
      contextLength: number;
    };
  };
}

export interface HumanizedMessage {
  instanceId: string;
  chatId: string;
  text: string;
  fromUser: boolean;
  timestamp: Date;
  personality?: string;
  processingMetadata?: {
    delay: number;
    typingDuration: number;
    chunks: number;
    emotions?: string[];
  };
}

export interface HumanizationStats {
  totalProcessed: number;
  totalSent: number;
  avgResponseTime: number;
  activeChatIds: string[];
  personality: string;
  lastActivity: Date | null;
}

// ===== PERSONALIDADES PADRÃO =====
const defaultPersonalities: HumanizedPersonality[] = [
  {
    id: 'friendly-assistant',
    name: 'Assistente Amigável',
    tone: 'friendly',
    responseDelay: { min: 2000, max: 4000 },
    typingSpeed: 45,
    reactionProbability: 0.7,
    emotionalLevel: 0.8,
    contextAwareness: true,
    voiceSettings: { enabled: false }
  },
  {
    id: 'professional-support',
    name: 'Suporte Profissional',
    tone: 'professional',
    responseDelay: { min: 1500, max: 3000 },
    typingSpeed: 60,
    reactionProbability: 0.3,
    emotionalLevel: 0.4,
    contextAwareness: true,
    voiceSettings: { enabled: false }
  },
  {
    id: 'casual-buddy',
    name: 'Parceiro Casual',
    tone: 'casual',
    responseDelay: { min: 1000, max: 5000 },
    typingSpeed: 35,
    reactionProbability: 0.9,
    emotionalLevel: 0.9,
    contextAwareness: true,
    voiceSettings: { enabled: false }
  }
];

// ===== CONFIGURAÇÃO PADRÃO =====
const defaultConfig: HumanizedConfig = {
  enabled: true,
  personality: defaultPersonalities[0],
  behavior: {
    typing: {
      enabled: true,
      minDuration: 1000,
      maxDuration: 5000,
      randomDelay: true
    },
    presence: {
      enabled: true,
      showOnline: true,
      showTyping: true,
      showRecording: true
    },
    messageHandling: {
      splitLongMessages: true,
      maxCharsPerChunk: 350,
      delayBetweenChunks: 2500,
      markAsRead: true,
      readDelay: 1500
    },
    aiIntegration: {
      enabled: false,
      model: 'gpt-4o-mini',
      temperature: 0.7,
      contextLength: 10
    }
  }
};

export class HumanizedAssistantService {
  private config: HumanizedConfig = defaultConfig;
  private activeProcessing = new Map<string, boolean>();
  private cancelTokens = new Map<string, boolean>();
  private conversationContext = new Map<string, HumanizedMessage[]>();
  private stats: HumanizationStats = {
    totalProcessed: 0,
    totalSent: 0,
    avgResponseTime: 0,
    activeChatIds: [],
    personality: defaultPersonalities[0].name,
    lastActivity: null
  };

  constructor() {
    console.log('🤖 [HUMANIZED-ASSISTANT] Serviço iniciado');
  }

  // ===== CONFIGURAÇÃO =====
  
  setConfig(newConfig: Partial<HumanizedConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ [HUMANIZED-ASSISTANT] Configuração atualizada:', {
      enabled: this.config.enabled,
      personality: this.config.personality.name,
      behavior: Object.keys(this.config.behavior)
    });
  }

  getConfig(): HumanizedConfig {
    return { ...this.config };
  }

  setPersonality(personalityId: string): void {
    const personality = defaultPersonalities.find(p => p.id === personalityId);
    if (personality) {
      this.config.personality = personality;
      this.stats.personality = personality.name;
      console.log('🎭 [HUMANIZED-ASSISTANT] Personalidade alterada:', personality.name);
    }
  }

  getPersonalities(): HumanizedPersonality[] {
    return [...defaultPersonalities];
  }

  // ===== PROCESSAMENTO DE MENSAGENS =====

  async processIncomingMessage(
    instanceId: string,
    chatId: string,
    messageText: string,
    messageId?: string
  ): Promise<{ success: boolean; responseGenerated: boolean; error?: string }> {
    
    if (!this.config.enabled) {
      return { success: true, responseGenerated: false };
    }

    try {
      // Cancelar processamento anterior se existir
      this.cancelProcessing(chatId);
      
      // Marcar como processando
      this.activeProcessing.set(chatId, true);
      this.stats.activeChatIds = Array.from(this.activeProcessing.keys());
      
      console.log(`📨 [HUMANIZED-ASSISTANT] Processando mensagem: ${chatId}`, {
        text: messageText.substring(0, 50) + '...',
        instanceId,
        personality: this.config.personality.name
      });

      // 1. Salvar contexto da conversa
      const userMessage: HumanizedMessage = {
        instanceId,
        chatId,
        text: messageText,
        fromUser: true,
        timestamp: new Date()
      };
      
      this.addToContext(chatId, userMessage);
      
      // 2. Processar comportamentos inteligentes (FASE 3)
      await this.processIntelligentBehaviors(instanceId, chatId, messageText, messageId);
      
      // 3. Marcar como lida com delay natural (FASE 2)
      if (this.config.behavior.messageHandling.markAsRead && messageId) {
        this.scheduleMessageRead(instanceId, messageId, chatId, messageText);
      }

      // 4. Definir como online usando hook real (FASE 2)
      if (this.config.behavior.presence.enabled && this.config.behavior.presence.showOnline) {
        await this.setRealPresence(instanceId, chatId, 'available');
      }

      // 5. Processar com delay humanizado
      const shouldRespond = await this.shouldGenerateResponse(chatId, messageText);
      
      if (shouldRespond) {
        await this.processWithHumanizedDelay(chatId, async () => {
          if (!this.cancelTokens.get(chatId)) {
            await this.generateAndSendResponse(instanceId, chatId, messageText);
          }
        });
      }

      this.stats.totalProcessed++;
      this.stats.lastActivity = new Date();
      
      return { success: true, responseGenerated: shouldRespond };
      
    } catch (error) {
      console.error('❌ [HUMANIZED-ASSISTANT] Erro no processamento:', error);
      return { 
        success: false, 
        responseGenerated: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    } finally {
      this.activeProcessing.delete(chatId);
      this.stats.activeChatIds = Array.from(this.activeProcessing.keys());
    }
  }

  // ===== GERAÇÃO DE RESPOSTA =====

  private async generateAndSendResponse(instanceId: string, chatId: string, userMessage: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. Gerar resposta com IA ou fallback
      let responseText: string;
      
      if (this.config.behavior.aiIntegration.enabled && this.config.behavior.aiIntegration.openaiApiKey) {
        responseText = await this.generateAIResponse(chatId, userMessage);
      } else {
        responseText = await this.generateFallbackResponse(userMessage, chatId);
      }

      if (!responseText) {
        console.log('🤐 [HUMANIZED-ASSISTANT] Nenhuma resposta gerada');
        return;
      }

      // 2. Salvar resposta no contexto
      const assistantMessage: HumanizedMessage = {
        instanceId,
        chatId,
        text: responseText,
        fromUser: false,
        timestamp: new Date(),
        personality: this.config.personality.id
      };

      this.addToContext(chatId, assistantMessage);

      // 3. Enviar com comportamento humanizado
      await this.sendHumanizedMessage(instanceId, chatId, responseText);
      
      // 4. Atualizar estatísticas
      const responseTime = Date.now() - startTime;
      this.stats.totalSent++;
      this.stats.avgResponseTime = (this.stats.avgResponseTime + responseTime) / 2;
      
      console.log(`✅ [HUMANIZED-ASSISTANT] Resposta enviada em ${responseTime}ms`);
      
    } catch (error) {
      console.error('❌ [HUMANIZED-ASSISTANT] Erro ao gerar resposta:', error);
      throw error;
    }
  }

  // ===== ENVIO HUMANIZADO =====

  async sendHumanizedMessage(instanceId: string, chatId: string, text: string): Promise<{ success: boolean; chunks: number; error?: string }> {
    try {
      // 1. Dividir mensagem em chunks se necessário
      const chunks = this.config.behavior.messageHandling.splitLongMessages 
        ? this.splitMessage(text)
        : [text];

      console.log(`📤 [HUMANIZED-ASSISTANT] Enviando ${chunks.length} chunks para ${chatId}`);

      // 2. Enviar cada chunk com comportamento humanizado
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Verificar cancelamento
        if (this.cancelTokens.get(chatId)) {
          console.log(`❌ [HUMANIZED-ASSISTANT] Envio cancelado: ${chatId}`);
          return { success: false, chunks: i, error: 'Cancelado pelo usuário' };
        }

        // Simular typing real se habilitado (FASE 2)
        if (this.config.behavior.typing.enabled && this.config.behavior.presence.showTyping) {
          const typingDuration = this.calculateTypingDuration(chunk);
          await this.simulateRealTyping(instanceId, chatId, typingDuration);
        }

        // Verificar cancelamento novamente
        if (this.cancelTokens.get(chatId)) {
          return { success: false, chunks: i, error: 'Cancelado durante typing' };
        }

        // Enviar via CodeChat v2.2.1
        const result = await unifiedYumerService.sendTextMessage(instanceId, chatId, chunk);

        if (!result.success) {
          console.error(`❌ [HUMANIZED-ASSISTANT] Erro no chunk ${i + 1}:`, result.error);
          return { success: false, chunks: i, error: result.error };
        }

        // Delay entre chunks (exceto no último)
        if (i < chunks.length - 1) {
          const chunkDelay = this.config.behavior.messageHandling.delayBetweenChunks + 
            (Math.random() - 0.5) * 1000; // ±500ms de variação
          await new Promise(resolve => setTimeout(resolve, chunkDelay));
        }
      }

      return { success: true, chunks: chunks.length };
      
    } catch (error) {
      console.error('❌ [HUMANIZED-ASSISTANT] Erro no envio humanizado:', error);
      return { 
        success: false, 
        chunks: 0, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  // ===== UTILITÁRIOS PRIVADOS =====

  private splitMessage(text: string): string[] {
    const maxLength = this.config.behavior.messageHandling.maxCharsPerChunk;
    
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLength) {
      let splitIndex = maxLength;
      
      // Procurar quebra natural
      const naturalBreaks = ['. ', ', ', '\n', '; ', '! ', '? '];
      for (const breakChar of naturalBreaks) {
        const lastBreak = remaining.lastIndexOf(breakChar, maxLength);
        if (lastBreak > maxLength * 0.5) {
          splitIndex = lastBreak + breakChar.length;
          break;
        }
      }

      chunks.push(remaining.substring(0, splitIndex).trim());
      remaining = remaining.substring(splitIndex).trim();
    }

    if (remaining.length > 0) {
      chunks.push(remaining);
    }

    return chunks;
  }

  private calculateTypingDuration(text: string): number {
    const words = text.split(' ').length;
    const baseTypingTime = (words / this.config.personality.typingSpeed) * 60 * 1000;
    
    // Aplicar limites e variação
    let duration = baseTypingTime;
    if (this.config.behavior.typing.randomDelay) {
      duration *= (0.8 + Math.random() * 0.4); // 80% a 120% do tempo base
    }
    
    return Math.max(
      this.config.behavior.typing.minDuration,
      Math.min(this.config.behavior.typing.maxDuration, duration)
    );
  }

  private calculateMessageDelay(text: string): number {
    const baseDelay = this.config.personality.responseDelay.min;
    const maxDelay = this.config.personality.responseDelay.max;
    const randomFactor = Math.random();
    
    return Math.floor(baseDelay + (maxDelay - baseDelay) * randomFactor);
  }

  // ===== MÉTODOS FASE 3: COMPORTAMENTOS INTELIGENTES =====

  private analyzeMessageSentiment(text: string): 'positive' | 'negative' | 'neutral' | 'question' {
    const lowerText = text.toLowerCase();
    
    // Detectar perguntas
    if (lowerText.includes('?') || 
        lowerText.startsWith('como') || 
        lowerText.startsWith('quando') || 
        lowerText.startsWith('onde') || 
        lowerText.startsWith('por que') || 
        lowerText.startsWith('qual')) {
      return 'question';
    }
    
    // Palavras positivas
    const positiveWords = ['obrigado', 'ótimo', 'excelente', 'bom', 'legal', 'perfeito', 'maravilhoso', 'adorei', 'gostei'];
    // Palavras negativas  
    const negativeWords = ['problema', 'erro', 'ruim', 'péssimo', 'odeio', 'difícil', 'complicado', 'chato'];
    
    const hasPositive = positiveWords.some(word => lowerText.includes(word));
    const hasNegative = negativeWords.some(word => lowerText.includes(word));
    
    if (hasPositive && !hasNegative) return 'positive';
    if (hasNegative && !hasPositive) return 'negative';
    
    return 'neutral';
  }

  private async processIntelligentBehaviors(instanceId: string, chatId: string, messageText: string, messageId?: string): Promise<void> {
    try {
      // 1. Analisar sentimento da mensagem
      const sentiment = this.analyzeMessageSentiment(messageText);
      console.log(`🧠 [HUMANIZED-ASSISTANT] Sentimento detectado: ${sentiment} para "${messageText.substring(0, 30)}..."`);

      // 2. Analisar contexto da conversa
      const conversationAnalysis = this.analyzeConversationContext(chatId);
      console.log(`📊 [HUMANIZED-ASSISTANT] Contexto: ${conversationAnalysis.conversationTone}, ${conversationAnalysis.messageCount} msgs`);

      // 3. Ajustar comportamento baseado no contexto
      if (conversationAnalysis.needsAttention) {
        console.log(`⚠️ [HUMANIZED-ASSISTANT] Cliente precisa de atenção especial: ${chatId}`);
        // Reduzir delay de resposta para casos que precisam de atenção
        this.config.personality.responseDelay.min = Math.max(1000, this.config.personality.responseDelay.min * 0.7);
        this.config.personality.responseDelay.max = Math.max(2000, this.config.personality.responseDelay.max * 0.7);
      }

      // 4. Salvar análise no contexto da mensagem
      const context = this.getContext(chatId);
      if (context.length > 0) {
        const lastMessage = context[context.length - 1];
        if (lastMessage && lastMessage.fromUser) {
          lastMessage.processingMetadata = {
            ...lastMessage.processingMetadata,
            emotions: [sentiment],
            delay: this.calculateMessageDelay(messageText),
            typingDuration: this.calculateTypingDuration(messageText),
            chunks: this.splitMessage(messageText).length
          };
        }
      }

    } catch (error) {
      console.warn('⚠️ [HUMANIZED-ASSISTANT] Erro no processamento inteligente:', error);
    }
  }

  private getContextualResponse(chatId: string, sentiment: string, userMessage: string): string {
    const context = this.getContext(chatId);
    const isFirstMessage = context.length <= 1;
    
    // Respostas baseadas no contexto e sentimento
    const contextualResponses = {
      first_positive: ['Que ótimo! 😊 Como posso ajudar?', 'Excelente! Estou aqui para te apoiar! 🚀'],
      first_negative: ['Entendo sua preocupação. 😔 Me conta mais sobre isso?', 'Vamos resolver isso juntos! 💪'],
      first_question: ['Ótima pergunta! 🤔 Deixe-me te ajudar com isso.', 'Interessante! Posso esclarecer isso para você.'],
      first_neutral: ['Oi! 👋 Como posso te ajudar hoje?', 'E aí! Tudo bem? 😊'],
      
      continuing_positive: ['Que bom! 😄', 'Perfeito! Mais alguma coisa?', 'Fico feliz em saber! ✨'],
      continuing_negative: ['Entendo... 😟', 'Vamos encontrar uma solução! 💡', 'Me conte mais detalhes.'],
      continuing_question: ['Boa pergunta! 🤔', 'Deixe-me pensar... 💭', 'Posso explicar melhor!'],
      continuing_neutral: ['Entendi! 👍', 'Certo! 😊', 'Me fala mais sobre isso.']
    };

    const contextKey = isFirstMessage ? `first_${sentiment}` : `continuing_${sentiment}`;
    const responses = contextualResponses[contextKey] || contextualResponses.continuing_neutral;
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private analyzeConversationContext(chatId: string): {
    messageCount: number;
    lastUserSentiment: string;
    conversationTone: string;
    hasBeenHelped: boolean;
    needsAttention: boolean;
  } {
    const context = this.getContext(chatId);
    const userMessages = context.filter(msg => msg.fromUser);
    
    // Analisar tom geral da conversa
    let positiveCount = 0;
    let negativeCount = 0;
    
    userMessages.slice(-5).forEach(msg => {
      const sentiment = this.analyzeMessageSentiment(msg.text);
      if (sentiment === 'positive') positiveCount++;
      if (sentiment === 'negative') negativeCount++;
    });
    
    const conversationTone = positiveCount > negativeCount ? 'positive' : 
                           negativeCount > positiveCount ? 'negative' : 'neutral';
    
    const lastMessage = userMessages[userMessages.length - 1];
    const lastUserSentiment = lastMessage ? this.analyzeMessageSentiment(lastMessage.text) : 'neutral';
    
    // Verificar se precisa de atenção (muitas mensagens negativas)
    const needsAttention = negativeCount >= 2 && userMessages.length >= 3;
    
    // Verificar se foi ajudado (agradecimentos ou confirmações)
    const hasBeenHelped = userMessages.some(msg => 
      msg.text.toLowerCase().includes('obrigado') ||
      msg.text.toLowerCase().includes('resolvido') ||
      msg.text.toLowerCase().includes('funcionou')
    );

    return {
      messageCount: context.length,
      lastUserSentiment,
      conversationTone,
      hasBeenHelped,
      needsAttention
    };
  }

  private buildIntelligentPrompt(context: HumanizedMessage[], personality: HumanizedPersonality, conversationAnalysis: any): string {
    const { conversationTone, needsAttention, hasBeenHelped, messageCount } = conversationAnalysis;
    
    const basePrompt = `Você é um assistente humanizado via WhatsApp com personalidade "${personality.name}".
    
Tom da personalidade: ${this.getToneDescription(personality.tone)}
Nível emocional: ${personality.emotionalLevel * 100}%

Contexto da conversa:
- Total de mensagens: ${messageCount}
- Tom geral: ${conversationTone}
- Cliente precisa de atenção especial: ${needsAttention ? 'SIM' : 'NÃO'}
- Cliente foi ajudado: ${hasBeenHelped ? 'SIM' : 'NÃO'}

Instruções comportamentais:
1. Seja natural e humanizado como um brasileiro
2. Use emojis moderadamente (1-2 por mensagem)
3. Mantenha respostas entre 50-200 caracteres
4. ${needsAttention ? 'PRIORIZE demonstrar empatia e suporte' : 'Mantenha o tom positivo'}
5. ${hasBeenHelped ? 'Pergunte se precisa de mais alguma coisa' : 'Foque em ajudar efetivamente'}
6. Use linguagem coloquial brasileira
7. ${conversationTone === 'negative' ? 'Seja mais empático e compreensivo' : 'Mantenha energia positiva'}

Responda apenas com a mensagem, sem explicações adicionais.`;

    return basePrompt;
  }

  private getToneDescription(tone: string): string {
    const descriptions = {
      formal: 'formal e respeitoso',
      casual: 'casual e descontraído', 
      friendly: 'amigável e caloroso',
      professional: 'profissional e objetivo',
      empathetic: 'empático e compreensivo'
    };
    return descriptions[tone] || 'neutro';
  }

  // ===== MÉTODOS FASE 2: COMPORTAMENTOS FUNDAMENTAIS =====

  private async simulateRealTyping(instanceId: string, chatId: string, duration: number): Promise<void> {
    try {
      console.log(`⌨️ [HUMANIZED-ASSISTANT] Typing real por ${duration}ms: ${chatId}`);
      
      // Usar presença real do CodeChat
      await this.setRealPresence(instanceId, chatId, 'composing');
      await new Promise(resolve => setTimeout(resolve, duration));
      await this.setRealPresence(instanceId, chatId, 'available');
      
    } catch (error) {
      console.warn('⚠️ [HUMANIZED-ASSISTANT] Erro no typing real:', error);
    }
  }

  private async setRealPresence(instanceId: string, chatId: string, presence: 'available' | 'composing' | 'unavailable'): Promise<void> {
    try {
      await unifiedYumerService.setPresence(instanceId, chatId, presence);
    } catch (error) {
      console.warn('⚠️ [HUMANIZED-ASSISTANT] Erro na presença real:', error);
    }
  }

  private scheduleMessageRead(instanceId: string, messageId: string, chatId: string, messageText: string): void {
    const delay = this.config.behavior.messageHandling.readDelay + Math.random() * 1000;
    console.log(`📖 [HUMANIZED-ASSISTANT] Agendando leitura em ${delay}ms: ${messageId}`);
    
    setTimeout(async () => {
      try {
        await unifiedYumerService.markAsRead(instanceId, messageId, chatId);
        console.log(`✅ [HUMANIZED-ASSISTANT] Mensagem lida: ${messageId}`);
      } catch (error) {
        console.warn('⚠️ [HUMANIZED-ASSISTANT] Erro ao marcar como lida:', error);
      }
    }, delay);
  }

  private async markAsReadWithDelay(instanceId: string, messageId: string, chatId: string): Promise<void> {
    try {
      await unifiedYumerService.markAsRead(instanceId, messageId, chatId);
      console.log(`✅ [HUMANIZED-ASSISTANT] Mensagem marcada como lida: ${messageId}`);
    } catch (error) {
      console.warn('⚠️ [HUMANIZED-ASSISTANT] Erro ao marcar como lida:', error);
    }
  }

  private async shouldGenerateResponse(chatId: string, messageText: string): Promise<boolean> {
    if (!this.config.personality.contextAwareness) {
      return false;
    }

    const text = messageText.toLowerCase();
    
    // Sempre responder a perguntas
    if (text.includes('?') || text.includes('como') || text.includes('quando') || text.includes('onde')) {
      return true;
    }
    
    // Responder a cumprimentos
    if (text.includes('oi') || text.includes('olá') || text.includes('bom dia')) {
      return true;
    }
    
    // Usar probabilidade da personalidade
    return Math.random() < this.config.personality.reactionProbability;
  }

  private async generateAIResponse(chatId: string, userMessage: string): Promise<string> {
    try {
      const context = this.getContext(chatId);
      const conversationAnalysis = this.analyzeConversationContext(chatId);
      
      // Usar prompt inteligente com análise de contexto (FASE 3)
      const prompt = this.buildIntelligentPrompt(context, this.config.personality, conversationAnalysis);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.behavior.aiIntegration.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.behavior.aiIntegration.model,
          messages: [
            { role: 'system', content: prompt },
            ...context.slice(-this.config.behavior.aiIntegration.contextLength).map(msg => ({
              role: msg.fromUser ? 'user' : 'assistant',
              content: msg.text
            }))
          ],
          temperature: this.config.behavior.aiIntegration.temperature,
          max_tokens: 300,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('❌ [HUMANIZED-ASSISTANT] Erro na IA:', error);
    }
    
    return '';
  }

  private async generateFallbackResponse(userMessage: string, chatId?: string): Promise<string> {
    // Usar resposta contextual inteligente se chatId fornecido (FASE 3)
    if (chatId) {
      const sentiment = this.analyzeMessageSentiment(userMessage);
      return this.getContextualResponse(chatId, sentiment, userMessage);
    }
    
    // Fallback tradicional
    const text = userMessage.toLowerCase();
    
    const responses = {
      greeting: ['Oi! Como posso ajudar? 😊', 'Olá! Tudo bem?', 'E aí! Como vai?'],
      question: ['Interessante pergunta! 🤔', 'Deixe-me pensar...', 'Boa pergunta!'],
      thanks: ['De nada! 😊', 'Disponha!', 'Sempre às ordens!'],
      default: ['Entendi! 👍', 'Hmm...', 'Me conta mais!']
    };
    
    let category = 'default';
    if (text.includes('oi') || text.includes('olá')) category = 'greeting';
    else if (text.includes('obrigad')) category = 'thanks';
    else if (text.includes('?')) category = 'question';
    
    const options = responses[category];
    return options[Math.floor(Math.random() * options.length)];
  }

  private buildAIPrompt(context: HumanizedMessage[], personality: HumanizedPersonality): string {
    const toneDescriptions = {
      formal: 'formal e respeitoso',
      casual: 'casual e descontraído',
      friendly: 'amigável e caloroso',
      professional: 'profissional e objetivo',
      empathetic: 'empático e compreensivo'
    };

    return `Você é um assistente de WhatsApp humanizado com personalidade "${personality.name}".

Características:
- Tom: ${toneDescriptions[personality.tone]}
- Nível emocional: ${personality.emotionalLevel * 100}%
- Probabilidade de reação: ${personality.reactionProbability * 100}%

Instruções:
1. Seja natural e humanizado
2. Use emojis moderadamente
3. Mantenha respostas concisas (máx. 200 caracteres)
4. Use linguagem brasileira informal
5. Considere o contexto da conversa

Responda apenas com a mensagem, sem explicações.`;
  }

  private addToContext(chatId: string, message: HumanizedMessage): void {
    const context = this.conversationContext.get(chatId) || [];
    context.push(message);
    
    // Manter apenas as últimas 20 mensagens
    if (context.length > 20) {
      context.splice(0, context.length - 20);
    }
    
    this.conversationContext.set(chatId, context);
  }

  private getContext(chatId: string): HumanizedMessage[] {
    return this.conversationContext.get(chatId) || [];
  }

  private async processWithHumanizedDelay(chatId: string, processingFunction: () => Promise<void>): Promise<void> {
    const delay = this.config.personality.responseDelay.min + 
      Math.random() * (this.config.personality.responseDelay.max - this.config.personality.responseDelay.min);
    
    console.log(`⏳ [HUMANIZED-ASSISTANT] Delay humanizado: ${delay}ms para ${chatId}`);
    
    setTimeout(async () => {
      if (!this.cancelTokens.get(chatId)) {
        await processingFunction();
      }
    }, delay);
  }

  // ===== CONTROLE =====

  cancelProcessing(chatId: string): void {
    this.cancelTokens.set(chatId, true);
    this.activeProcessing.delete(chatId);
    this.stats.activeChatIds = Array.from(this.activeProcessing.keys());
    console.log(`❌ [HUMANIZED-ASSISTANT] Processamento cancelado: ${chatId}`);
  }

  clearCancelToken(chatId: string): void {
    this.cancelTokens.delete(chatId);
  }

  getStats(): HumanizationStats {
    return { ...this.stats };
  }

  // ===== CONTROLE PRINCIPAL =====
  
  enable(): void {
    this.config.enabled = true;
    console.log('✅ [HUMANIZED-ASSISTANT] Serviço habilitado');
  }

  disable(): void {
    this.config.enabled = false;
    this.activeProcessing.clear();
    this.cancelTokens.clear();
    this.stats.activeChatIds = [];
    console.log('🚫 [HUMANIZED-ASSISTANT] Serviço desabilitado');
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// Instância singleton
export const humanizedAssistantService = new HumanizedAssistantService();
export default humanizedAssistantService;