
import { useCallback } from 'react';

export interface EmotionReaction {
  emotion: string;
  confidence: number;
  emoji: string;
  promptModifier: string;
}

export const useEmotionDetection = () => {
  const detectEmotion = useCallback((message: string): EmotionReaction | null => {
    const text = message.toLowerCase();
    
    // Padrões para detectar emoções
    const patterns = {
      love: {
        keywords: ['amo', 'amor', 'adoro', 'perfeito', 'incrível', 'maravilhoso', 'excelente', 'fantástico'],
        emoji: '❤️',
        promptModifier: 'Responda de forma carinhosa e afetuosa, mostrando que você valoriza muito o feedback positivo.'
      },
      approval: {
        keywords: ['obrigado', 'valeu', 'top', 'legal', 'bom', 'ótimo', 'show', 'massa', 'bacana'],
        emoji: '👍',
        promptModifier: 'Responda de forma positiva e encorajadora, reconhecendo a aprovação.'
      },
      laughter: {
        keywords: ['kkkk', 'hahaha', 'rsrsrs', 'hehe', 'risos', 'engraçado', 'hilário'],
        emoji: '😂',
        promptModifier: 'Responda de forma descontraída e bem-humorada, mantendo o tom alegre da conversa.'
      },
      surprise: {
        keywords: ['nossa', 'uau', 'caramba', 'sério', 'inacreditável', 'impressionante', 'surreal'],
        emoji: '😮',
        promptModifier: 'Responda demonstrando entusiasmo e aproveitando o momento de surpresa para engajar mais.'
      },
      sadness: {
        keywords: ['triste', 'chateado', 'decepcionado', 'frustrado', 'problema', 'difícil', 'ruim'],
        emoji: '😢',
        promptModifier: 'Responda com empatia e compreensão, oferecendo apoio e soluções construtivas.'
      },
      anger: {
        keywords: ['raiva', 'irritado', 'furioso', 'ódio', 'revoltado', 'absurdo', 'ridículo'],
        emoji: '😠',
        promptModifier: 'Responda com calma e profissionalismo, buscando entender e resolver o problema.'
      }
    };

    // Verificar cada padrão
    for (const [emotion, config] of Object.entries(patterns)) {
      const matches = config.keywords.filter(keyword => text.includes(keyword));
      if (matches.length > 0) {
        const confidence = Math.min(matches.length / config.keywords.length, 1);
        return {
          emotion,
          confidence,
          emoji: config.emoji,
          promptModifier: config.promptModifier
        };
      }
    }

    return null;
  }, []);

  return { detectEmotion };
};
