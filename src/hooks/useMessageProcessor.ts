
import { useCallback, useRef } from 'react';
import { ticketsService } from '@/services/ticketsService';

export const useMessageProcessor = (clientId: string) => {
  const processingRef = useRef<Set<string>>(new Set());

  const processNewMessage = useCallback(async (messageData: any) => {
    if (!clientId || !messageData) return;

    const messageId = messageData.id || messageData.message_id || `msg_${Date.now()}`;
    
    // Evitar processamento duplicado
    if (processingRef.current.has(messageId)) {
      console.log('⚠️ [PROCESSOR] Mensagem já em processamento:', messageId);
      return;
    }

    processingRef.current.add(messageId);

    try {
      console.log('📨 [PROCESSOR] Processando mensagem:', messageId);

      const chatId = messageData.chat_id || messageData.chatId || messageData.from;
      if (!chatId) {
        console.error('❌ [PROCESSOR] Chat ID não encontrado');
        return;
      }

      const customerPhone = chatId.replace(/\D/g, '');
      const customerName = messageData.sender || messageData.notifyName || 
                          customerPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      const messageContent = messageData.body || messageData.content || '[Mensagem]';

      // Criar/atualizar ticket
      const ticketId = await ticketsService.ensureTicketExists(
        clientId,
        chatId,
        clientId,
        customerName,
        customerPhone,
        messageContent,
        new Date(messageData.timestamp || Date.now()).toISOString()
      );

      // Adicionar mensagem ao ticket
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: messageId,
        from_me: messageData.from_me || messageData.fromMe || false,
        sender_name: customerName,
        content: messageContent,
        message_type: messageData.message_type || messageData.type || 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'received',
        timestamp: new Date(messageData.timestamp || Date.now()).toISOString(),
        media_url: messageData.media_url || messageData.mediaUrl || null
      });

      console.log('✅ [PROCESSOR] Mensagem processada:', messageId);

    } catch (error) {
      console.error('❌ [PROCESSOR] Erro ao processar mensagem:', error);
    } finally {
      processingRef.current.delete(messageId);
    }
  }, [clientId]);

  return { processNewMessage };
};
