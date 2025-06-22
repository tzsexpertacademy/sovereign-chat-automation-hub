
import { useCallback, useRef } from 'react';
import { ticketsService } from '@/services/ticketsService';
import { smartFormatPhone, extractPhoneFromChatId } from '@/utils/phoneFormatter';

export const useMessageProcessor = (clientId: string) => {
  const processingRef = useRef<Set<string>>(new Set());

  const processNewMessage = useCallback(async (messageData: any) => {
    if (!clientId || !messageData) {
      console.log('❌ [PROCESSOR] ClientId ou messageData inválido');
      return;
    }

    // Criar ID único para a mensagem
    const messageId = messageData.id || 
                     messageData.message_id || 
                     messageData.messageId ||
                     `msg_${Date.now()}_${Math.random()}`;
    
    // Evitar processamento duplicado
    if (processingRef.current.has(messageId)) {
      console.log('⚠️ [PROCESSOR] Mensagem já em processamento:', messageId);
      return;
    }

    processingRef.current.add(messageId);

    try {
      console.log('📨 [PROCESSOR] Processando nova mensagem:', {
        messageId,
        from: messageData.from,
        chatId: messageData.chat_id || messageData.chatId,
        body: messageData.body?.substring(0, 50)
      });

      // Extrair chat_id de diferentes formatos possíveis
      let chatId = messageData.chat_id || 
                   messageData.chatId || 
                   messageData.from ||
                   messageData.to;

      if (!chatId) {
        console.error('❌ [PROCESSOR] Chat ID não encontrado:', messageData);
        return;
      }

      // Normalizar chatId se necessário
      if (!chatId.includes('@')) {
        const phoneData = smartFormatPhone(chatId);
        chatId = phoneData.chatId;
      }

      // Extrair número limpo do chatId
      const cleanPhone = extractPhoneFromChatId(chatId);
      const phoneData = smartFormatPhone(cleanPhone);

      console.log('📞 [PROCESSOR] Dados do telefone processados:', {
        originalChatId: messageData.chat_id || messageData.chatId,
        normalizedChatId: chatId,
        cleanPhone,
        formattedPhone: phoneData.displayNumber,
        isValid: phoneData.isValid
      });

      // Validar se é um número válido
      if (!phoneData.isValid) {
        console.log('⚠️ [PROCESSOR] Número de telefone inválido, ignorando:', cleanPhone);
        return;
      }

      // Nome do cliente (prioritizar sender, depois notifyName, depois número formatado)
      const customerName = messageData.sender || 
                          messageData.notifyName ||
                          messageData.senderName ||
                          phoneData.displayNumber ||
                          `Contato ${cleanPhone.slice(-4)}`;

      // Conteúdo da mensagem
      const messageContent = messageData.body || 
                            messageData.content || 
                            messageData.text ||
                            '[Mensagem sem conteúdo]';

      // Timestamp da mensagem
      const messageTimestamp = messageData.timestamp ? 
                              new Date(messageData.timestamp).toISOString() :
                              new Date().toISOString();

      console.log('🎫 [PROCESSOR] Criando/atualizando ticket:', {
        customerName,
        chatId,
        cleanPhone,
        messagePreview: messageContent.substring(0, 100)
      });

      // Buscar instanceId do cliente
      const { data: client, error: clientError } = await (await import('@/integrations/supabase/client')).supabase
        .from('clients')
        .select('instance_id')
        .eq('id', clientId)
        .single();

      if (clientError || !client?.instance_id) {
        console.error('❌ [PROCESSOR] Cliente não encontrado ou sem instância:', clientError);
        return;
      }

      const instanceId = client.instance_id;

      // Criar/atualizar ticket
      const ticketId = await ticketsService.ensureTicketExists(
        clientId,
        chatId,
        instanceId,
        customerName,
        cleanPhone,
        messageContent,
        messageTimestamp
      );

      console.log('✅ [PROCESSOR] Ticket garantido:', ticketId);

      // Adicionar mensagem ao ticket apenas se não for nossa própria mensagem
      const isFromMe = messageData.from_me || 
                      messageData.fromMe || 
                      messageData.key?.fromMe ||
                      false;

      if (!isFromMe) {
        await ticketsService.addTicketMessage({
          ticket_id: ticketId,
          message_id: messageId,
          from_me: false,
          sender_name: customerName,
          content: messageContent,
          message_type: messageData.message_type || messageData.type || 'text',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'received',
          timestamp: messageTimestamp,
          media_url: messageData.media_url || messageData.mediaUrl || null
        });

        console.log('✅ [PROCESSOR] Mensagem adicionada ao ticket:', messageId);
      } else {
        console.log('📤 [PROCESSOR] Mensagem própria ignorada:', messageId);
      }

    } catch (error: any) {
      console.error('❌ [PROCESSOR] Erro ao processar mensagem:', {
        error: error.message,
        messageId,
        stack: error.stack
      });
    } finally {
      processingRef.current.delete(messageId);
    }
  }, [clientId]);

  return { processNewMessage };
};
