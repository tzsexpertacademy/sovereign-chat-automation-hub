
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
  const [isOnline, setIsOnline] = useState(true); // Sempre online para simplificar
  
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
    
    if (chatId?.includes('@g.us')) {
      customerName = message.chat?.name || customerName;
    }
    
    let content = message.body || 
                  message.caption || 
                  message.text || 
                  message.content ||
                  '';
    
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
    } else if (message.type === 'sticker') {
      content = `[Figurinha] Figurinha enviada`;
      messageType = 'sticker';
    } else if (message.type === 'location') {
      content = `[Localização] Localização compartilhada`;
      messageType = 'location';
    }
    
    if (message.quotedMessage || message.quotedMsg) {
      const quoted = message.quotedMessage || message.quotedMsg;
      const quotedContent = quoted.body || quoted.caption || '[Mídia citada]';
      content = `[Respondendo: "${quotedContent.substring(0, 50)}..."] ${content}`;
    }

    const timestamp = ticketsService.validateAndFixTimestamp(message.timestamp || message.t || Date.now());

    const normalizedMessage = {
      id: message.id || message.key?.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: chatId,
      fromMe: message.fromMe || false,
      body: content,
      type: messageType,
      timestamp: timestamp,
      author: message.author || customerName,
      notifyName: customerName,
      pushName: customerName,
      mediaUrl: message.mediaUrl || null,
      phoneNumber,
      customerName
    };

    console.log('✅ Mensagem normalizada:', {
      id: normalizedMessage.id,
      from: normalizedMessage.from,
      customerName: normalizedMessage.customerName,
      phoneNumber: normalizedMessage.phoneNumber,
      body: normalizedMessage.body.substring(0, 50),
      fromMe: normalizedMessage.fromMe,
      timestamp: normalizedMessage.timestamp
    });
    
    return normalizedMessage;
  }, []);

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

  // Processar com assistente IA
  const processWithAssistant = useCallback(async (message: any, ticketId: string, allMessages: any[] = []) => {
    if (!mountedRef.current || !ticketId || !instanceId) {
      console.log('❌ Componente desmontado, ticketId inválido ou instância não encontrada');
      processingRef.current.delete(ticketId);
      return;
    }
    
    console.log(`🤖 INICIANDO PROCESSAMENTO IA - Ticket: ${ticketId}`);
    
    try {
      setAssistantTyping(true);
      console.log('🤖 Assistente iniciou digitação');
      
      // Simular indicador de digitação por tempo realístico
      const messageLength = allMessages
        .filter(msg => !msg.fromMe)
        .map(msg => msg.body || '')
        .join(' ').length;
      
      const typingDuration = Math.max(2000, Math.min(8000, messageLength * 50));
      console.log(`⌨️ Duração de digitação simulada: ${typingDuration}ms`);
      
      // Buscar configurações
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig?.openai_api_key) {
        console.log('⚠️ Configuração de IA não encontrada');
        setAssistantTyping(false);
        return;
      }

      const activeQueue = queues.find(q => q.is_active && q.assistants?.is_active);
      if (!activeQueue?.assistants) {
        console.log('⚠️ Nenhuma fila ativa com assistente encontrada');
        setAssistantTyping(false);
        return;
      }

      const assistant = activeQueue.assistants;
      console.log(`🤖 Usando assistente: ${assistant.name}`);

      // Atualizar ticket
      await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: activeQueue.id,
          assigned_assistant_id: assistant.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      // Buscar contexto do banco
      const ticketMessages = await ticketsService.getTicketMessages(ticketId, 100);
      const contextMessages = ticketMessages.map(msg => ({
        role: msg.from_me ? 'assistant' : 'user',
        content: msg.content,
        timestamp: msg.timestamp,
        messageId: msg.message_id
      }));
      
      console.log(`📚 Contexto carregado: ${contextMessages.length} mensagens`);

      const currentBatchContent = allMessages
        .filter(msg => !msg.fromMe)
        .map(msg => msg.body || msg.caption || '[Mídia]')
        .join('\n');
      
      if (!currentBatchContent.trim()) {
        console.log('⚠️ Nenhuma mensagem nova do cliente para processar');
        setAssistantTyping(false);
        return;
      }

      // Aguardar tempo de digitação realístico
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

      // Prompt aprimorado
      const systemPrompt = `${assistant.prompt || 'Você é um assistente útil.'}\n\nContexto importante: 
- Você está respondendo mensagens do WhatsApp em tempo real
- Você tem acesso ao histórico COMPLETO de ${contextMessages.length} mensagens desta conversa
- O cliente enviou novas mensagens que você deve responder especificamente
- ANALISE TODO o contexto anterior para manter coerência na conversa
- NÃO repita informações já fornecidas anteriormente
- Responda de forma específica e relevante às NOVAS mensagens do cliente
- Mantenha a conversa natural e fluida
- Seja conciso mas completo`;

      const recentContext = contextMessages.slice(-50).filter(msg => msg.content && msg.content.trim());
      
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...recentContext,
        {
          role: 'user',
          content: `NOVA(S) MENSAGEM(S): ${currentBatchContent}`
        }
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
        throw new Error(`Erro da OpenAI: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      let assistantResponse = data.choices?.[0]?.message?.content;

      if (assistantResponse?.trim() && mountedRef.current) {
        console.log(`🤖 Resposta recebida (${assistantResponse.length} caracteres):`, assistantResponse.substring(0, 200));
        
        // Quebrar resposta em blocos se muito grande
        const maxLength = 1000;
        const messageBlocks = [];
        
        if (assistantResponse.length > maxLength) {
          let remaining = assistantResponse;
          while (remaining.length > 0) {
            let chunk = remaining.substring(0, maxLength);
            const lastPeriod = chunk.lastIndexOf('.');
            const lastSpace = chunk.lastIndexOf(' ');
            
            if (lastPeriod > maxLength * 0.7) {
              chunk = remaining.substring(0, lastPeriod + 1);
            } else if (lastSpace > maxLength * 0.7) {
              chunk = remaining.substring(0, lastSpace);
            }
            
            messageBlocks.push(chunk.trim());
            remaining = remaining.substring(chunk.length).trim();
          }
        } else {
          messageBlocks.push(assistantResponse);
        }
        
        console.log(`📝 Resposta dividida em ${messageBlocks.length} blocos`);
        
        // Enviar blocos em sequência
        for (let i = 0; i < messageBlocks.length; i++) {
          if (!mountedRef.current) break;
          
          const blockContent = messageBlocks[i];
          console.log(`📤 Enviando bloco ${i + 1}/${messageBlocks.length}`);
          
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          try {
            // Criar ID único para rastreamento
            const messageId = `ai_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Enviar via WhatsApp
            const sendResult = await whatsappService.sendMessage(instanceId, message.from, blockContent);
            console.log(`📤 Resultado do envio bloco ${i + 1}:`, sendResult);
            
            // Registrar no ticket
            await ticketsService.addTicketMessage({
              ticket_id: ticketId,
              message_id: messageId,
              from_me: true,
              sender_name: `🤖 ${assistant.name}`,
              content: blockContent,
              message_type: 'text',
              is_internal_note: false,
              is_ai_response: true,
              ai_confidence_score: 0.9,
              processing_status: 'completed',
              timestamp: new Date().toISOString()
            });
          } catch (sendError) {
            console.error(`❌ Erro ao enviar bloco ${i + 1}:`, sendError);
          }
        }

        console.log('✅ Resposta completa enviada');
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
  }, [clientId, instanceId]);

  // Processar mensagem recebida
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
        timestamp: normalizedMessage.timestamp,
        media_url: normalizedMessage.mediaUrl
      });

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
            processWithAssistant(normalizedMessage, ticketId, [message]);
          }
        }, 800);
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
    }
  }, [clientId, normalizeWhatsAppMessage, loadTickets, processWithAssistant]);

  // Configurar listeners
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 Inicializando listeners para cliente:', clientId);
    initializationRef.current = true;
    mountedRef.current = true;

    loadTickets();

    let socket: any = null;
    try {
      socket = whatsappService.connectSocket();
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('✅ WebSocket conectado para cliente:', clientId);
        whatsappService.joinClientRoom(clientId);
      });

      socket.on('disconnect', (reason: any) => {
        console.log('❌ WebSocket desconectado:', reason);
      });

      const events = [
        `message_${clientId}`,
        `new_message_${clientId}`,
        `whatsapp_message_${clientId}`,
        `message`,
        `message_${clientId}_instance_1750600195961`
      ];

      events.forEach(eventName => {
        socket.on(eventName, async (message: any) => {
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
    isOnline, // Sempre true para simplificar
    reloadTickets
  };
};
