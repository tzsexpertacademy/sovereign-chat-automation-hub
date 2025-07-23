
import { useState, useCallback, useRef, useEffect } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useHumanizedTyping } from './useHumanizedTyping';
import { useMessageBatch } from './useMessageBatch';
import { useAutoReactions } from './useAutoReactions';
import { useOnlineStatus } from './useOnlineStatus';
import { useSmartMessageSplit } from './useSmartMessageSplit';

export interface HumanizedPersonality {
  name: string;
  tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'empathetic';
  responseDelay: { min: number; max: number };
  typingSpeed: number; // WPM
  reactionProbability: number; // 0-1
  emotionalLevel: number; // 0-1
  contextAwareness: boolean;
  voiceCloning: boolean;
  audioProcessing: boolean;
}

export interface HumanizedConfig {
  enabled: boolean;
  personality: HumanizedPersonality;
  openaiConfig?: {
    apiKey: string;
    model: string;
    temperature: number;
  };
  elevenLabsConfig?: {
    apiKey: string;
    voiceId: string;
  };
}

const defaultPersonality: HumanizedPersonality = {
  name: 'Assistente Padrão',
  tone: 'friendly',
  responseDelay: { min: 2000, max: 5000 },
  typingSpeed: 45,
  reactionProbability: 0.3,
  emotionalLevel: 0.7,
  contextAwareness: true,
  voiceCloning: false,
  audioProcessing: true
};

export const useHumanizedWhatsApp = (clientId: string, initialConfig?: Partial<HumanizedConfig>) => {
  const [config, setConfig] = useState<HumanizedConfig>({
    enabled: true,
    personality: defaultPersonality,
    ...initialConfig
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationContext, setConversationContext] = useState<Map<string, any[]>>(new Map());
  const [humanizationLogs, setHumanizationLogs] = useState<any[]>([]);
  
  const processingQueueRef = useRef<Map<string, any[]>>(new Map());

  // Initialize humanization hooks
  const humanizedTyping = useHumanizedTyping(clientId);
  const onlineStatus = useOnlineStatus(clientId, config.enabled);
  const smartSplit = useSmartMessageSplit();
  const autoReactions = useAutoReactions(clientId, config.enabled);

  // Message batch processing with humanized callback
  const messageBatch = useMessageBatch(
    useCallback(async (chatId: string, messages: any[]) => {
      if (!config.enabled) return;
      
      console.log(`🤖 PROCESSAMENTO HUMANIZADO: ${messages.length} mensagens para ${chatId}`);
      
      setIsProcessing(true);
      onlineStatus.setOnline();
      
      try {
        await processMessagesHumanized(chatId, messages);
      } finally {
        setIsProcessing(false);
      }
    }, [config.enabled])
  );

  // Core humanized processing function
  const processMessagesHumanized = useCallback(async (chatId: string, messages: any[]) => {
    if (!config.enabled || messages.length === 0) return;

    const logEntry = {
      chatId,
      timestamp: new Date().toISOString(),
      messagesCount: messages.length,
      personality: config.personality.name,
      actions: []
    };

    try {
      // 1. Analyze conversation context
      const context = conversationContext.get(chatId) || [];
      const newContext = [...context, ...messages].slice(-10); // Keep last 10 messages
      setConversationContext(prev => new Map(prev).set(chatId, newContext));

      // 2. Detect emotions and reactions
      for (const message of messages) {
        if (!message.fromMe && message.body) {
          // Auto reactions based on personality
          if (Math.random() < config.personality.reactionProbability) {
            await autoReactions.processMessage(message);
            logEntry.actions.push({
              type: 'reaction',
              emotion: autoReactions.detectEmotion(message.body),
              timestamp: Date.now()
            });
          }
        }
      }

      // 3. Generate humanized response if needed
      const needsResponse = messages.some(msg => !msg.fromMe && shouldRespondToMessage(msg, newContext));
      
      if (needsResponse) {
        const responseText = await generateHumanizedResponse(messages, newContext);
        if (responseText) {
          await sendHumanizedResponse(chatId, responseText, logEntry);
        }
      }

      // 4. Update online status
      onlineStatus.markActivity();

    } catch (error) {
      console.error('❌ Erro no processamento humanizado:', error);
      logEntry.actions.push({
        type: 'error',
        error: error.message,
        timestamp: Date.now()
      });
    } finally {
      // 5. Log humanization activity
      setHumanizationLogs(prev => [...prev, logEntry].slice(-100)); // Keep last 100 logs
      messageBatch.markBatchAsCompleted(chatId);
    }
  }, [config, conversationContext, autoReactions, onlineStatus, messageBatch]);

  // Determine if message needs response
  const shouldRespondToMessage = useCallback((message: any, context: any[]): boolean => {
    if (!config.personality.contextAwareness) return false;
    
    // Simple rules for demonstration - can be enhanced with AI
    const text = message.body?.toLowerCase() || '';
    
    // Always respond to questions
    if (text.includes('?') || text.includes('como') || text.includes('quando') || text.includes('onde')) {
      return true;
    }
    
    // Respond to greetings
    if (text.includes('oi') || text.includes('olá') || text.includes('bom dia') || text.includes('boa tarde')) {
      return true;
    }
    
    // Context-aware response (if previous message was from us)
    const lastMessage = context[context.length - 2];
    if (lastMessage?.fromMe) {
      return true;
    }
    
    return false;
  }, [config.personality.contextAwareness]);

  // Generate humanized response using OpenAI
  const generateHumanizedResponse = useCallback(async (messages: any[], context: any[]): Promise<string | null> => {
    if (!config.openaiConfig?.apiKey) {
      // Fallback to simple responses
      return generateSimpleResponse(messages);
    }

    try {
      const prompt = buildContextualPrompt(messages, context, config.personality);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.openaiConfig.model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: prompt
            },
            ...context.slice(-5).map(msg => ({
              role: msg.fromMe ? 'assistant' : 'user',
              content: msg.body || '[mídia]'
            }))
          ],
          temperature: config.openaiConfig.temperature || 0.7,
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
      }
    } catch (error) {
      console.error('❌ Erro ao gerar resposta com IA:', error);
    }

    return generateSimpleResponse(messages);
  }, [config]);

  // Build contextual prompt for AI
  const buildContextualPrompt = useCallback((messages: any[], context: any[], personality: HumanizedPersonality): string => {
    const toneDescriptions = {
      formal: 'formal e respeitoso',
      casual: 'casual e descontraído',
      friendly: 'amigável e caloroso',
      professional: 'profissional e objetivo',
      empathetic: 'empático e compreensivo'
    };

    return `Você é um assistente de WhatsApp com personalidade ${personality.name}.
    
Características da sua personalidade:
- Tom: ${toneDescriptions[personality.tone]}
- Nível emocional: ${personality.emotionalLevel * 100}%
- Consciência contextual: ${personality.contextAwareness ? 'Alta' : 'Baixa'}

Instruções:
1. Responda de forma natural e humanizada
2. Use emojis quando apropriado (probabilidade: ${personality.reactionProbability * 100}%)
3. Mantenha o tom ${personality.tone}
4. Seja breve e direto
5. Use linguagem brasileira informal
6. Considere o contexto da conversa

Responda apenas com a mensagem, sem explicações adicionais.`;
  }, []);

  // Simple fallback responses
  const generateSimpleResponse = useCallback((messages: any[]): string => {
    const lastMessage = messages[messages.length - 1];
    const text = lastMessage?.body?.toLowerCase() || '';
    
    const responses = {
      greeting: ['Oi! Como posso ajudar? 😊', 'Olá! Tudo bem?', 'Oi! Como vai você?'],
      question: ['Interessante pergunta! 🤔', 'Deixe-me pensar nisso...', 'Boa pergunta!'],
      thanks: ['De nada! 😊', 'Disponha!', 'Sempre às ordens!'],
      default: ['Entendi! 👍', 'Hmm, interessante...', 'Pode me contar mais?']
    };
    
    let category = 'default';
    if (text.includes('oi') || text.includes('olá')) category = 'greeting';
    else if (text.includes('obrigad') || text.includes('valeu')) category = 'thanks';
    else if (text.includes('?')) category = 'question';
    
    const options = responses[category];
    return options[Math.floor(Math.random() * options.length)];
  }, []);

  // Send humanized response with typing simulation
  const sendHumanizedResponse = useCallback(async (chatId: string, text: string, logEntry: any) => {
    try {
      // 1. Split message if too long
      const chunks = smartSplit.splitMessage(text);
      
      // 2. Send each chunk with humanized timing
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Random delay based on personality
        const delay = Math.random() * 
          (config.personality.responseDelay.max - config.personality.responseDelay.min) + 
          config.personality.responseDelay.min;
        
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Simulate typing
        await humanizedTyping.simulateHumanTyping(chatId, chunk);
        
        // Send message
        const result = await whatsappService.sendMessage(clientId, chatId, chunk);
        
        logEntry.actions.push({
          type: 'message_sent',
          chunk: i + 1,
          totalChunks: chunks.length,
          delay,
          timestamp: Date.now(),
          result
        });
        
        console.log(`📤 RESPOSTA HUMANIZADA ${i + 1}/${chunks.length}: "${chunk.substring(0, 50)}..."`, result);
      }
      
    } catch (error) {
      console.error('❌ Erro ao enviar resposta humanizada:', error);
      throw error;
    }
  }, [smartSplit, config.personality, humanizedTyping, whatsappService, clientId]);

  // Public methods
  const processIncomingMessage = useCallback((message: any) => {
    if (!config.enabled) return;
    
    console.log(`📨 MENSAGEM HUMANIZADA recebida:`, {
      from: message.from,
      type: message.type || 'text',
      preview: message.body?.substring(0, 30) || '[mídia]'
    });
    
    messageBatch.addMessage(message);
  }, [config.enabled, messageBatch]);

  const updatePersonality = useCallback((newPersonality: Partial<HumanizedPersonality>) => {
    setConfig(prev => ({
      ...prev,
      personality: { ...prev.personality, ...newPersonality }
    }));
    
    // Update typing speed
    if (newPersonality.typingSpeed) {
      humanizedTyping.setConfig(prev => ({ ...prev, wpm: newPersonality.typingSpeed }));
    }
    
    console.log('🎭 Personalidade atualizada:', newPersonality);
  }, [humanizedTyping]);

  const getHumanizationStats = useCallback(() => {
    return {
      isProcessing,
      totalLogs: humanizationLogs.length,
      conversationContexts: conversationContext.size,
      onlineStatus: onlineStatus.isOnline,
      activeBatches: messageBatch.activeBatches,
      personality: config.personality,
      lastActivity: humanizationLogs[humanizationLogs.length - 1]?.timestamp
    };
  }, [isProcessing, humanizationLogs, conversationContext, onlineStatus.isOnline, messageBatch.activeBatches, config.personality]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      processingQueueRef.current.clear();
    };
  }, []);

  return {
    // Configuration
    config,
    setConfig,
    updatePersonality,
    
    // Status
    isProcessing,
    getHumanizationStats,
    
    // Core functions
    processIncomingMessage,
    
    // Logs and context
    humanizationLogs,
    conversationContext,
    
    // Sub-hooks
    humanizedTyping,
    onlineStatus,
    smartSplit,
    autoReactions,
    messageBatch
  };
};
