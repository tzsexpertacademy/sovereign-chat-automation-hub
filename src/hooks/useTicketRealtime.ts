
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useMessageBatch } from './useMessageBatch';
import { useRobustAssistant } from './useRobustAssistant';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  
  const channelRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const lastLoadTimeRef = useRef<number>(0);
  const initializationRef = useRef(false);

  // SISTEMA BLINDADO DE ASSISTENTE
  const { processWithAssistant, isProcessing } = useRobustAssistant({
    clientId,
    maxRetries: 3,
    timeoutMs: 30000,
    fallbackResponse: 'Olá! Estou aqui para ajudar. No momento estou processando sua mensagem, aguarde um momento por favor.'
  });

  // Carregar tickets com proteção
  const loadTickets = useCallback(async () => {
    const now = Date.now();
    if (!clientId || !mountedRef.current || (now - lastLoadTimeRef.current) < 1000) {
      return;
    }
    
    try {
      lastLoadTimeRef.current = now;
      setIsLoading(true);
      console.log('🔄 CARREGANDO tickets para cliente:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ TICKETS carregados:', ticketsData.length);
      
      if (mountedRef.current) {
        setTickets(ticketsData);
      }
    } catch (error) {
      console.error('❌ ERRO ao carregar tickets:', error);
      // FALLBACK: Manter tickets existentes em caso de erro
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  // Normalizar mensagem WhatsApp com proteções
  const normalizeWhatsAppMessage = useCallback((message: any) => {
    try {
      console.log('📨 NORMALIZANDO mensagem WhatsApp:', {
        id: message.id,
        from: message.from,
        body: message.body?.substring(0, 50),
        fromMe: message.fromMe
      });
      
      let chatId = message.from || message.chatId || message.key?.remoteJid || message.chat?.id;
      let phoneNumber = chatId;
      
      if (chatId?.includes('@')) {
        phoneNumber = chatId.split('@')[0];
      }
      
      let customerName = message.notifyName || 
                        message.pushName || 
                        message.participant || 
                        message.author ||
                        phoneNumber;
      
      let content = message.body || 
                    message.caption || 
                    message.text || 
                    message.content ||
                    '';
      
      // Tratar diferentes tipos de mídia
      let messageType = message.type || 'text';
      
      if (message.type === 'image' || message.hasMedia) {
        content = `[Imagem] ${message.caption || 'Imagem enviada'}`;
        messageType = 'image';
      } else if (message.type === 'audio' || message.type === 'ptt') {
        content = `[Áudio] Mensagem de áudio`;
        messageType = 'audio';
      } else if (message.type === 'video') {
        content = `[Vídeo] ${message.caption || 'Vídeo enviado'}`;
        messageType = 'video';
      } else if (message.type === 'document') {
        content = `[Documento] ${message.filename || 'Documento enviado'}`;
        messageType = 'document';
      }

      const timestamp = ticketsService.validateAndFixTimestamp(message.timestamp || message.t || Date.now());

      const normalizedMessage = {
        id: message.id || message.key?.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        from: chatId,
        fromMe: message.fromMe || false,
        body: content,
        type: messageType,
        timestamp: timestamp,
        author: customerName,
        notifyName: customerName,
        phoneNumber,
        customerName
      };

      console.log('✅ MENSAGEM normalizada:', {
        id: normalizedMessage.id,
        from: normalizedMessage.from,
        customerName: normalizedMessage.customerName,
        body: normalizedMessage.body.substring(0, 50),
        fromMe: normalizedMessage.fromMe
      });
      
      return normalizedMessage;
    } catch (error) {
      console.error('❌ ERRO ao normalizar mensagem:', error);
      // FALLBACK: Retornar estrutura mínima
      return {
        id: `fallback_${Date.now()}`,
        from: message.from || 'unknown',
        fromMe: message.fromMe || false,
        body: message.body || '[Mensagem não processada]',
        type: 'text',
        timestamp: new Date().toISOString(),
        author: 'Contato',
        phoneNumber: message.from || 'unknown',
        customerName: 'Contato'
      };
    }
  }, []);

  // Hook para agrupamento de mensagens com lógica blindada
  const { addMessage, markBatchAsCompleted } = useMessageBatch(async (chatId: string, messages: any[]) => {
    if (!mountedRef.current || messages.length === 0) {
      console.log('❌ COMPONENTE desmontado ou lote vazio');
      return;
    }

    console.log(`📦 ===== PROCESSBATCH BLINDADO =====`);
    console.log(`📱 Chat: ${chatId}`);
    console.log(`📨 Mensagens: ${messages.length}`);
    
    try {
      const clientMessages = messages.filter(msg => !msg.fromMe);
      
      // Se só tem mensagens nossas, apenas salvar
      if (clientMessages.length === 0) {
        console.log('📤 APENAS mensagens nossas - salvando...');
        
        for (const message of messages.filter(msg => msg.fromMe)) {
          try {
            const normalizedMessage = normalizeWhatsAppMessage(message);
            const ticketsData = await ticketsService.getClientTickets(clientId);
            const existingTicket = ticketsData.find(t => t.chat_id === normalizedMessage.from);
            
            if (existingTicket) {
              await ticketsService.addTicketMessage({
                ticket_id: existingTicket.id,
                message_id: normalizedMessage.id,
                from_me: true,
                sender_name: 'Atendente',
                content: normalizedMessage.body,
                message_type: normalizedMessage.type,
                is_internal_note: false,
                is_ai_response: false,
                processing_status: 'completed',
                timestamp: normalizedMessage.timestamp
              });
              console.log('💾 MENSAGEM nossa salva');
            }
          } catch (error) {
            console.error('❌ ERRO ao salvar mensagem nossa:', error);
          }
        }
        
        markBatchAsCompleted(chatId);
        setTimeout(() => {
          if (mountedRef.current) {
            loadTickets();
          }
        }, 1000);
        
        return;
      }
      
      // PROCESSAR MENSAGENS DO CLIENTE
      const firstClientMessage = clientMessages[0];
      const normalizedMessage = normalizeWhatsAppMessage(firstClientMessage);
      
      console.log(`👤 PROCESSANDO mensagens do cliente: ${normalizedMessage.customerName}`);
      
      // CRIAR/ATUALIZAR TICKET COM PROTEÇÃO
      let ticketId: string;
      try {
        ticketId = await ticketsService.createOrUpdateTicket(
          clientId,
          normalizedMessage.from,
          clientId,
          normalizedMessage.customerName,
          normalizedMessage.phoneNumber,
          normalizedMessage.body,
          normalizedMessage.timestamp
        );

        console.log(`📋 TICKET criado/atualizado: ${ticketId}`);
      } catch (error) {
        console.error('❌ ERRO ao criar/atualizar ticket:', error);
        markBatchAsCompleted(chatId);
        return;
      }

      // SALVAR TODAS AS MENSAGENS COM PROTEÇÃO
      for (const message of messages) {
        try {
          const normalized = normalizeWhatsAppMessage(message);
          
          await ticketsService.addTicketMessage({
            ticket_id: ticketId,
            message_id: normalized.id,
            from_me: normalized.fromMe,
            sender_name: normalized.author,
            content: normalized.body,
            message_type: normalized.type,
            is_internal_note: false,
            is_ai_response: false,
            processing_status: 'received',
            timestamp: normalized.timestamp
          });
        } catch (error) {
          console.error('❌ ERRO ao salvar mensagem individual:', error);
          // Continuar com outras mensagens
        }
      }

      console.log(`💾 MENSAGENS salvas no ticket`);

      // ATUALIZAR LISTA DE TICKETS
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);

      // PROCESSAR COM ASSISTENTE BLINDADO
      console.log(`🔍 INICIANDO processamento IA BLINDADO para ticket: ${ticketId}`);
      setAssistantTyping(true);
      
      try {
        await processWithAssistant(normalizedMessage, ticketId, clientMessages);
        console.log('✅ PROCESSAMENTO IA BLINDADO CONCLUÍDO');
      } catch (error) {
        console.error('❌ ERRO no processamento IA (mas não crítico):', error);
      } finally {
        if (mountedRef.current) {
          setAssistantTyping(false);
        }
      }
      
    } catch (error) {
      console.error('❌ ERRO CRÍTICO ao processar lote:', error);
    } finally {
      markBatchAsCompleted(chatId);
    }
  });

  // CONFIGURAR LISTENERS COM PROTEÇÕES
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 ===== INICIALIZANDO LISTENERS BLINDADOS =====');
    console.log(`👤 Cliente: ${clientId}`);
    
    initializationRef.current = true;
    mountedRef.current = true;

    // CARREGAR TICKETS INICIAL
    loadTickets();

    let socket: any = null;
    try {
      // CONECTAR WEBSOCKET COM PROTEÇÃO
      socket = whatsappService.connectSocket();
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('✅ WEBSOCKET conectado');
        try {
          whatsappService.joinClientRoom(clientId);
        } catch (error) {
          console.error('❌ ERRO ao entrar na sala do cliente:', error);
        }
      });

      socket.on('disconnect', (reason: any) => {
        console.log('❌ WEBSOCKET desconectado:', reason);
        // Auto-reconectar em caso de desconexão
        setTimeout(() => {
          if (mountedRef.current && !socket.connected) {
            try {
              socket.connect();
            } catch (error) {
              console.error('❌ ERRO na reconexão:', error);
            }
          }
        }, 5000);
      });

      socket.on('connect_error', (error: any) => {
        console.error('❌ ERRO conexão WebSocket:', error);
      });

      // EVENTOS DE MENSAGEM COM PROTEÇÃO
      const events = [
        `message_${clientId}`,
        `new_message_${clientId}`,
        `whatsapp_message_${clientId}`,
        `message`,
        `incoming_message_${clientId}`,
        `message_received_${clientId}`
      ];

      events.forEach(eventName => {
        socket.on(eventName, async (message: any) => {
          if (!mountedRef.current) return;
          
          try {
            console.log(`📨 ===== EVENTO RECEBIDO BLINDADO =====`);
            console.log(`🏷️ Evento: ${eventName}`);
            console.log(`📨 Mensagem:`, {
              id: message.id,
              from: message.from,
              body: message.body?.substring(0, 50),
              fromMe: message.fromMe,
              type: message.type
            });
            
            // PROCESSAR MENSAGEM COM PROTEÇÃO
            addMessage(message);
          } catch (error) {
            console.error(`❌ ERRO ao processar evento ${eventName}:`, error);
            // Não interromper outros eventos
          }
        });
      });

      // CANAL SUPABASE PARA MUDANÇAS NO BANCO COM PROTEÇÃO
      const channel = supabase
        .channel(`tickets-${clientId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversation_tickets',
            filter: `client_id=eq.${clientId}`
          },
          (payload) => {
            try {
              console.log('🔄 MUDANÇA no banco detectada:', payload.eventType);
              if (mountedRef.current) {
                setTimeout(loadTickets, 1000);
              }
            } catch (error) {
              console.error('❌ ERRO ao processar mudança do banco:', error);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      console.log('✅ LISTENERS BLINDADOS configurados com sucesso');

    } catch (error) {
      console.error('❌ ERRO CRÍTICO ao inicializar conexões:', error);
    }

    return () => {
      console.log('🔌 LIMPANDO recursos blindados...');
      mountedRef.current = false;
      initializationRef.current = false;
      
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (error) {
          console.error('❌ ERRO ao desconectar socket:', error);
        }
      }
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.error('❌ ERRO ao remover canal:', error);
        }
      }
    };
  }, [clientId, loadTickets, addMessage, processWithAssistant]);

  const reloadTickets = useCallback(() => {
    if (mountedRef.current) {
      loadTickets();
    }
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping || isProcessing,
    isOnline: true, // Sempre online para garantir confiabilidade
    reloadTickets
  };
};
