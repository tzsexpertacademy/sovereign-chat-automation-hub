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
  console.log('🚨 [WEBHOOK-EMERGENCIAL] Requisição recebida:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'emergency_active', 
        message: 'YUMER Webhook EMERGENCIAL v2.0',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'POST') {
    try {
      const body = await req.text();
      console.log('🚨 [WEBHOOK-EMERGENCIAL] Body recebido, length:', body.length);
      
      if (!body || body.trim() === '') {
        console.log('🚨 [WEBHOOK-EMERGENCIAL] Body vazio - OK');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let webhookData;
      try {
        webhookData = JSON.parse(body);
      } catch (e) {
        console.error('🚨 [WEBHOOK-EMERGENCIAL] ❌ JSON inválido:', e);
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const event = webhookData?.event;
      console.log('🚨 [WEBHOOK-EMERGENCIAL] Evento detectado:', event);

      // ✅ PROCESSAR APENAS MENSAGENS - VERSÃO EMERGENCIAL
      if (event === 'messages.upsert') {
        console.log('🚨 [WEBHOOK-EMERGENCIAL] 🔥 MENSAGEM DETECTADA - PROCESSAMENTO EMERGENCIAL');
        return await processMessageEmergency(webhookData);
      }

      // ✅ LOG OUTROS EVENTOS E RETORNAR OK
      console.log('🚨 [WEBHOOK-EMERGENCIAL] ℹ️ Evento ignorado:', event);
      return new Response(JSON.stringify({ success: true, ignored: event }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('🚨 [WEBHOOK-EMERGENCIAL] ❌ ERRO CRÍTICO:', error);
      return new Response(JSON.stringify({ 
        error: error.message,
        stack: error.stack?.substring(0, 500) 
      }), {
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
 * 🚨 PROCESSAMENTO EMERGENCIAL DE MENSAGENS
 */
async function processMessageEmergency(yumerData: any) {
  try {
    console.log('🚨 [EMERGENCY-PROCESS] Iniciando processamento emergencial');
    console.log('🚨 [EMERGENCY-PROCESS] Dados completos recebidos:', JSON.stringify(yumerData, null, 2));

    // 🔍 DETECTAR FORMATO DOS DADOS DINAMICAMENTE
    let messageData;
    let dataFormat = 'unknown';
    
    if (Array.isArray(yumerData)) {
      messageData = yumerData[0];
      dataFormat = 'array_direct';
    } else if (yumerData?.data && Array.isArray(yumerData.data) && yumerData.data.length > 0) {
      messageData = yumerData.data[0];
      dataFormat = 'object_with_data_array';
    } else if (yumerData?.data && !Array.isArray(yumerData.data)) {
      messageData = yumerData.data;
      dataFormat = 'object_with_data_object';
    } else if (yumerData?.message || yumerData?.key || yumerData?.messageTimestamp) {
      messageData = yumerData;
      dataFormat = 'direct_message';
    } else {
      messageData = yumerData;
      dataFormat = 'fallback_object';
    }

    console.log('🚨 [EMERGENCY-PROCESS] Formato detectado:', dataFormat);
    console.log('🚨 [EMERGENCY-PROCESS] Dados da mensagem extraídos:', JSON.stringify(messageData, null, 2));

    if (!messageData) {
      console.log('🚨 [EMERGENCY-PROCESS] Nenhum dado de mensagem válido encontrado - retornando OK');
      return new Response(JSON.stringify({ success: true, message: 'No valid message data', format: dataFormat }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ BUSCAR INSTÂNCIA PRIMEIRO - CORREÇÃO DEFINITIVA
    let instanceData = null;
    
    // Extrair instanceId da estrutura do Yumer
    let targetInstanceId = null;
    
    if (typeof yumerData.instance === 'string') {
      targetInstanceId = yumerData.instance;
    } else if (yumerData.instance?.instanceId) {
      targetInstanceId = yumerData.instance.instanceId;
    } else if (messageData.instanceInstanceId) {
      targetInstanceId = messageData.instanceInstanceId;
    }

    console.log('🚨 [EMERGENCY-PROCESS] 🔍 Instance ID extraído:', targetInstanceId);
    console.log('🚨 [EMERGENCY-PROCESS] 📋 Estrutura completa do yumerData.instance:', JSON.stringify(yumerData.instance, null, 2));

    if (!targetInstanceId) {
      console.error('🚨 [EMERGENCY-PROCESS] ❌ Nenhum Instance ID encontrado nos dados');
      return new Response(JSON.stringify({ 
        error: 'No instance ID found',
        debug: {
          instanceType: typeof yumerData.instance,
          instanceValue: yumerData.instance,
          messageInstanceId: messageData.instanceInstanceId
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar instância no banco
    console.log('🚨 [EMERGENCY-PROCESS] 🔎 Buscando instância no banco:', targetInstanceId);
    
    const { data: foundInstances, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_id, client_id, status')
      .eq('instance_id', targetInstanceId);

    if (instanceError) {
      console.error('🚨 [EMERGENCY-PROCESS] ❌ Erro ao buscar instância:', instanceError);
    }

    if (foundInstances && foundInstances.length > 0) {
      instanceData = foundInstances[0];
      console.log('🚨 [EMERGENCY-PROCESS] ✅ Instância encontrada:', {
        instanceId: instanceData.instance_id,
        clientId: instanceData.client_id,
        status: instanceData.status
      });
    }

    if (!instanceData) {
      console.error('🚨 [EMERGENCY-PROCESS] ❌ Instância não encontrada:', targetInstanceId);
      
      // 🔧 BUSCAR TODAS AS INSTÂNCIAS PARA DEBUG
      const { data: allInstances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, client_id, status')
        .limit(10);
      
      console.log('🚨 [EMERGENCY-PROCESS] 📋 Instâncias disponíveis no banco:', allInstances);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Instance not found',
        searchedId: targetInstanceId,
        availableInstances: allInstances?.map(i => i.instance_id),
        debug: {
          instanceType: typeof yumerData.instance,
          instanceValue: yumerData.instance,
          messageInstanceId: messageData.instanceInstanceId
        }
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ EXTRAIR DADOS DA MENSAGEM COM MÉTODO ROBUSTO
    const extractedData = extractYumerMessageDataEmergency(messageData);
    if (!extractedData) {
      console.log('🚨 [EMERGENCY-PROCESS] ❌ Falha na extração de dados');
      return new Response(JSON.stringify({ success: true, message: 'Data extraction failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🚨 [EMERGENCY-PROCESS] ✅ Dados extraídos:', {
      messageId: extractedData.messageId,
      chatId: extractedData.chatId?.substring(0, 20),
      messageType: extractedData.messageType,
      fromMe: extractedData.fromMe,
      content: extractedData.content?.substring(0, 50)
    });

    // ✅ SALVAR MENSAGEM DIRETAMENTE NO BANCO
    await saveMessageDirectlyEmergency({
      ...extractedData,
      clientId: instanceData.client_id,
      instanceUuid: instanceData.id
    });

    // ✅ SE NÃO É MENSAGEM NOSSA, CRIAR BATCH PARA PROCESSAMENTO
    if (!extractedData.fromMe) {
      console.log('🚨 [EMERGENCY-PROCESS] 🎯 Mensagem do cliente - criando batch emergencial');
      await createEmergencyBatch(extractedData.chatId, instanceData.client_id, extractedData.instanceId, messageData);
    } else {
      console.log('🚨 [EMERGENCY-PROCESS] ℹ️ Mensagem do sistema - processamento direto');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Emergency processing completed',
      messageId: extractedData.messageId,
      chatId: extractedData.chatId?.substring(0, 20)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🚨 [EMERGENCY-PROCESS] ❌ ERRO CRÍTICO:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack?.substring(0, 500)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 🔥 PROCESSAMENTO PRINCIPAL DE MENSAGENS EM BATCH (LEGADO)
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
 * 🚨 FUNÇÕES EMERGENCIAIS PARA PROCESSAMENTO ROBUSTO
 */

async function saveMessageDirectlyEmergency(messageData: any) {
  try {
    console.log('🚨 [EMERGENCY-SAVE] Salvando mensagem diretamente');
    
    // Inserir em whatsapp_messages SEM marcar como processada
    const { error: whatsappError } = await supabase
      .from('whatsapp_messages')
      .insert({
        message_id: messageData.messageId,
        chat_id: messageData.chatId,
        instance_id: messageData.instanceId,
        client_id: messageData.clientId,
        body: messageData.content,
        message_type: messageData.messageType,
        from_me: messageData.fromMe,
        timestamp: messageData.timestamp,
        contact_name: messageData.senderName,
        phone_number: messageData.phoneNumber,
        media_url: messageData.mediaUrl,
        media_duration: messageData.mediaDuration,
        media_key: messageData.mediaKey,
        file_enc_sha256: messageData.fileEncSha256,
        file_sha256: messageData.fileSha256,
        media_mime_type: messageData.mediaMimeType,
        direct_path: messageData.directPath,
        raw_data: messageData.rawData,
        source: 'yumer',
        is_processed: false // ❗ CRÍTICO: Não marcar como processada ainda
      })

    if (whatsappError) {
      if (whatsappError.code === '23505') {
        console.log('🚨 [EMERGENCY-SAVE] ℹ️ Mensagem já existe - OK');
      } else {
        console.error('🚨 [EMERGENCY-SAVE] ❌ Erro salvando no whatsapp_messages:', whatsappError);
        return
      }
    } else {
      console.log('🚨 [EMERGENCY-SAVE] ✅ Mensagem salva no whatsapp_messages');
    }

    // Criar/atualizar ticket de conversa
    const { data: ticketId, error: ticketError } = await supabase
      .rpc('upsert_conversation_ticket', {
        p_client_id: messageData.clientId,
        p_chat_id: messageData.chatId,
        p_instance_id: messageData.instanceId,
        p_customer_name: messageData.senderName || 'Cliente',
        p_customer_phone: messageData.phoneNumber || '',
        p_last_message: messageData.content || '[Mídia]',
        p_last_message_at: messageData.timestamp
      })

    if (ticketError) {
      console.error('🚨 [EMERGENCY-SAVE] ❌ Erro criando ticket:', ticketError);
      return
    }

    console.log('🚨 [EMERGENCY-SAVE] ✅ Ticket criado/atualizado:', ticketId);

    // Salvar em ticket_messages também
    const { error: ticketMsgError } = await supabase
      .rpc('save_ticket_message', {
        p_ticket_id: ticketId,
        p_message_id: messageData.messageId,
        p_content: messageData.content || '[Mídia]',
        p_message_type: messageData.messageType,
        p_from_me: messageData.fromMe,
        p_timestamp: messageData.timestamp,
        p_sender_name: messageData.senderName,
        p_media_url: messageData.mediaUrl,
        p_media_duration: messageData.mediaDuration,
        p_media_key: messageData.mediaKey,
        p_file_enc_sha256: messageData.fileEncSha256,
        p_file_sha256: messageData.fileSha256
      })

    if (ticketMsgError) {
      console.error('🚨 [EMERGENCY-SAVE] ⚠️ Aviso salvando ticket_message:', ticketMsgError);
    } else {
      console.log('🚨 [EMERGENCY-SAVE] ✅ Mensagem salva no ticket_messages');
    }

  } catch (error) {
    console.error('🚨 [EMERGENCY-SAVE] ❌ Erro geral:', error);
  }
}

async function createEmergencyBatch(chatId: string, clientId: string, instanceId: string, messageData: any) {
  try {
    console.log('🚨 [EMERGENCY-BATCH] Criando batch de emergência');
    
    // Tentar usar RPC primeiro
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('manage_message_batch', {
        p_chat_id: chatId,
        p_client_id: clientId,
        p_instance_id: instanceId,
        p_message: messageData
      })

    if (!rpcError && rpcResult?.success) {
      console.log('🚨 [EMERGENCY-BATCH] ✅ Batch criado via RPC:', rpcResult.batch_id);
    } else {
      console.log('🚨 [EMERGENCY-BATCH] ⚠️ RPC falhou, criando batch direto:', rpcError);
      
      // Fallback: criar batch diretamente
      const { error: directError } = await supabase
        .from('message_batches')
        .insert({
          chat_id: chatId,
          client_id: clientId,
          instance_id: instanceId,
          messages: [messageData]
        })

      if (directError) {
        console.error('🚨 [EMERGENCY-BATCH] ❌ Erro criando batch direto:', directError);
      } else {
        console.log('🚨 [EMERGENCY-BATCH] ✅ Batch criado diretamente');
      }
    }

    // Invocar processador de batches com delay
    setTimeout(async () => {
      try {
        console.log('🚨 [EMERGENCY-BATCH] Invocando processador de batches');
        await supabase.functions.invoke('process-message-batches', {
          body: { trigger: 'emergency_webhook', chatId }
        })
      } catch (invokeError) {
        console.error('🚨 [EMERGENCY-BATCH] ❌ Erro invocando processador:', invokeError);
      }
    }, 2000)

  } catch (error) {
    console.error('🚨 [EMERGENCY-BATCH] ❌ Erro geral:', error);
  }
}

function extractYumerMessageDataEmergency(messageData: any): any | null {
  try {
    if (!messageData) {
      console.log('🚨 [EXTRACT-EMERGENCY] Dados vazios');
      return null;
    }

    const messageId = messageData.key?.id;
    const chatId = messageData.key?.remoteJid;
    const instanceId = messageData.instanceInstanceId;
    const fromMe = messageData.key?.fromMe || false;
    const timestamp = messageData.messageTimestamp ? 
      new Date(messageData.messageTimestamp * 1000).toISOString() : 
      new Date().toISOString();

    if (!messageId || !chatId || !instanceId) {
      console.log('🚨 [EXTRACT-EMERGENCY] ❌ Campos obrigatórios ausentes:', {
        messageId: !!messageId,
        chatId: !!chatId,
        instanceId: !!instanceId
      });
      return null;
    }

    // Extrair conteúdo e tipo da mensagem
    const messageType = getMessageTypeEmergency(messageData);
    const content = extractContentEmergency(messageData);
    const mediaData = extractMediaDataEmergency(messageData);

    return {
      messageId,
      chatId,
      instanceId,
      fromMe,
      timestamp,
      messageType,
      content,
      senderName: messageData.pushName || null,
      phoneNumber: extractPhoneFromChatId(chatId),
      rawData: messageData,
      ...mediaData
    };

  } catch (error) {
    console.error('🚨 [EXTRACT-EMERGENCY] ❌ Erro na extração:', error);
    return null;
  }
}

function getMessageTypeEmergency(messageData: any): string {
  if (messageData.message?.conversation) return 'text';
  if (messageData.message?.extendedTextMessage) return 'text';
  if (messageData.message?.imageMessage) return 'image';
  if (messageData.message?.videoMessage) return 'video';
  if (messageData.message?.audioMessage) return 'audio';
  if (messageData.message?.documentMessage) return 'document';
  if (messageData.message?.stickerMessage) return 'sticker';
  if (messageData.contentType) return messageData.contentType;
  return 'text';
}

function extractContentEmergency(messageData: any): string {
  if (messageData.message?.conversation) {
    return messageData.message.conversation;
  }
  if (messageData.message?.extendedTextMessage?.text) {
    return messageData.message.extendedTextMessage.text;
  }
  if (messageData.content?.text) {
    return messageData.content.text;
  }
  return '[Mídia]';
}

function extractMediaDataEmergency(messageData: any): any {
  const media = messageData.message;
  if (!media) return {};

  const result: any = {};

  // Processar diferentes tipos de mídia
  const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'];
  
  for (const type of mediaTypes) {
    const mediaObj = media[type];
    if (mediaObj) {
      result.mediaUrl = mediaObj.url || null;
      result.mediaDuration = mediaObj.seconds || null;
      result.mediaMimeType = mediaObj.mimetype || null;
      result.directPath = mediaObj.directPath || null;
      
      // Converter chaves de mídia corretamente
      if (mediaObj.mediaKey) {
        result.mediaKey = convertUint8ArrayToBase64Emergency(mediaObj.mediaKey);
      }
      if (mediaObj.fileEncSha256) {
        result.fileEncSha256 = convertUint8ArrayToBase64Emergency(mediaObj.fileEncSha256);
      }
      if (mediaObj.fileSha256) {
        result.fileSha256 = convertUint8ArrayToBase64Emergency(mediaObj.fileSha256);
      }
      break;
    }
  }

  return result;
}

function convertUint8ArrayToBase64Emergency(data: any): string | null {
  try {
    if (!data) return null;
    
    if (typeof data === 'string') {
      return data;
    }
    
    if (data instanceof Uint8Array) {
      return btoa(String.fromCharCode(...Array.from(data)));
    }
    
    if (Array.isArray(data)) {
      return btoa(String.fromCharCode(...data));
    }
    
    console.log('🚨 [CONVERT-EMERGENCY] ⚠️ Tipo não suportado:', typeof data);
    return null;
    
  } catch (error) {
    console.error('🚨 [CONVERT-EMERGENCY] ❌ Erro na conversão:', error);
    return null;
  }
}

function extractPhoneFromChatId(chatId: string): string {
  return chatId.replace(/@.*$/, '');
}

/**
 * 🔥 FUNÇÃO CRÍTICA: Converter Uint8Array para Base64 (LEGADO)
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