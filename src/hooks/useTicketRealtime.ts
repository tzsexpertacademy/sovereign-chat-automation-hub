import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { queuesService } from '@/services/queuesService';
import { aiConfigService } from '@/services/aiConfigService';
import { audioService } from '@/services/audioService';
import { useHumanizedTyping } from './useHumanizedTyping';
import { useAutoReactions } from './useAutoReactions';
import { useOnlineStatus } from './useOnlineStatus';
import { useSmartMessageSplit } from './useSmartMessageSplit';
import { useMessageBatch } from './useMessageBatch';
import { useMessageStatus } from './useMessageStatus';

export const useTicketRealtime = (clientId: string) => {
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  
  const channelRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const lastLoadTimeRef = useRef<number>(0);
  const initializationRef = useRef(false);
  const processingRef = useRef<Set<string>>(new Set());

  // Hooks humanizados
  const { simulateHumanTyping, markAsRead, isTyping, isRecording } = useHumanizedTyping(clientId);
  const { processMessage: processReaction } = useAutoReactions(clientId, true);
  const { isOnline, markActivity } = useOnlineStatus(clientId, true);
  const { splitMessage } = useSmartMessageSplit();
  const { simulateMessageProgression } = useMessageStatus();

  // Função para normalizar dados da mensagem do WhatsApp - COM LOGS DETALHADOS
  const normalizeWhatsAppMessage = useCallback((message: any) => {
    console.log('🔧 ===== NORMALIZANDO MENSAGEM WHATSAPP =====');
    console.log('📱 MENSAGEM ORIGINAL RECEBIDA:', JSON.stringify(message, null, 2));
    
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
    let mediaUrl = null;
    let mediaData = null;

    console.log('📊 DADOS BÁSICOS EXTRAÍDOS:', {
      chatId,
      phoneNumber,
      customerName,
      messageType,
      hasContent: !!content
    });

    // Processar diferentes tipos de mídia - COM LOGS DETALHADOS
    if (message.type === 'image' || (message.hasMedia && message.type !== 'audio' && message.type !== 'ptt')) {
      content = `[Imagem] ${message.caption || 'Imagem enviada'}`;
      messageType = 'image';
      mediaUrl = message.mediaUrl;
      mediaData = message.mediaData;
      console.log('🖼️ PROCESSANDO IMAGEM:', { mediaUrl: !!mediaUrl, mediaData: !!mediaData });
    } else if (message.type === 'audio' || message.type === 'ptt') {
      content = `[Áudio] Mensagem de áudio`;
      messageType = 'audio';
      mediaUrl = message.mediaUrl;
      mediaData = message.mediaData;
      
      console.log('🎵 ===== PROCESSANDO MENSAGEM DE ÁUDIO =====');
      console.log('📊 DADOS DE ÁUDIO DETECTADOS:', {
        messageType,
        hasMediaUrl: !!mediaUrl,
        hasMediaData: !!mediaData,
        mediaUrlValue: mediaUrl,
        mediaDataLength: mediaData?.length || 0,
        hasMedia: message.hasMedia,
        allAudioKeys: Object.keys(message).filter(key => 
          key.toLowerCase().includes('audio') || 
          key.toLowerCase().includes('media') || 
          key.toLowerCase().includes('data')
        )
      });
      
      // VERIFICAR TODAS AS POSSÍVEIS PROPRIEDADES DE ÁUDIO
      const possibleAudioProps = [
        'mediaData', 'audioData', 'data', 'base64', 'buffer', 'content',
        'fileData', 'attachment', 'media', 'audioBase64', 'mediaBase64'
      ];
      
      console.log('🔍 VERIFICANDO PROPRIEDADES DE ÁUDIO NA MENSAGEM:');
      for (const prop of possibleAudioProps) {
        if (message[prop]) {
          console.log(`✅ ENCONTRADO ${prop}:`, {
            type: typeof message[prop],
            length: message[prop]?.length,
            isString: typeof message[prop] === 'string',
            preview: typeof message[prop] === 'string' ? message[prop].substring(0, 50) : 'not string'
          });
        }
      }
      
    } else if (message.type === 'video') {
      content = `[Vídeo] ${message.caption || 'Vídeo enviado'}`;
      messageType = 'video';
      mediaUrl = message.mediaUrl;
      mediaData = message.mediaData;
      console.log('🎬 PROCESSANDO VÍDEO:', { mediaUrl: !!mediaUrl, mediaData: !!mediaData });
    } else if (message.type === 'document') {
      content = `[Documento] ${message.filename || 'Documento enviado'}`;
      messageType = 'document';
      mediaUrl = message.mediaUrl;
      mediaData = message.mediaData;
      console.log('📄 PROCESSANDO DOCUMENTO:', { mediaUrl: !!mediaUrl, mediaData: !!mediaData });
    } else if (message.type === 'sticker') {
      content = `[Figurinha] Figurinha enviada`;
      messageType = 'sticker';
      mediaUrl = message.mediaUrl;
      mediaData = message.mediaData;
      console.log('🎭 PROCESSANDO FIGURINHA:', { mediaUrl: !!mediaUrl, mediaData: !!mediaData });
    } else if (message.type === 'location') {
      content = `[Localização] Localização compartilhada`;
      messageType = 'location';
      console.log('📍 PROCESSANDO LOCALIZAÇÃO');
    }
    
    if (message.quotedMessage || message.quotedMsg) {
      const quoted = message.quotedMessage || message.quotedMsg;
      const quotedContent = quoted.body || quoted.caption || '[Mídia citada]';
      content = `[Respondendo: "${quotedContent.substring(0, 50)}..."] ${content}`;
      console.log('💬 MENSAGEM COM CITAÇÃO DETECTADA');
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
      mediaUrl,
      mediaData,
      phoneNumber,
      customerName,
      hasMedia: message.hasMedia,
      // PRESERVAR MENSAGEM ORIGINAL COMPLETA PARA PROCESSAMENTO DE ÁUDIO
      originalMessage: message
    };
    
    console.log('✅ MENSAGEM NORMALIZADA:', {
      id: normalizedMessage.id,
      type: normalizedMessage.type,
      hasMediaData: !!normalizedMessage.mediaData,
      hasOriginalMessage: !!normalizedMessage.originalMessage,
      fromMe: normalizedMessage.fromMe
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
      console.log('🔄 CARREGANDO tickets para cliente:', clientId);
      
      const ticketsData = await ticketsService.getClientTickets(clientId);
      console.log('✅ TICKETS carregados:', ticketsData.length);
      
      if (mountedRef.current) {
        setTickets(ticketsData);
      }
    } catch (error) {
      console.error('❌ ERRO ao carregar tickets:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [clientId]);

  // PROCESSAMENTO COM ASSISTENTE - VERSÃO COM LOGS SUPER DETALHADOS PARA ÁUDIO
  const processWithAssistant = useCallback(async (message: any, ticketId: string, allMessages: any[] = []) => {
    const processingKey = `${ticketId}_${Date.now()}`;
    
    if (!mountedRef.current || !ticketId || processingRef.current.has(ticketId)) {
      console.log(`❌ BLOQUEANDO processamento duplicado para ticket: ${ticketId}`);
      return;
    }
    
    processingRef.current.add(ticketId);
    console.log(`🤖 ===== INICIANDO PROCESSAMENTO IA (${processingKey}) =====`);
    console.log(`📨 MENSAGENS PARA PROCESSAR: ${allMessages.length}`);
    
    // LOG DETALHADO DAS MENSAGENS
    allMessages.forEach((msg, index) => {
      console.log(`📨 MENSAGEM ${index + 1}:`, {
        id: msg.id,
        type: msg.type,
        fromMe: msg.fromMe,
        hasOriginalMessage: !!msg.originalMessage,
        hasMediaData: !!msg.mediaData,
        body: msg.body?.substring(0, 50)
      });
    });
    
    try {
      setAssistantTyping(true);
      markActivity();
      
      // BUSCAR CONFIGURAÇÕES
      const [queues, aiConfig] = await Promise.all([
        queuesService.getClientQueues(clientId),
        aiConfigService.getClientConfig(clientId)
      ]);

      if (!aiConfig?.openai_api_key) {
        console.log('❌ SEM configuração de IA - PARANDO');
        return;
      }

      const activeQueue = queues.find(q => q.is_active && q.assistants?.is_active);
      if (!activeQueue?.assistants) {
        console.log('❌ NENHUMA fila ativa com assistente');
        return;
      }

      const assistant = activeQueue.assistants;

      // INSTÂNCIA WHATSAPP
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId)
        .eq('status', 'connected')
        .limit(1);

      if (!instances || instances.length === 0) {
        console.log('❌ NENHUMA instância conectada');
        return;
      }

      const instanceId = instances[0].instance_id;

      // ATUALIZAR TICKET
      await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: activeQueue.id,
          assigned_assistant_id: assistant.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      // CONTEXTO
      const ticketMessages = await ticketsService.getTicketMessages(ticketId);
      
      // CONFIGURAÇÕES
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
        console.error('ERRO ao parse das configurações:', e);
      }

      // PROCESSAR MENSAGENS COM ÁUDIO - VERSÃO COM LOGS SUPER DETALHADOS
      let processedContent = '';
      
      console.log('🎵 ===== PROCESSANDO MENSAGENS PARA IA (LOGS DETALHADOS) =====');
      
      const clientMessages = allMessages.filter(m => !m.fromMe);
      console.log(`👤 MENSAGENS DO CLIENTE PARA PROCESSAR: ${clientMessages.length}`);
      
      for (let i = 0; i < clientMessages.length; i++) {
        const msg = clientMessages[i];
        console.log(`📨 PROCESSANDO MENSAGEM ${i + 1}/${clientMessages.length}:`, {
          id: msg.id,
          type: msg.type,
          hasOriginalMessage: !!msg.originalMessage,
          hasMediaData: !!msg.mediaData
        });
        
        if (msg.type === 'audio' || msg.type === 'ptt') {
          console.log('🎵 ===== DETECTADO ÁUDIO - INICIANDO TRANSCRIÇÃO DETALHADA =====');
          console.log('📱 DADOS COMPLETOS DA MENSAGEM DE ÁUDIO:', JSON.stringify(msg, null, 2));
          
          try {
            // USAR A MENSAGEM COMPLETA (com todas as propriedades) + LOGS DETALHADOS
            const fullMessage = {
              ...msg,
              ...msg.originalMessage,
              // Garantir que todas as propriedades estejam disponíveis
              mediaData: msg.mediaData || msg.originalMessage?.mediaData,
              mediaUrl: msg.mediaUrl || msg.originalMessage?.mediaUrl,
              hasMedia: msg.hasMedia || msg.originalMessage?.hasMedia
            };
            
            console.log('🔍 ===== MENSAGEM COMPLETA PARA PROCESSAMENTO =====');
            console.log('📊 ESTRUTURA FINAL:', JSON.stringify(fullMessage, null, 2));
            console.log('📊 VERIFICAÇÕES FINAIS:', {
              hasFullMessage: !!fullMessage,
              messageId: fullMessage.id || 'N/A',
              hasMediaData: !!fullMessage.mediaData,
              mediaDataLength: fullMessage.mediaData?.length || 0,
              hasMediaUrl: !!fullMessage.mediaUrl,
              mediaUrl: fullMessage.mediaUrl,
              messageType: fullMessage.type,
              hasMedia: fullMessage.hasMedia,
              allProps: Object.keys(fullMessage)
            });
            
            console.log('🚀 CHAMANDO audioService.processWhatsAppAudio...');
            const audioResult = await audioService.processWhatsAppAudio(fullMessage, clientId);
            
            const transcriptionText = audioResult.transcription || '[Áudio não transcrito]';
            processedContent += `[Mensagem de áudio transcrita]: "${transcriptionText}"\n`;
            
            console.log('✅ TRANSCRIÇÃO DE ÁUDIO CONCLUÍDA:', {
              originalBody: msg.body?.substring(0, 50),
              transcription: transcriptionText.substring(0, 100),
              transcriptionLength: transcriptionText.length,
              success: !!audioResult.transcription && !audioResult.transcription.includes('[Áudio não')
            });
            
            // Salvar transcrição no banco
            try {
              const updateData: any = {
                content: `${msg.body} - Transcrição: ${transcriptionText}`,
                media_transcription: transcriptionText,
                processing_status: 'completed'
              };

              if (audioResult.audioBase64) {
                updateData.audio_base64 = audioResult.audioBase64;
                console.log('💾 SALVANDO dados de áudio base64 no banco (tamanho:', audioResult.audioBase64.length, ')');
              }

              await supabase
                .from('ticket_messages')
                .update(updateData)
                .eq('message_id', msg.id);
                
              console.log('💾 TRANSCRIÇÃO SALVA NO BANCO DE DADOS COM SUCESSO');
              
            } catch (saveError) {
              console.error('⚠️ ERRO ao salvar transcrição no banco:', saveError);
            }
              
          } catch (audioError) {
            console.error('❌ ERRO CRÍTICO ao processar áudio:', audioError);
            console.error('💥 Stack trace:', audioError.stack);
            processedContent += `[Áudio não processado - ${audioError.message}]: ${msg.body || 'Mensagem de áudio'}\n`;
          }
        } else {
          processedContent += `${msg.body || msg.caption || '[Mídia]'}\n`;
          console.log(`📝 MENSAGEM TEXTO ADICIONADA: ${(msg.body || msg.caption || '[Mídia]').substring(0, 50)}`);
        }
      }

      if (!processedContent.trim()) {
        console.log('⚠️ NENHUMA mensagem nova do cliente para processar');
        return;
      }

      console.log('🧠 ===== PREPARANDO CONTEXTO PARA IA =====');
      console.log('📝 Conteúdo processado final:', processedContent.substring(0, 200) + '...');

      // CONTEXTO PARA IA - usar verificação segura para campos de áudio
      const contextMessages = ticketMessages.map(msg => {
        const messageContent = (msg as any).media_transcription || msg.content;
        return {
          role: msg.from_me ? 'assistant' : 'user',
          content: messageContent
        };
      });

      const systemPrompt = `${assistant.prompt || 'Você é um assistente útil.'}\n\nVocê está respondendo mensagens do WhatsApp. Responda de forma específica às novas mensagens do cliente considerando o contexto da conversa. Quando o cliente envia áudio, você receberá a transcrição do que foi falado.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...contextMessages.slice(-10),
        { role: 'user', content: `NOVA MENSAGEM: ${processedContent}` }
      ];

      console.log(`🚀 ENVIANDO para OpenAI com ${messages.length} mensagens`);

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
        console.error('❌ ERRO da OpenAI:', response.status, errorText);
        throw new Error(`Erro da OpenAI: ${response.status}`);
      }

      const responseData = await response.json();
      const assistantResponse = responseData.choices?.[0]?.message?.content;

      if (assistantResponse?.trim() && mountedRef.current) {
        console.log(`🤖 RESPOSTA recebida (${assistantResponse.length} chars)`);
        
        // SIMULAR DIGITAÇÃO
        try {
          await simulateHumanTyping(message.from, assistantResponse);
        } catch (typingError) {
          console.warn('⚠️ ERRO na simulação de digitação:', typingError);
        }
        
        // QUEBRAR EM BLOCOS
        const messageBlocks = splitMessage(assistantResponse);
        console.log(`📝 RESPOSTA dividida em ${messageBlocks.length} blocos`);
        
        // ENVIAR CADA BLOCO
        for (let i = 0; i < messageBlocks.length; i++) {
          if (!mountedRef.current || !processingRef.current.has(ticketId)) {
            console.log('❌ INTERROMPENDO envio - componente desmontado ou processamento cancelado');
            break;
          }
          
          const blockContent = messageBlocks[i];
          console.log(`📤 ENVIANDO bloco ${i + 1}/${messageBlocks.length}`);
          
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          try {
            const aiMessageId = `ai_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
            
            if (processedMessagesRef.current.has(aiMessageId)) {
              console.log(`⚠️ MENSAGEM já processada: ${aiMessageId}`);
              continue;
            }
            
            processedMessagesRef.current.add(aiMessageId);
            
            // ENVIAR VIA WHATSAPP
            const sendResult = await whatsappService.sendMessage(instanceId, message.from, blockContent);
            console.log(`📤 RESULTADO envio bloco ${i + 1}:`, sendResult.success ? 'SUCCESS' : 'FAILED');
            
            if (sendResult.success) {
              simulateMessageProgression(aiMessageId, true);
              
              await ticketsService.addTicketMessage({
                ticket_id: ticketId,
                message_id: aiMessageId,
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
              
              console.log(`💾 MENSAGEM IA salva no ticket`);
            }
            
          } catch (sendError) {
            console.error(`❌ ERRO ao enviar bloco ${i + 1}:`, sendError);
          }
        }

        console.log('✅ RESPOSTA COMPLETA enviada');
        
        // MARCAR COMO LIDAS
        for (const msg of allMessages.filter(m => !m.fromMe)) {
          try {
            if (!processedMessagesRef.current.has(`read_${msg.id}`)) {
              processedMessagesRef.current.add(`read_${msg.id}`);
              await markAsRead(message.from, msg.id || msg.key?.id);
            }
          } catch (readError) {
            console.warn('⚠️ ERRO ao marcar como lida:', readError);
          }
        }
      }

    } catch (error) {
      console.error('❌ ERRO CRÍTICO no processamento:', error);
    } finally {
      if (mountedRef.current) {
        setAssistantTyping(false);
      }
      processingRef.current.delete(ticketId);
      console.log(`✅ PROCESSAMENTO finalizado (${processingKey})`);
    }
  }, [clientId, simulateHumanTyping, markAsRead, splitMessage, markActivity, simulateMessageProgression]);

  // Hook para agrupamento de mensagens
  const { addMessage, getBatchInfo, markBatchAsCompleted } = useMessageBatch(async (chatId: string, messages: any[]) => {
    console.log(`📦 ===== PROCESSBATCH CHAMADO =====`);
    console.log(`📱 Chat: ${chatId}`);
    console.log(`📨 Mensagens: ${messages.length}`);
    
    if (!mountedRef.current || messages.length === 0) {
      console.log('❌ COMPONENTE desmontado ou lote vazio');
      return;
    }

    // VERIFICAR MENSAGENS JÁ PROCESSADAS
    const newMessages = messages.filter(msg => {
      const msgKey = `batch_${msg.id || msg.key?.id}`;
      if (processedMessagesRef.current.has(msgKey)) {
        console.log(`⚠️ MENSAGEM já processada no lote: ${msgKey}`);
        return false;
      }
      processedMessagesRef.current.add(msgKey);
      return true;
    });

    if (newMessages.length === 0) {
      console.log('📦 TODAS mensagens já foram processadas');
      markBatchAsCompleted(chatId);
      return;
    }

    const clientMessages = newMessages.filter(msg => !msg.fromMe);
    
    if (clientMessages.length === 0) {
      console.log('📤 APENAS mensagens nossas - salvando...');
      
      for (const message of newMessages.filter(msg => msg.fromMe)) {
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
              timestamp: normalizedMessage.timestamp,
              media_url: normalizedMessage.mediaUrl
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
    
    try {
      // CRIAR/ATUALIZAR TICKET
      const ticketId = await ticketsService.createOrUpdateTicket({
        clientId: clientId,
        chatId: normalizedMessage.from,
        title: `Conversa com ${normalizedMessage.customerName}`,
        phoneNumber: normalizedMessage.phoneNumber,
        contactName: normalizedMessage.customerName,
        lastMessage: normalizedMessage.body,
        lastMessageAt: normalizedMessage.timestamp
      });

      console.log(`📋 TICKET criado/atualizado: ${ticketId}`);

      // SALVAR TODAS AS MENSAGENS COM DADOS DE MÍDIA E ÁUDIO
      for (const message of newMessages) {
        const normalized = normalizeWhatsAppMessage(message);
        
        const messageData: any = {
          ticket_id: ticketId,
          message_id: normalized.id,
          from_me: normalized.fromMe,
          sender_name: normalized.author,
          content: normalized.body,
          message_type: normalized.type,
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'received',
          timestamp: normalized.timestamp,
          media_url: normalized.mediaUrl
        };

        // ADICIONAR DADOS DE ÁUDIO SE EXISTIREM - COM LOGS
        if (normalized.type === 'audio' || normalized.type === 'ptt') {
          console.log('🎵 SALVANDO mensagem de áudio no banco:', {
            hasMediaData: !!normalized.mediaData,
            mediaDataLength: normalized.mediaData?.length || 0,
            hasOriginalMessage: !!normalized.originalMessage
          });
          
          if (normalized.mediaData) {
            messageData.audio_base64 = normalized.mediaData;
            console.log('💾 ADICIONANDO audio_base64 ao messageData');
          }
        }
        
        await ticketsService.addTicketMessage(messageData);
        console.log(`💾 MENSAGEM salva no banco: ${normalized.type}`);
      }

      console.log(`💾 TODAS mensagens salvas no ticket`);

      // PROCESSAR REAÇÕES
      for (const message of clientMessages) {
        const normalized = normalizeWhatsAppMessage(message);
        await processReaction(normalized);
      }

      markActivity();

      // ATUALIZAR LISTA DE TICKETS
      setTimeout(() => {
        if (mountedRef.current) {
          loadTickets();
        }
      }, 1000);

      // PROCESSAMENTO COM ASSISTENTE
      console.log(`🔍 VERIFICANDO processamento IA para ticket: ${ticketId}`);
      if (!processingRef.current.has(ticketId)) {
        console.log(`🤖 AGENDANDO processamento IA`);
        
        setTimeout(() => {
          if (mountedRef.current && !processingRef.current.has(ticketId)) {
            processWithAssistant(normalizedMessage, ticketId, clientMessages);
          }
        }, 1000);
      } else {
        console.log(`⚠️ TICKET já sendo processado`);
      }
      
    } catch (error) {
      console.error('❌ ERRO ao processar lote:', error);
    } finally {
      markBatchAsCompleted(chatId);
    }
  });

  // CONFIGURAR LISTENERS
  useEffect(() => {
    if (!clientId || initializationRef.current) return;

    console.log('🔌 ===== INICIALIZANDO LISTENERS =====');
    console.log(`👤 Cliente: ${clientId}`);
    
    initializationRef.current = true;
    mountedRef.current = true;

    loadTickets();

    let socket: any = null;
    try {
      socket = whatsappService.connectSocket();
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('✅ WEBSOCKET conectado');
        whatsappService.joinClientRoom(clientId);
      });

      socket.on('disconnect', (reason: any) => {
        console.log('❌ WEBSOCKET desconectado:', reason);
      });

      const mainEventName = `message_${clientId}`;
      
      socket.on(mainEventName, async (message: any) => {
        if (!mountedRef.current) return;
        
        console.log(`📨 ===== EVENTO RECEBIDO =====`);
        console.log(`🏷️ Evento: ${mainEventName}`);
        console.log(`📨 MENSAGEM COMPLETA RECEBIDA:`, JSON.stringify(message, null, 2));
        
        const messageKey = `socket_${message.id || message.key?.id}`;
        if (processedMessagesRef.current.has(messageKey)) {
          console.log(`⚠️ MENSAGEM já processada via socket: ${messageKey}`);
          return;
        }
        
        processedMessagesRef.current.add(messageKey);
        addMessage(message);
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
            console.log('🔄 MUDANÇA no banco detectada:', payload.eventType);
            if (mountedRef.current) {
              setTimeout(loadTickets, 1000);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      console.log('✅ LISTENERS configurados com sucesso');

    } catch (error) {
      console.error('❌ ERRO ao inicializar conexões:', error);
    }

    return () => {
      console.log('🔌 LIMPANDO recursos...');
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
  }, [clientId, loadTickets, addMessage]);

  const reloadTickets = useCallback(() => {
    if (mountedRef.current) {
      loadTickets();
    }
  }, [loadTickets]);

  return {
    tickets,
    isLoading,
    isTyping: assistantTyping,
    isOnline,
    reloadTickets,
    getBatchInfo,
    isAssistantTyping: (chatId: string) => isTyping(chatId),
    isAssistantRecording: (chatId: string) => isRecording(chatId)
  };
};
