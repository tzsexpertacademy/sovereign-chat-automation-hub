
import { useCallback } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export interface ReactionRule {
  id: string;
  keywords: string[];
  emotion: string;
  description: string;
}

export const useMessageReactions = (clientId: string) => {
  
  // Regras de reação padrão
  const defaultReactionRules: ReactionRule[] = [
    {
      id: 'elogio',
      keywords: ['obrigado', 'obrigada', 'valeu', 'ótimo', 'excelente', 'perfeito', 'maravilhoso', 'adorei', 'amei', 'muito bom', 'top', 'show'],
      emotion: '❤️',
      description: 'Elogios e agradecimentos'
    },
    {
      id: 'aprovacao',
      keywords: ['sim', 'ok', 'certo', 'correto', 'concordo', 'aceito', 'pode ser', 'tudo bem'],
      emotion: '👍',
      description: 'Aprovação e concordância'
    },
    {
      id: 'risada',
      keywords: ['haha', 'kkkk', 'rsrs', 'hehe', 'engraçado', 'kk', 'kkk', 'rs'],
      emotion: '😂',
      description: 'Risadas e humor'
    },
    {
      id: 'surpresa',
      keywords: ['nossa', 'uau', 'wow', 'incrível', 'impressionante', 'caramba', 'sério'],
      emotion: '😮',
      description: 'Surpresa e admiração'
    },
    {
      id: 'tristeza',
      keywords: ['triste', 'chateado', 'chateada', 'problema', 'ruim', 'péssimo', 'horrível', 'decepcionado'],
      emotion: '😢',
      description: 'Tristeza e decepção'
    },
    {
      id: 'raiva',
      keywords: ['raiva', 'irritado', 'irritada', 'nervoso', 'nervosa', 'absurdo', 'ridículo'],
      emotion: '😠',
      description: 'Raiva e irritação'
    }
  ];

  // Analisar mensagem e determinar reação apropriada
  const analyzeMessageForReaction = useCallback((messageText: string): string | null => {
    if (!messageText || typeof messageText !== 'string') {
      return null;
    }

    const text = messageText.toLowerCase().trim();
    
    // Verificar cada regra de reação
    for (const rule of defaultReactionRules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          console.log(`🎭 Reação detectada: "${keyword}" -> ${rule.emotion} (${rule.description})`);
          return rule.emotion;
        }
      }
    }

    return null;
  }, []);

  // Enviar reação para uma mensagem
  const sendReaction = useCallback(async (chatId: string, messageId: string, emotion: string): Promise<boolean> => {
    try {
      console.log('🎭 Enviando reação:', { chatId, messageId, emotion });

      // Como o WhatsApp Web ainda não suporta reações via API de forma consistente,
      // vamos simular enviando uma mensagem rápida com o emoji
      await whatsappService.sendMessage(clientId, chatId, emotion);

      console.log('✅ Reação enviada com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar reação:', error);
      return false;
    }
  }, [clientId]);

  // Processar mensagem e enviar reação se apropriada
  const processMessageForReaction = useCallback(async (chatId: string, messageId: string, messageText: string): Promise<void> => {
    const emotion = analyzeMessageForReaction(messageText);
    
    if (emotion) {
      // Pequeno delay para parecer mais natural
      setTimeout(async () => {
        await sendReaction(chatId, messageId, emotion);
      }, 1000 + Math.random() * 2000); // 1-3 segundos de delay
    }
  }, [analyzeMessageForReaction, sendReaction]);

  // Gerar prompt adicional para assistente baseado na reação
  const generateReactionPrompt = useCallback((messageText: string): string => {
    const emotion = analyzeMessageForReaction(messageText);
    
    if (!emotion) return '';

    switch (emotion) {
      case '❤️':
        return '\n\nO cliente está demonstrando gratidão e satisfação. Responda de forma calorosa e continue oferecendo um excelente atendimento.';
      case '👍':
        return '\n\nO cliente está concordando e aprovando. Continue na mesma linha de comunicação pois está funcionando bem.';
      case '😂':
        return '\n\nO cliente está em um momento descontraído e divertido. Mantenha o tom leve e bem-humorado se apropriado.';
      case '😮':
        return '\n\nO cliente demonstra surpresa positiva. Aproveite para destacar mais benefícios ou informações interessantes.';
      case '😢':
        return '\n\nO cliente parece estar chateado ou decepcionado. Seja empático, ouça atentamente e ofereça soluções para resolver o problema.';
      case '😠':
        return '\n\nO cliente demonstra irritação. Seja muito respeitoso, peça desculpas se necessário e foque em resolver a situação rapidamente.';
      default:
        return '';
    }
  }, [analyzeMessageForReaction]);

  return {
    defaultReactionRules,
    analyzeMessageForReaction,
    sendReaction,
    processMessageForReaction,
    generateReactionPrompt
  };
};
