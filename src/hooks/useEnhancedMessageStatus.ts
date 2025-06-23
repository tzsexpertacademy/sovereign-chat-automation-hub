
import { useState, useCallback, useRef } from 'react';
import { whatsappService } from '@/services/whatsappMultiClient';

export type EnhancedMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'ai_read' | 'failed';

interface MessageStatusState {
  [messageId: string]: {
    status: EnhancedMessageStatus;
    timestamp: string;
    readByAI?: boolean;
    aiReadTimestamp?: string;
  };
}

export const useEnhancedMessageStatus = (instanceId: string) => {
  const [messageStatuses, setMessageStatuses] = useState<MessageStatusState>({});
  const processingRef = useRef<Set<string>>(new Set());

  // Atualizar status com confirmação visual aprimorada
  const updateMessageStatus = useCallback((
    messageId: string, 
    status: EnhancedMessageStatus,
    metadata?: { readByAI?: boolean }
  ) => {
    console.log(`📱 Status da mensagem ${messageId}: ${status}`, metadata);
    
    setMessageStatuses(prev => ({
      ...prev,
      [messageId]: {
        ...prev[messageId],
        status,
        timestamp: new Date().toISOString(),
        ...(metadata?.readByAI && {
          readByAI: true,
          aiReadTimestamp: new Date().toISOString()
        })
      }
    }));
  }, []);

  // Marcar como lida pela IA com confirmação visual
  const markAsReadByAI = useCallback(async (chatId: string, messageId: string) => {
    if (processingRef.current.has(messageId)) return;
    
    try {
      processingRef.current.add(messageId);
      console.log(`🤖✓✓ Marcando como lida pela IA: ${messageId}`);
      
      // Enviar confirmação de leitura para WhatsApp
      await whatsappService.markAsRead(instanceId, chatId, messageId);
      
      // Atualizar status local
      updateMessageStatus(messageId, 'ai_read', { readByAI: true });
      
      console.log(`✅ Confirmação de leitura IA enviada para ${messageId}`);
      
    } catch (error) {
      console.error('❌ Erro ao marcar como lida pela IA:', error);
      updateMessageStatus(messageId, 'delivered');
    } finally {
      processingRef.current.delete(messageId);
    }
  }, [instanceId, updateMessageStatus]);

  // Processar lote de mensagens com confirmações
  const processBatchReadConfirmations = useCallback(async (chatId: string, messageIds: string[]) => {
    console.log(`📦 Processando lote de confirmações para ${messageIds.length} mensagens`);
    
    // Processar em sequência para evitar spam
    for (const messageId of messageIds) {
      if (!processingRef.current.has(messageId)) {
        await markAsReadByAI(chatId, messageId);
        
        // Delay pequeno entre confirmações para parecer natural
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      }
    }
  }, [markAsReadByAI]);

  // Simular progressão de status natural
  const simulateMessageDelivery = useCallback(async (messageId: string, chatId: string) => {
    // 1. Enviando
    updateMessageStatus(messageId, 'sending');
    
    // 2. Enviado (delay realístico)
    setTimeout(() => {
      updateMessageStatus(messageId, 'sent');
    }, 500 + Math.random() * 1000);
    
    // 3. Entregue (delay adicional)
    setTimeout(() => {
      updateMessageStatus(messageId, 'delivered');
    }, 1500 + Math.random() * 2000);
    
    // 4. Lido automaticamente pela IA após um tempo
    setTimeout(async () => {
      await markAsReadByAI(chatId, messageId);
    }, 3000 + Math.random() * 5000);
  }, [updateMessageStatus, markAsReadByAI]);

  // Obter status com informações visuais
  const getMessageStatusInfo = useCallback((messageId: string) => {
    const statusData = messageStatuses[messageId];
    if (!statusData) return { status: 'sent', icon: '✓', color: 'gray' };
    
    switch (statusData.status) {
      case 'sending':
        return { status: 'sending', icon: '⏳', color: 'gray', text: 'Enviando...' };
      case 'sent':
        return { status: 'sent', icon: '✓', color: 'gray', text: 'Enviado' };
      case 'delivered':
        return { status: 'delivered', icon: '✓✓', color: 'gray', text: 'Entregue' };
      case 'read':
        return { status: 'read', icon: '✓✓', color: 'blue', text: 'Lido' };
      case 'ai_read':
        return { 
          status: 'ai_read', 
          icon: '✓✓', 
          color: 'blue', 
          text: 'IA ✓✓',
          isAIRead: true
        };
      case 'failed':
        return { status: 'failed', icon: '❌', color: 'red', text: 'Falha' };
      default:
        return { status: 'sent', icon: '✓', color: 'gray', text: 'Enviado' };
    }
  }, [messageStatuses]);

  return {
    messageStatuses,
    updateMessageStatus,
    markAsReadByAI,
    processBatchReadConfirmations,
    simulateMessageDelivery,
    getMessageStatusInfo
  };
};
