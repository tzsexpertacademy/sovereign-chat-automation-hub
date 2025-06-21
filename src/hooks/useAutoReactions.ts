
import { useState, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export interface DetectedEmotion {
  type: 'love' | 'approval' | 'laugh' | 'surprise' | 'sadness' | 'anger';
  emoji: string;
  confidence: number;
  contextModifier: string;
}

export const useAutoReactions = (clientId: string, isEnabled: boolean = true) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Detectar emoções em mensagens
  const detectEmotion = useCallback((messageText: string): DetectedEmotion | null => {
    if (!messageText || typeof messageText !== 'string') return null;

    const text = messageText.toLowerCase();
    
    // Padrões de emoções
    const emotionPatterns = [
      {
        type: 'love' as const,
        emoji: '❤️',
        keywords: ['amo', 'amor', 'adoro', 'perfeito', 'maravilhoso', 'incrível', 'fantástico', 'excelente', 'show', 'top'],
        contextModifier: 'O usuário demonstrou muito carinho e aprovação. Responda de forma calorosa e agradecida.'
      },
      {
        type: 'approval' as const,
        emoji: '👍',
        keywords: ['bom', 'ótimo', 'legal', 'certo', 'correto', 'perfeito', 'aprovado', 'concordo', 'sim', 'bacana'],
        contextModifier: 'O usuário aprovou algo. Responda de forma positiva e incentivadora.'
      },
      {
        type: 'laugh' as const,
        emoji: '😂',
        keywords: ['kkkk', 'hahaha', 'rsrs', 'hehe', 'kkk', 'engraçado', 'hilário', 'rindo', 'gargalhada'],
        contextModifier: 'O usuário está rindo ou achou algo engraçado. Mantenha o tom descontraído e alegre.'
      },
      {
        type: 'surprise' as const,
        emoji: '😮',
        keywords: ['nossa', 'uau', 'caramba', 'impressionante', 'surreal', 'não acredito', 'sério?', 'mesmo?'],
        contextModifier: 'O usuário ficou surpreso. Responda de forma empolgada e compartilhe o entusiasmo.'
      },
      {
        type: 'sadness' as const,
        emoji: '😢',
        keywords: ['triste', 'chateado', 'problema', 'dificuldade', 'ruim', 'péssimo', 'não consegui', 'frustrado'],
        contextModifier: 'O usuário está triste ou frustrado. Responda com empatia e ofereça ajuda.'
      },
      {
        type: 'anger' as const,
        emoji: '😠',
        keywords: ['raiva', 'irritado', 'absurdo', 'inaceitável', 'revoltante', 'péssimo', 'horrível', 'ódio'],
        contextModifier: 'O usuário está irritado. Responda com calma, peça desculpas se necessário e tente resolver.'
      }
    ];

    // Buscar a emoção mais provável
    for (const pattern of emotionPatterns) {
      const matches = pattern.keywords.filter(keyword => text.includes(keyword)).length;
      if (matches > 0) {
        const confidence = Math.min(matches / pattern.keywords.length, 1);
        
        return {
          type: pattern.type,
          emoji: pattern.emoji,
          confidence,
          contextModifier: pattern.contextModifier
        };
      }
    }

    return null;
  }, []);

  // Enviar reação automática
  const sendAutoReaction = useCallback(async (chatId: string, messageId: string, emotion: DetectedEmotion) => {
    if (!isEnabled || !clientId || isProcessing) return;

    try {
      setIsProcessing(true);
      
      // Delay natural aleatório entre 1-3 segundos
      const delay = Math.random() * 2000 + 1000; // 1000-3000ms
      console.log(`🎭 Enviando reação ${emotion.emoji} em ${Math.round(delay)}ms para ${chatId}`);
      
      await new Promise(resolve => setTimeout(resolve, delay));

      // Enviar reação (se a API suportar)
      await whatsappService.sendReaction(clientId, chatId, messageId, emotion.emoji);
      
      console.log(`✅ Reação ${emotion.emoji} enviada para mensagem ${messageId}`);
      
    } catch (error) {
      console.error('❌ Erro ao enviar reação automática:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [clientId, isEnabled, isProcessing]);

  // Processar mensagem e enviar reação se apropriado
  const processMessage = useCallback(async (message: any) => {
    if (!isEnabled || !message || message.fromMe) return null;

    const emotion = detectEmotion(message.body);
    
    if (emotion && emotion.confidence > 0.3) {
      console.log(`🎭 Emoção detectada: ${emotion.type} (${emotion.emoji}) - Confiança: ${emotion.confidence}`);
      
      // Enviar reação automática
      await sendAutoReaction(message.from, message.id, emotion);
      
      return emotion;
    }

    return null;
  }, [isEnabled, detectEmotion, sendAutoReaction]);

  return {
    isProcessing,
    detectEmotion,
    processMessage
  };
};
