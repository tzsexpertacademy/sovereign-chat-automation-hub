import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// ✅ BATCH PERSISTENTE - USANDO SUPABASE
const BATCH_TIMEOUT = 3000; // 3 segundos para agrupamento otimizado

serve(async (req) => {
  console.log('🔥 [WEBHOOK-SIMPLES] Requisição recebida:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'active', message: 'YUMER Webhook SIMPLES' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'POST') {
    try {
      const body = await req.text();
      console.log('🔥 [WEBHOOK-SIMPLES] Body recebido, length:', body.length);
      
      if (!body || body.trim() === '') {
        console.log('🔥 [WEBHOOK-SIMPLES] Body vazio - retornando OK');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let webhookData;
      try {
        webhookData = JSON.parse(body);
      } catch (e) {
        console.error('🔥 [WEBHOOK-SIMPLES] Erro parse JSON:', e);
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const event = webhookData?.event;
      console.log('🔥 [WEBHOOK-SIMPLES] Evento:', event);

      // ✅ PROCESSAR APENAS MENSAGENS
      if (event === 'messages.upsert') {
        console.log('🔥 [WEBHOOK-SIMPLES] MENSAGEM DETECTADA - PROCESSANDO BATCH');
        return await processMessageBatch(webhookData);
      }

      // ✅ RETORNAR OK PARA OUTROS EVENTOS
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('🔥 [WEBHOOK-SIMPLES] ERRO GLOBAL:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});

/**
 * 🔥 PROCESSAMENTO PRINCIPAL DE MENSAGENS EM BATCH
 */
async function processMessageBatch(yumerData: any) {
  try {
    console.log('🔥 [BATCH-SIMPLES] Iniciando processamento de batch');

    const data = yumerData?.data;
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log('🔥 [BATCH-SIMPLES] Dados inválidos ou vazios');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const messageData = data[0];
    
    // ✅ DETECTAR TIPO DE MENSAGEM
    const messageType = getMessageType(messageData);
    console.log(`📝 [DETECT] ${messageType === 'text' ? 'Texto' : 'Mídia'} detectado`);

    // ✅ EXTRAIR DADOS DA MENSAGEM
    const {
      chatId,
      messageId,
      content,
      contentType,
      hasMediaUrl,
      hasMediaKey,
      hasFileEncSha256,
      fromMe,
      pushName
    } = extractYumerMessageData(messageData);

    console.log('🔥 [BATCH-SIMPLES] Dados extraídos:', {
      chatId: chatId?.substring(0, 20),
      messageId,
      content: content?.substring(0, 50),
      messageType,
      contentType,
      hasMediaUrl,
      hasMediaKey,
      hasFileEncSha256,
      fromMe,
      pushName
    });

    const phoneNumber = chatId?.replace('@s.whatsapp.net', '') || '';

    // ✅ BUSCAR INSTÂNCIA CORRESPONDENTE
    const { data: instances, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_id, client_id')
      .eq('instance_id', yumerData.instance);

    if (instanceError || !instances || instances.length === 0) {
      console.error('🔥 [BATCH-SIMPLES] Instância não encontrada:', yumerData.instance);
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const instance = instances[0];
    console.log('🔥 [BATCH-SIMPLES] Instância encontrada:', instance.instance_id);

    // ✅ EXTRAIR DADOS DE MÍDIA COMPLETOS
    const extractedMediaData = extractMediaData(messageData);

    // ✅ SALVAR MENSAGEM NO BANCO (SEM MARCAR COMO PROCESSADA AINDA)
    const saveResponse = await saveMessageToDatabase(
      instance.client_id,
      instance.instance_id,
      messageId,
      chatId,
      content,
      messageType,
      fromMe,
      new Date(),
      pushName,
      phoneNumber,
      extractedMediaData.mediaUrl,
      extractedMediaData.mediaDuration,
      extractedMediaData.mediaKey,
      extractedMediaData.fileEncSha256,
      extractedMediaData.fileSha256,
      extractedMediaData.audioBase64,
      extractedMediaData.imageBase64,
      extractedMediaData.videoBase64,
      extractedMediaData.documentBase64,
      extractedMediaData.mimetype,
      extractedMediaData.directPath
    );

    console.log('🔥 [SAVE-DB] Salvando mensagem no banco:', { 
      messageType, 
      hasMediaUrl: !!extractedMediaData.mediaUrl,
      hasMediaKey: !!extractedMediaData.mediaKey
    });

    if (!saveResponse.success) {
      console.error('🔥 [SAVE-DB] Erro ao salvar:', saveResponse.error);
      // CONTINUAR mesmo com erro na gravação para não perder a mensagem
    }

    // ✅ PROCESSAMENTO DIFERENCIADO PARA MENSAGENS DO SISTEMA vs CLIENTE
    if (fromMe) {
      console.log('🔥 [BATCH-SIMPLES] Mensagem do sistema - processando imediatamente');
      
      // Processamento imediato para mensagens do sistema
      console.log('🔥 [SINGLE-MESSAGE] Processando mensagem única');
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'System message processed',
        messageId: messageId,
        chatId: chatId?.substring(0, 20)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ MENSAGEM DO CLIENTE - USAR SISTEMA DE BATCH PERSISTENTE
    console.log('🔥 [CLIENT-MESSAGE] Mensagem do cliente detectada - usando sistema de batching');
    console.log('🔥 [CLIENT-MESSAGE] Conteúdo:', content?.substring(0, 50));

    // ✅ USAR SISTEMA DE BATCH PERSISTENTE COM CONTROLE DE CONCORRÊNCIA
    const batchResult = await upsertMessageBatch(chatId, instance.client_id, instance.instance_id, {
      content,
      messageId,
      messageType,
      timestamp: new Date().toISOString(),
      customerName: pushName,
      phoneNumber
    });

    console.log('🔥 [CLIENT-MESSAGE] ✅ Mensagem adicionada ao batch:', {
      chatId: chatId?.substring(0, 20),
      messageId,
      batchSuccess: batchResult.success
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Message batched successfully',
      messageId: messageId,
      chatId: chatId?.substring(0, 20)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🔥 [BATCH-SIMPLES] ERRO:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * ✅ UPSERT MESSAGE BATCH - ADICIONA MENSAGEM AO BATCH PERSISTENTE
 */
async function upsertMessageBatch(chatId: string, clientId: string, instanceId: string, message: any) {
  console.log('🔥 [BATCH-PERSISTENT] Adicionando mensagem ao batch:', { 
    chatId: chatId?.substring(0, 20), 
    clientId,
    messageId: message.messageId
  });

  try {
    // USAR TRANSAÇÃO PARA EVITAR RACE CONDITIONS
    const { data: result, error } = await supabase.rpc('manage_message_batch', {
      p_chat_id: chatId,
      p_client_id: clientId,
      p_instance_id: instanceId,
      p_message: message
    });

    if (error) {
      console.error('🔥 [BATCH-PERSISTENT] ❌ Erro na função RPC:', error);
      
      // FALLBACK: Tentar método direto se RPC falhar
      console.log('🔥 [BATCH-PERSISTENT] 🔄 Tentando método direto...');
      return await upsertMessageBatchDirect(chatId, clientId, instanceId, message);
    }

    const isNewBatch = result?.is_new_batch || false;
    const messageCount = result?.message_count || 1;

    console.log('🔥 [BATCH-PERSISTENT] ✅ Batch gerenciado:', {
      isNewBatch,
      messageCount,
      willScheduleProcessing: true // SEMPRE AGENDAR
    });

    // 🚀 SEMPRE AGENDAR PROCESSAMENTO PARA MENSAGENS DO CLIENTE
    // Detectar se é mensagem de áudio para timeout dinâmico
    const isAudioMessage = message.messageType === 'audio' || 
                           (message.content && message.content.includes('🎵'));
    
    const batchTimeout = isAudioMessage ? 6000 : BATCH_TIMEOUT; // 6s para áudio, 3s para texto
    
    console.log(`🔥 [BATCH-GROUPING] ⏰ Agendando processamento em ${batchTimeout}ms (tipo: ${isAudioMessage ? 'áudio' : 'texto'}, count: ${messageCount})...`);
    
    // USAR EdgeRuntime.waitUntil para background task
    const backgroundTask = async () => {
      await new Promise(resolve => setTimeout(resolve, batchTimeout));
      
      try {
        console.log('🔥 [BATCH-GROUPING] 🚀 Executando processamento programado...');
        
        const response = await supabase.functions.invoke('process-message-batches', {
          body: { 
            trigger: 'batch_timeout_webhook',
            timestamp: new Date().toISOString(),
            chatId: chatId,
            source: 'yumer-unified-webhook',
            messageType: message.messageType || (isAudioMessage ? 'audio' : 'text'),
            hasMedia: isAudioMessage,
            force: true // ✅ FORÇAR PROCESSAMENTO
          }
        });
        
        console.log('🔥 [BATCH-GROUPING] 🎯 Processamento concluído:', {
          success: !response.error,
          data: response.data
        });
        
        if (response.error) {
          console.error('🔥 [BATCH-GROUPING] ❌ Erro no processamento:', response.error);
        }
      } catch (error) {
        console.error('🔥 [BATCH-GROUPING] ❌ Erro crítico no processamento:', error);
      }
    };

    // Executar background task sem bloquear resposta
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundTask());
    } else {
      // Fallback para ambientes sem EdgeRuntime
      backgroundTask();
    }

    return { 
      success: true, 
      isNewBatch, 
      messageCount 
    };

  } catch (error) {
    console.error('🔥 [BATCH-PERSISTENT] ❌ Erro crítico:', error);
    return { success: false, error: error.message };
  }
}

/**
 * FALLBACK: Método direto para casos onde RPC falha
 */
async function upsertMessageBatchDirect(chatId: string, clientId: string, instanceId: string, message: any) {
  try {
    // VERIFICAR BATCH EXISTENTE COM CONTROLE DE CONCORRÊNCIA
    const { data: existingBatch, error: selectError } = await supabase
      .from('message_batches')
      .select('*')
      .eq('chat_id', chatId)
      .eq('client_id', clientId)
      .is('processing_started_at', null) // Apenas batches não processados
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('🔥 [BATCH-DIRECT] Erro ao buscar batch:', selectError);
      return { success: false, error: selectError.message };
    }

    if (existingBatch) {
      // ATUALIZAR BATCH EXISTENTE
      const currentMessages = existingBatch.messages || [];
      const updatedMessages = [...currentMessages, message];

      const { error: updateError } = await supabase
        .from('message_batches')
        .update({
          messages: updatedMessages,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingBatch.id);

      if (updateError) {
        console.error('🔥 [BATCH-DIRECT] Erro ao atualizar batch:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('🔥 [BATCH-DIRECT] ✅ Batch atualizado:', existingBatch.id);
      return { 
        success: true, 
        isNewBatch: false, 
        messageCount: updatedMessages.length 
      };
    } else {
      // CRIAR NOVO BATCH
      const { data: newBatch, error: insertError } = await supabase
        .from('message_batches')
        .insert({
          chat_id: chatId,
          client_id: clientId,
          instance_id: instanceId,
          messages: [message]
        })
        .select()
        .single();

      if (insertError) {
        console.error('🔥 [BATCH-DIRECT] Erro ao criar batch:', insertError);
        return { success: false, error: insertError.message };
      }

      console.log('🔥 [BATCH-DIRECT] ✅ Novo batch criado:', newBatch.id);
      return { 
        success: true, 
        isNewBatch: true, 
        messageCount: 1 
      };
    }

  } catch (error) {
    console.error('🔥 [BATCH-DIRECT] ❌ Erro crítico:', error);
    return { success: false, error: error.message };
  }
}

// ✅ FUNÇÃO DE SALVAMENTO NO BANCO (MELHORADA)
async function saveMessageToDatabase(
  clientId: string,
  instanceId: string, 
  keyId: string,
  chatId: string,
  content: string,
  messageType: string,
  keyFromMe: boolean,
  messageTimestamp: Date,
  pushName: string,
  phoneNumber: string,
  mediaUrl?: string,
  mediaDuration?: number,
  mediaKey?: string,
  fileEncSha256?: string,
  fileSha256?: string,
  audioBase64?: string,
  imageBase64?: string,
  videoBase64?: string,
  documentBase64?: string,
  mimetype?: string,
  directPath?: string
) {
  try {
    // ✅ PREPARAR DADOS DA MENSAGEM COM CLIENT_ID
    const messageToSave = {
      instance_id: instanceId,
      chat_id: chatId,
      message_id: keyId,
      sender: phoneNumber,
      body: content,
      message_type: messageType,
      from_me: keyFromMe,
      timestamp: messageTimestamp.toISOString(),
      contact_name: pushName,
      phone_number: phoneNumber,
      media_url: mediaUrl,
      media_duration: mediaDuration,
      media_key: mediaKey,
      file_enc_sha256: fileEncSha256,
      file_sha256: fileSha256,
      media_mime_type: mimetype,
      direct_path: directPath,
      is_processed: false, // ✅ NÃO MARCAR COMO PROCESSADA AINDA
      client_id: clientId // ✅ ADICIONAR CLIENT_ID FALTANTE
    };

    const { error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert(messageToSave);

    if (saveError) {
      if (saveError.code === '23505') {
        console.log('🔥 [SAVE-DB] Mensagem já existe - ignorando');
      } else {
        console.error('🔥 [SAVE-DB] Erro ao salvar:', saveError);
        return { success: false, error: saveError };
      }
    } else {
      console.log('🔥 [SAVE-DB] ✅ Mensagem salva com sucesso');
    }

    // 🎯 CRIAR OU BUSCAR TICKET PARA PERMITIR SALVAMENTO EM TICKET_MESSAGES
    const { data: ticketId, error: ticketError } = await supabase.rpc('upsert_conversation_ticket', {
      p_client_id: clientId,
      p_chat_id: chatId,
      p_instance_id: instanceId,
      p_customer_name: pushName,
      p_customer_phone: phoneNumber.replace('@s.whatsapp.net', ''),
      p_last_message: content || '📎 Mídia',
      p_last_message_at: messageTimestamp.toISOString()
    });

    if (ticketError) {
      console.error('🔥 [SAVE-DB] Erro ao criar/buscar ticket:', ticketError);
      return { success: false, error: ticketError };
    }

    console.log('🔥 [SAVE-DB] ✅ Ticket encontrado/criado:', ticketId);

    // SALVAR TAMBÉM EM TICKET_MESSAGES COM DADOS DE MÍDIA
    const ticketMessage = {
      ticket_id: ticketId,
      message_id: keyId,
      content: content || '',
      message_type: messageType || 'text',
      from_me: keyFromMe || false,
      timestamp: messageTimestamp,
      sender_name: pushName,
      // DADOS DE MÍDIA COMPLETOS
      media_url: mediaUrl,
      media_key: mediaKey,
      file_enc_sha256: fileEncSha256,
      file_sha256: fileSha256,
      direct_path: directPath,
      media_mime_type: mimetype,
      media_duration: mediaDuration,
      processing_status: messageType === 'audio' ? 'received' : 'processed'
    };

    const { error: ticketMessageError } = await supabase
      .from('ticket_messages')
      .insert(ticketMessage);

    if (ticketMessageError) {
      if (ticketMessageError.code === '23505') {
        console.log('🔥 [SAVE-DB] Mensagem já existe em ticket_messages - ignorando');
      } else {
        console.error('🔥 [SAVE-DB] Erro ao salvar em ticket_messages:', ticketMessageError);
      }
    } else {
      console.log('🔥 [SAVE-DB] ✅ Mensagem salva em ticket_messages com dados de mídia');
    }

    return { success: true, ticketId };

  } catch (error) {
    console.error('🔥 [SAVE-DB] ERRO CRÍTICO:', error);
    return { success: false, error };
  }
}

// ✅ FUNÇÕES AUXILIARES

function getMessageType(messageData: any): string {
  if (messageData.message?.conversation || messageData.message?.extendedTextMessage) {
    return 'text';
  }
  if (messageData.message?.audioMessage) return 'audio';
  if (messageData.message?.imageMessage) return 'image';
  if (messageData.message?.videoMessage) return 'video';
  if (messageData.message?.documentMessage) return 'document';
  if (messageData.message?.stickerMessage) return 'sticker';
  return 'text';
}

function extractYumerMessageData(messageData: any) {
  const key = messageData.key || {};
  const message = messageData.message || {};
  
  let content = '';
  let contentType = 'text';
  
  // Extrair conteúdo baseado no tipo de mensagem
  if (message.conversation) {
    content = message.conversation;
  } else if (message.extendedTextMessage?.text) {
    content = message.extendedTextMessage.text;
  } else if (message.audioMessage) {
    content = '🎵 Áudio';
    contentType = 'audio';
  } else if (message.imageMessage) {
    content = message.imageMessage.caption || '🖼️ Imagem';
    contentType = 'image';
  } else if (message.videoMessage) {
    content = message.videoMessage.caption || '🎥 Vídeo';
    contentType = 'video';
  } else if (message.documentMessage) {
    content = `📄 ${message.documentMessage.fileName || 'Documento'}`;
    contentType = 'document';
  }

  return {
    chatId: key.remoteJid,
    messageId: key.id,
    content,
    contentType,
    hasMediaUrl: !!(message.audioMessage?.url || message.imageMessage?.url || message.videoMessage?.url || message.documentMessage?.url),
    hasMediaKey: !!(message.audioMessage?.mediaKey || message.imageMessage?.mediaKey || message.videoMessage?.mediaKey || message.documentMessage?.mediaKey),
    hasFileEncSha256: !!(message.audioMessage?.fileEncSha256 || message.imageMessage?.fileEncSha256 || message.videoMessage?.fileEncSha256 || message.documentMessage?.fileEncSha256),
    fromMe: key.fromMe,
    pushName: messageData.pushName || 'Usuário'
  };
}

function extractMediaData(messageData: any) {
  const message = messageData.message || {};
  
  // Extrair dados de mídia baseado no tipo
  if (message.audioMessage) {
    return {
      mediaUrl: message.audioMessage.url,
      mediaKey: convertUint8ArrayToBase64(message.audioMessage.mediaKey),
      fileEncSha256: convertUint8ArrayToBase64(message.audioMessage.fileEncSha256),
      fileSha256: convertUint8ArrayToBase64(message.audioMessage.fileSha256),
      mediaDuration: message.audioMessage.seconds,
      mimetype: message.audioMessage.mimetype || 'audio/ogg',
      directPath: message.audioMessage.directPath,
      audioBase64: null // Será preenchido após descriptografia
    };
  }
  
  if (message.imageMessage) {
    return {
      mediaUrl: message.imageMessage.url,
      mediaKey: convertUint8ArrayToBase64(message.imageMessage.mediaKey),
      fileEncSha256: convertUint8ArrayToBase64(message.imageMessage.fileEncSha256),
      fileSha256: convertUint8ArrayToBase64(message.imageMessage.fileSha256),
      mimetype: message.imageMessage.mimetype || 'image/jpeg',
      directPath: message.imageMessage.directPath,
      imageBase64: null // Será preenchido após descriptografia
    };
  }
  
  if (message.videoMessage) {
    return {
      mediaUrl: message.videoMessage.url,
      mediaKey: convertUint8ArrayToBase64(message.videoMessage.mediaKey),
      fileEncSha256: convertUint8ArrayToBase64(message.videoMessage.fileEncSha256),
      fileSha256: convertUint8ArrayToBase64(message.videoMessage.fileSha256),
      mediaDuration: message.videoMessage.seconds,
      mimetype: message.videoMessage.mimetype || 'video/mp4',
      directPath: message.videoMessage.directPath,
      videoBase64: null // Será preenchido após descriptografia
    };
  }
  
  if (message.documentMessage) {
    return {
      mediaUrl: message.documentMessage.url,
      mediaKey: convertUint8ArrayToBase64(message.documentMessage.mediaKey),
      fileEncSha256: convertUint8ArrayToBase64(message.documentMessage.fileEncSha256),
      fileSha256: convertUint8ArrayToBase64(message.documentMessage.fileSha256),
      mimetype: message.documentMessage.mimetype || 'application/octet-stream',
      directPath: message.documentMessage.directPath,
      documentBase64: null // Será preenchido após descriptografia
    };
  }
  
  return {};
}

/**
 * 🔥 FUNÇÃO CRÍTICA: Converter Uint8Array para Base64
 */
function convertUint8ArrayToBase64(data: any): string | null {
  try {
    if (!data) return null;
    
    // Se já é string, retornar como está
    if (typeof data === 'string') return data;
    
    // Se é objeto com propriedades numéricas (Uint8Array serializado), converter
    if (typeof data === 'object' && !Array.isArray(data)) {
      const uint8Array = new Uint8Array(Object.values(data as Record<string, number>));
      return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
    }
    
    // Se é array, converter diretamente
    if (Array.isArray(data)) {
      const uint8Array = new Uint8Array(data);
      return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
    }
    
    // Se é Uint8Array, converter
    if (data instanceof Uint8Array) {
      return btoa(String.fromCharCode.apply(null, Array.from(data)));
    }
    
    console.error('🔥 [CONVERT] Tipo de dados não reconhecido:', typeof data);
    return null;
  } catch (error) {
    console.error('🔥 [CONVERT] Erro na conversão:', error);
    return null;
  }
}