
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { aiConfigService } from '@/services/aiConfigService';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  const channelRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const lastLoadTimeRef = useRef<number>(0);
  const initializationRef = useRef(false);
  const processingRef = useRef<Set<string>>(new Set());

  // Buscar instância ativa
  useEffect(() => {
    const findActiveInstance = async () => {
      try {
        const { data: instances } = await supabase
          .from('whatsapp_instances')
          .select('instance_id')
          .eq('client_id', clientId)
          .eq('status', 'connected')
          .limit(1);

        if (instances && instances.length > 0) {
          setInstanceId(instances[0].instance_id);
          console.log('📱 Instância ativa encontrada:', instances[0].instance_id);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar instâncias:', error);
      }
    };

    if (clientId) {
      findActiveInstance();
    }
  }, [clientId]);

  // Carregar tickets
  const loadTickets = useCallback(async () => {
    const now = Date.now();
    if (!clientId || !mountedRef.current || (now - lastLoadTimeRef.current) < 1000) {
      return;
    }
    
    try {
      lastLoadTimeRef.current = now;
      setIsLoading(true);
      console.log('🔄 Carregando tickets para cliente:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ Tickets carregados:', ticketsData.length);
      
      if (mountedRef.current) {
        setTickets(ticketsData);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tickets:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  // Processar com assistente IA - SIMPLIFICADO
  const processWithAssistant = useCallback(async (message: any, ticketId: string) => {
    if (!mountedRef.current || !ticketId || !instanceId) {
      console.log('❌ Componente desmontado, ticketId inválido ou instância não encontrada');
      processingRef.current.delete(ticketId);
      return;
    }
    
    console.log(`🤖 INICIANDO PROCESSAMENTO IA - Ticket: ${ticketId}`);
    
    try {
      setAssistantTyping(true);
      console.log('🤖 Assistente iniciou digitação');
      
      // Buscar configurações
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig?.openai_api_key) {
        console.log('⚠️ Configuração de IA não encontrada');
        setAssistantTyping(false);
        processingRef.current.delete(ticketId);
        return;
      }

      const activeQueue = queues.find(q => q.is_active && q.assistants?.is_active);
      if (!activeQueue?.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
        setAssistantTyping(false);
        processingRef.current.delete(ticketId);
        return;
      }

      const assistant = activeQueue.assistants;
      console.log(`🤖 Usando assistente: ${assistant.name}`);

      // Simular tempo de digitação realístico
      const messageLength = (message.body || '').length;
      const typingDuration = Math.max(2000, Math.min(8000, messageLength * 50));
      console.log(`⌨️ Duração de digitação simulada: ${typingDuration}ms`);
      
      await new Promise(resolve => setTimeout(resolve, typingDuration));

      // Preparar configurações
      let settings = { temperature: 0.7, max_tokens: 1000 };
      try {
        if (assistant.advanced_settings) {
          const parsed = typeof assistant.advanced_settings === 'string' 
            ? JSON.parse(assistant.advanced_settings)
            : assistant.advanced_settings;
          settings = {
            temperature: parsed.temperature || 0.7,
            max_tokens: parsed.max_tokens || 1000
          };
        }
      } catch (e) {
        console.error('Erro ao parse das configurações:', e);
      }

      const systemPrompt = `${assistant.prompt || 'Você é um assistente útil.'}\n\nContexto: Responda de forma natural e útil à mensagem do cliente.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message.body || message.caption || 'Mensagem recebida' }
      ];

      console.log('🚀 Enviando para OpenAI...');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || 'gpt-4o-mini',
          messages: messages,
          temperature: settings.temperature,
          max_tokens: settings.max_tokens,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro da OpenAI:', response.status, errorText);
        throw new Error(`Erro da OpenAI: ${response.status}`);
      }

      const data = await response.json();
      let assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse?.trim() && mountedRef.current) {
        console.log(`🤖 Resposta recebida (${assistantResponse.length} caracteres):`, assistantResponse.substring(0, 200));
        
        try {
          // Criar ID único para rastreamento
          const messageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Enviar via WhatsApp - CORRIGIDO
          console.log('📤 Enviando resposta via WhatsApp...');
          const sendResult = await whatsappService.sendMessage(instanceId, message.from, assistantResponse);
          console.log(`📤 Resultado do envio:`, sendResult);
          
          // Registrar no ticket
          await ticketsService.addTicketMessage({
            ticket_id: ticketId,
            message_id: messageId,
            from_me: true,
            sender_name: `🤖 ${assistant.name}`,
            content: assistantResponse,
            message_type: 'text',
            is_internal_note: false,
            is_ai_response: true,
            ai_confidence_score: 0.9,
            processing_status: 'completed',
            timestamp: new Date().toISOString()
          });

          console.log('✅ Resposta enviada e registrada');

          // Recarregar tickets após envio
          setTimeout(() => {
            if (mountedRef.current) {
              loadTickets();
            }
          }, 1500);

        } catch (sendError) {
          console.error(`❌ Erro ao enviar resposta:`, sendError);
        }
      }

    } catch (error) {
      console.error('❌ Erro CRÍTICO no processamento do assistente:', error);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
        console.log('🤖 Assistente parou de digitar');
      }
      processingRef.current.delete(ticketId);
    }
  }, [clientId, instanceId, loadTickets]);

  // Normalizar mensagem do WhatsApp
  const normalizeWhatsAppMessage = useCallback((message: any) => {
    console.log('📨 Normalizando mensagem WhatsApp:', {
      id: message.id,
      from: message.from,
      body: message.body?.substring(0, 50),
      fromMe: message.fromMe,
      timestamp: message.timestamp
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
                      message.senderName ||
                      phoneNumber;
    
    let content = message.body || 
                  message.caption || 
                  message.text || 
                  message.content ||
                  '';
    
    // Processar tipos de mídia
    if (message.type === 'image' || message.hasMedia) {
      content = `[Imagem] ${message.caption || 'Imagem enviada'}`;
    } else if (message.type === 'audio' || message.type === 'ptt') {
      content = `[Áudio] Mensagem de áudio`;
    } else if (message.type === 'video') {
      content = `[Vídeo] ${message.caption || 'Vídeo enviado'}`;
    } else if (message.type === 'document') {
      content = `[Documento] ${message.filename || 'Documento enviado'}`;
    }

    const timestamp = ticketsService.validateAndFixTimestamp(message.timestamp || message.t || Date.now());

    const normalizedMessage = {
      id: message.id || message.key?.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: chatId,
      fromMe: message.fromMe || false,
      body: content,
      type: message.type || 'text',
      timestamp: timestamp,
      author: message.author || customerName,
      notifyName: customerName,
      phoneNumber,
      customerName
    };

    console.log('✅ Mensagem normalizada:', {
      id: normalizedMessage.id,
      from: normalizedMessage.from,
      customerName: normalizedMessage.customerName,
      body: normalizedMessage.body.substring(0, 50),
      fromMe: normalizedMessage.fromMe
    });
    
    return normalizedMessage;
  }, []);

  // Processar mensagem recebida - SIMPLIFICADO
  const processMessage = useCallback(async (message: any) => {
    if (!mountedRef.current || !message || processedMessagesRef.current.has(message.id)) {
      return;
    }
    
    processedMessagesRef.current.add(message.id);
    console.log('📨 Processando mensagem nova:', {
      id: message.id,
      from: message.from,
      body: message.body?.substring(0, 50),
      fromMe: message.fromMe
    });
    
    const normalizedMessage = normalizeWhatsAppMessage(message);
    
    // Se for mensagem nossa, apenas salvar
    if (normalizedMessage.fromMe) {
      console.log('📤 Mensagem nossa, apenas salvando...');
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);
      return;
    }
    
    try {
      console.log('👤 Processando mensagem do cliente:', normalizedMessage.customerName);
      
      const ticketId = await ticketsService.createOrUpdateTicket(
        clientId,
        normalizedMessage.from,
        clientId,
        normalizedMessage.customerName,
        normalizedMessage.phoneNumber,
        normalizedMessage.body,
        normalizedMessage.timestamp
      );

      console.log('🎫 Ticket criado/atualizado:', ticketId);

      // Salvar mensagem
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: normalizedMessage.id,
        from_me: normalizedMessage.fromMe,
        sender_name: normalizedMessage.author,
        content: normalizedMessage.body,
        message_type: normalizedMessage.type,
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'received',
        timestamp: normalizedMessage.timestamp
      });

      console.log('💾 Mensagem salva no ticket');

      // Atualizar tickets
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);

      // Processamento com assistente
      if (!processingRef.current.has(ticketId)) {
        processingRef.current.add(ticketId);
        console.log(`🤖 INICIANDO processamento com assistente para ticket: ${ticketId}`);
        
        setTimeout(() => {
          if (mountedRef.current && processingRef.current.has(ticketId)) {
            processWithAssistant(normalizedMessage, ticketId);
          }
        }, 1500);
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }, [clientId, normalizeWhatsAppMessage, loadTickets, processWithAssistant]);

  // Configurar listeners - SIMPLIFICADO
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 Inicializando listeners para cliente:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    // Manter sempre online
    setIsOnline(true);

    loadTickets();

    try {
      const socket = whatsappService.connectSocket();
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('✅ WebSocket conectado para cliente:', clientId);
        whatsappService.joinClientRoom(clientId);
      });

      socket.on('disconnect', (reason: any) => {
        console.log('❌ WebSocket desconectado:', reason);
      });

      // Eventos de mensagem - SIMPLIFICADOS
      const messageEvents = [
        `message_${clientId}`,
        `new_message_${clientId}`,
        `whatsapp_message_${clientId}`,
        'message'
      ];

      messageEvents.forEach(eventName => {
        socket.on(eventName, (message: any) => {
          if (!mountedRef.current) return;
          
          console.log(`📨 Evento ${eventName} recebido:`, {
            id: message.id,
            from: message.from,
            body: message.body?.substring(0, 50),
            fromMe: message.fromMe
          });
          
          processMessage(message);
        });
      });

      // Canal do Supabase para mudanças nos tickets
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
            console.log('🔄 Mudança no banco detectada:', payload);
            if (mountedRef.current) {
              setTimeout(loadTickets, 1000);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

    } catch (error) {
      console.error('❌ Erro ao inicializar conexões:', error);
    }

    return () => {
      console.log('🔌 Limpando recursos...');
      mountedRef.current = false;
      initializationRef.current = false;
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      processedMessagesRef.current.clear();
      processingRef.current.clear();
    };
  }, [clientId, loadTickets, processMessage]);

  const reloadTickets = useCallback(() => {
    if (mountedRef.current) {
      loadTickets();
    }
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping,
    isOnline: true, // Sempre online
    reloadTickets
  };
};
