
import { useState, useEffect, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

interface AutoReactionConfig {
  enabled: boolean;
  delay: { min: number; max: number };
  emotions: {
    love: string[];
    approval: string[];
    laugh: string[];
    surprise: string[];
    sad: string[];
    angry: string[];
  };
}

const defaultConfig: AutoReactionConfig = {
  enabled: true,
  delay: { min: 1000, max: 3000 },
  emotions: {
    love: ['amor', 'amo', 'adoro', 'paixão', 'coração', '❤️', '💕', '💖'],
    approval: ['ótimo', 'excelente', 'perfeito', 'concordo', 'sim', 'certo', '👍', '✅'],
    laugh: ['haha', 'kkkk', 'rsrs', 'lol', 'engraçado', 'piada', '😂', '🤣'],
    surprise: ['nossa', 'uau', 'incrível', 'surpreendente', 'caramba', '😮', '😱'],
    sad: ['triste', 'chateado', 'deprimido', 'mal', 'péssimo', '😢', '😭'],
    angry: ['raiva', 'irritado', 'ódio', 'furioso', 'bravo', '😠', '😡']
  }
};

const reactionEmojis = {
  love: '❤️',
  approval: '👍',
  laugh: '😂',
  surprise: '😮',
  sad: '😢',
  angry: '😠'
};

export const useAutoReactions = (clientId: string, enabled = true) => {
  const [config, setConfig] = useState<AutoReactionConfig>(defaultConfig);
  const [processingReactions, setProcessingReactions] = useState<Set<string>>(new Set());

  const detectEmotion = useCallback((text: string): keyof typeof reactionEmojis | null => {
    const lowerText = text.toLowerCase();
    
    for (const [emotion, keywords] of Object.entries(config.emotions)) {
      if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
        return emotion as keyof typeof reactionEmojis;
      }
    }
    
    return null;
  }, [config.emotions]);

  const sendReaction = useCallback(async (chatId: string, messageId: string, emotion: keyof typeof reactionEmojis) => {
    if (!enabled || !config.enabled) return;
    
    const reactionKey = `${messageId}_${emotion}`;
    if (processingReactions.has(reactionKey)) return;
    
    setProcessingReactions(prev => new Set(prev).add(reactionKey));
    
    try {
      // Delay natural
      const delay = Math.random() * (config.delay.max - config.delay.min) + config.delay.min;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Enviar reação
      await whatsappService.sendReaction(clientId, chatId, messageId, reactionEmojis[emotion]);
      
      console.log(`🎭 Reação automática enviada: ${reactionEmojis[emotion]} para mensagem ${messageId}`);
      
    } catch (error) {
      console.error('❌ Erro ao enviar reação automática:', error);
    } finally {
      setProcessingReactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(reactionKey);
        return newSet;
      });
    }
  }, [enabled, config, clientId, processingReactions]);

  const processMessage = useCallback(async (message: any) => {
    if (!message.body || message.fromMe) return;
    
    const emotion = detectEmotion(message.body);
    if (emotion) {
      await sendReaction(message.from, message.id, emotion);
    }
  }, [detectEmotion, sendReaction]);

  return {
    config,
    setConfig,
    processMessage,
    detectEmotion,
    sendReaction,
    isProcessing: processingReactions.size > 0
  };
};
