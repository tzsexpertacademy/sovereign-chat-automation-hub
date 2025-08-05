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
  console.log('🔥 [YUMER-WEBHOOK] Requisição recebida:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'active', message: 'YUMER Webhook Original - Corrigido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'POST') {
    try {
      const body = await req.text();
      console.log('🔥 [YUMER-WEBHOOK] Body recebido, length:', body.length);
      
      if (!body || body.trim() === '') {
        console.log('🔥 [YUMER-WEBHOOK] Body vazio - retornando OK');
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let webhookData;
      try {
        webhookData = JSON.parse(body);
      } catch (e) {
        console.error('🔥 [YUMER-WEBHOOK] Erro parse JSON:', e);
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('🔥 [YUMER-WEBHOOK] Evento:', webhookData.event);

      // DETECTAR MENSAGENS YUMER
      if (webhookData.event === 'messages.upsert' && webhookData.data && webhookData.instance?.instanceId) {
        console.log('🔥 [YUMER-WEBHOOK] MENSAGEM DETECTADA - PROCESSANDO BATCH');
        return await processMessageBatch(webhookData);
      }

      return new Response(JSON.stringify({ success: true, message: 'Event processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('🔥 [YUMER-WEBHOOK] ERRO CRÍTICO:', error);
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

// ✅ FUNÇÃO ULTRA SIMPLES PARA BATCH
async function processMessageBatch(yumerData: any) {
  try {
    console.log('🔥 [BATCH-YUMER] Iniciando processamento de batch');
    
    const messageData = yumerData.data;
    const instanceId = yumerData.instance?.instanceId;
    const instanceName = yumerData.instance?.name;
    
    if (!messageData || !instanceId || !instanceName) {
      console.log('🔥 [BATCH-YUMER] Dados insuficientes');
      return new Response(JSON.stringify({ error: 'Insufficient data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // EXTRAIR DADOS BÁSICOS DA MENSAGEM + MÍDIA
    const chatId = messageData.keyRemoteJid;
    const messageId = messageData.keyId;
    const fromMe = messageData.keyFromMe || false;
    const pushName = messageData.pushName || 'Cliente';
    const phoneNumber = chatId?.replace('@s.whatsapp.net', '') || '';
    
    // DETECTAR TIPO DE MENSAGEM E MÍDIA CORRIGIDO
    let content = '';
    let messageType = 'text';
    let mediaUrl = null;
    let mediaKey = null;
    let fileEncSha256 = null;
    let fileSha256 = null;
    let directPath = null;
    let mediaMimeType = null;
    let mediaDuration = null;
    
    // 🔥 CORREÇÃO: Detectar contentType para identificar mídias corretamente
    if (messageData.contentType === 'image' || messageData.content?.imageMessage) {
      const img = messageData.content?.imageMessage || messageData.content;
      content = img.caption || '📷 Imagem';
      messageType = 'image';
      mediaUrl = img.url;
      mediaKey = img.mediaKey ? convertUint8ArrayToBase64(img.mediaKey) : null;
      fileEncSha256 = img.fileEncSha256 ? convertUint8ArrayToBase64(img.fileEncSha256) : null;
      fileSha256 = img.fileSha256 ? convertUint8ArrayToBase64(img.fileSha256) : null;
      directPath = img.directPath;
      mediaMimeType = img.mimetype || 'image/jpeg';
      console.log('🖼️ [DETECT] Imagem detectada:', { mediaUrl: !!mediaUrl, mediaKey: !!mediaKey, mediaKeyType: typeof mediaKey });
    } else if (messageData.contentType === 'audio' || messageData.content?.audioMessage) {
      const audio = messageData.content?.audioMessage || messageData.content;
      content = '🎵 Áudio';
      messageType = 'audio';
      mediaUrl = audio.url;
      mediaKey = audio.mediaKey ? convertUint8ArrayToBase64(audio.mediaKey) : null;
      fileEncSha256 = audio.fileEncSha256 ? convertUint8ArrayToBase64(audio.fileEncSha256) : null;
      fileSha256 = audio.fileSha256 ? convertUint8ArrayToBase64(audio.fileSha256) : null;
      directPath = audio.directPath;
      mediaMimeType = audio.mimetype || 'audio/ogg';
      mediaDuration = audio.seconds;
      console.log('🎵 [AUDIO-DETECT] 🎯 Áudio detectado:', { 
        messageId,
        mediaUrl: !!mediaUrl, 
        mediaKey: !!mediaKey, 
        mediaKeyType: typeof mediaKey,
        mediaKeyLength: mediaKey?.length,
        fileEncSha256: !!fileEncSha256,
        directPath: !!directPath,
        mimetype: mediaMimeType,
        duration: mediaDuration
      });
    } else if (messageData.contentType === 'video' || messageData.content?.videoMessage) {
      const video = messageData.content?.videoMessage || messageData.content;
      content = video.caption || '🎥 Vídeo';
      messageType = 'video';
      mediaUrl = video.url;
      mediaKey = video.mediaKey ? convertUint8ArrayToBase64(video.mediaKey) : null;
      fileEncSha256 = video.fileEncSha256 ? convertUint8ArrayToBase64(video.fileEncSha256) : null;
      fileSha256 = video.fileSha256 ? convertUint8ArrayToBase64(video.fileSha256) : null;
      directPath = video.directPath;
      mediaMimeType = video.mimetype || 'video/mp4';
      mediaDuration = video.seconds;
      console.log('🎥 [DETECT] Vídeo detectado:', { mediaUrl: !!mediaUrl, mediaKey: !!mediaKey, mediaKeyType: typeof mediaKey });
    } else if (messageData.contentType === 'document' || messageData.content?.documentMessage) {
      const doc = messageData.content?.documentMessage || messageData.content;
      content = doc.fileName || '📄 Documento';
      messageType = 'document';
      mediaUrl = doc.url;
      mediaKey = doc.mediaKey ? convertUint8ArrayToBase64(doc.mediaKey) : null;
      fileEncSha256 = doc.fileEncSha256 ? convertUint8ArrayToBase64(doc.fileEncSha256) : null;
      fileSha256 = doc.fileSha256 ? convertUint8ArrayToBase64(doc.fileSha256) : null;
      directPath = doc.directPath;
      mediaMimeType = doc.mimetype || 'application/pdf';
      console.log('📄 [DETECT] Documento detectado:', { mediaUrl: !!mediaUrl, mediaKey: !!mediaKey, mediaKeyType: typeof mediaKey });
    } else if (messageData.content?.text) {
      content = messageData.content.text;
      messageType = 'text';
      console.log('📝 [DETECT] Texto detectado');
    }

    console.log('🔥 [BATCH-YUMER] Dados extraídos:', {
      chatId: chatId?.substring(0, 20),
      messageId,
      content: content.substring(0, 50),
      messageType,
      contentType: messageData.contentType,
      hasMediaUrl: !!mediaUrl,
      hasMediaKey: !!mediaKey,
      hasFileEncSha256: !!fileEncSha256,
      fromMe,
      pushName
    });

    // BUSCAR INSTÂNCIA
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('instance_id, client_id, id')
      .eq('yumer_instance_name', instanceName)
      .single();

    if (instanceError || !instance) {
      console.log('🔥 [BATCH-YUMER] ❌ Instância não encontrada:', instanceName);
      console.log('🔥 [BATCH-YUMER] 🔍 Tentando buscar por instance_id:', instanceId);
      
      const { data: instanceFallback } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, client_id, id')
        .eq('instance_id', instanceId)
        .single();
      
      if (!instanceFallback) {
        console.log('🔥 [BATCH-YUMER] ❌ Nenhuma instância encontrada - REJEITANDO');
        return new Response(JSON.stringify({ 
          error: 'Instance not found',
          instanceName,
          instanceId
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      Object.assign(instance, instanceFallback);
      console.log('🔥 [BATCH-YUMER] ✅ Instância encontrada via fallback:', instance.instance_id);
    }

    console.log('🔥 [BATCH-YUMER] Instância encontrada:', instance.instance_id);

    // SE É MENSAGEM DO SISTEMA, APENAS SALVAR (NÃO PROCESSAR)
    if (fromMe) {
      console.log('🔥 [BATCH-YUMER] Mensagem do sistema - apenas salvando (sem processar)');
      
      await saveMessageToDatabase({
        ...messageData,
        messageType,
        content,
        mediaUrl,
        mediaKey,
        fileEncSha256,
        fileSha256,
        directPath,
        mediaMimeType,
        mediaDuration
      }, instance, chatId, pushName, phoneNumber);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'System message saved' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // MENSAGEM DO CLIENTE - USAR SISTEMA DE BATCHING
    console.log('🔥 [CLIENT-MESSAGE] Mensagem do cliente detectada - usando sistema de batching');
    
    // SEMPRE CHAMAR UPSERT_CONVERSATION_TICKET
    try {
      const { data: ticketId, error: upsertError } = await supabase.rpc('upsert_conversation_ticket', {
        p_client_id: instance.client_id,
        p_chat_id: chatId,
        p_instance_id: instance.instance_id,
        p_customer_name: pushName,
        p_customer_phone: phoneNumber,
        p_last_message: content,
        p_last_message_at: new Date().toISOString()
      });

      if (upsertError) {
        console.error('❌ [UPSERT-TICKET] Erro na função upsert:', upsertError);
      } else {
        console.log('✅ [UPSERT-TICKET] Ticket processado:', ticketId);
      }
    } catch (upsertTicketError) {
      console.error('❌ [UPSERT-TICKET] Erro crítico no upsert:', upsertTicketError);
    }

    // SALVAR MENSAGEM NO BANCO
    const saveResult = await saveMessageToDatabase({
      ...messageData,
      messageType,
      content,
      mediaUrl,
      mediaKey,
      fileEncSha256,
      fileSha256,
      directPath,
      mediaMimeType,
      mediaDuration
    }, instance, chatId, pushName, phoneNumber);

    // ADICIONAR AO BATCH PARA PROCESSAMENTO
    const batchResult = await upsertMessageBatch(chatId, instance.client_id, instance.instance_id, {
      content: content,
      messageId: messageId,
      timestamp: new Date().toISOString(),
      customerName: pushName,
      phoneNumber: phoneNumber,
      messageType: messageType,
      isAudio: messageType === 'audio'
    });

    console.log('🔥 [BATCH-YUMER] ✅ Mensagem processada e adicionada ao batch:', {
      success: batchResult.success,
      isNewBatch: batchResult.isNewBatch,
      messageType: messageType
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Message processed and batched',
      batched: true,
      messageType: messageType
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🔥 [BATCH-YUMER] ❌ ERRO CRÍTICO:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// FUNÇÃO PARA CONVERTER UINT8ARRAY PARA BASE64
function convertUint8ArrayToBase64(data: any): string | null {
  if (!data) return null;
  
  try {
    // Se já é string, retornar como está
    if (typeof data === 'string') {
      return data;
    }
    
    // Se é Uint8Array ou array-like
    if (data instanceof Uint8Array || Array.isArray(data) || (data.constructor && data.constructor.name === 'Uint8Array')) {
      const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      return btoa(binary);
    }
    
    // Se é objeto com dados numéricos
    if (typeof data === 'object' && data !== null) {
      const values = Object.values(data);
      if (values.length > 0 && values.every(v => typeof v === 'number')) {
        const uint8Array = new Uint8Array(values as number[]);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
      }
    }
    
    console.warn('🔍 [CONVERT] Tipo de dados não reconhecido:', typeof data, data);
    return null;
  } catch (error) {
    console.error('❌ [CONVERT] Erro na conversão:', error);
    return null;
  }
}

// FUNÇÃO PARA SALVAR MENSAGEM NO BANCO
async function saveMessageToDatabase(messageData: any, instanceData: any, chatId: string, pushName: string, phoneNumber: string) {
  const timestamp = new Date(messageData.messageTimestamp * 1000);
  
  try {
    // Salvar em whatsapp_messages
    const { data: whatsappMessage, error: whatsappError } = await supabase
      .from('whatsapp_messages')
      .upsert({
        instance_id: instanceData.instance_id,
        client_id: instanceData.client_id,
        chat_id: chatId,
        message_id: messageData.keyId,
        key_remote_jid: messageData.keyRemoteJid,
        key_from_me: messageData.keyFromMe || false,
        key_id: messageData.keyId,
        push_name: pushName,
        message_timestamp: messageData.messageTimestamp,
        body: messageData.content,
        message_type: messageData.messageType || 'text',
        timestamp: timestamp,
        from_me: messageData.keyFromMe || false,
        phone_number: phoneNumber,
        media_url: messageData.mediaUrl,
        media_key: messageData.mediaKey,
        file_enc_sha256: messageData.fileEncSha256,
        file_sha256: messageData.fileSha256,
        direct_path: messageData.directPath,
        media_mime_type: messageData.mediaMimeType,
        media_duration: messageData.mediaDuration,
        is_processed: false
      })
      .select('id');

    if (whatsappError) {
      console.error('❌ [SAVE] Erro ao salvar whatsapp_messages:', whatsappError);
      throw whatsappError;
    }

    console.log('✅ [SAVE] Mensagem salva em whatsapp_messages');

    // Salvar em ticket_messages também
    const { data: ticketMessage, error: ticketError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: null, // Será preenchido pelo trigger ou RPC
        message_id: messageData.keyId,
        content: messageData.content,
        message_type: messageData.messageType || 'text',
        from_me: messageData.keyFromMe || false,
        timestamp: timestamp,
        sender_name: pushName,
        media_url: messageData.mediaUrl,
        media_key: messageData.mediaKey,
        file_enc_sha256: messageData.fileEncSha256,
        file_sha256: messageData.fileSha256,
        direct_path: messageData.directPath,
        media_mime_type: messageData.mediaMimeType,
        media_duration: messageData.mediaDuration,
        processing_status: 'received'
      })
      .select('id, ticket_id');

    if (ticketError) {
      console.error('❌ [SAVE] Erro ao salvar ticket_messages:', ticketError);
    } else {
      console.log('✅ [SAVE] Mensagem salva em ticket_messages');
    }

    return {
      success: true,
      whatsappMessageId: whatsappMessage?.[0]?.id,
      ticketMessageId: ticketMessage?.[0]?.id,
      ticketId: ticketMessage?.[0]?.ticket_id
    };

  } catch (error) {
    console.error('❌ [SAVE] Erro crítico ao salvar mensagem:', error);
    throw error;
  }
}

// FUNÇÃO PARA GERENCIAR BATCH
async function upsertMessageBatch(chatId: string, clientId: string, instanceId: string, messageInfo: any) {
  try {
    console.log('🔥 [BATCH-RPC] Chamando manage_message_batch...');
    
    const { data: result, error } = await supabase.rpc('manage_message_batch', {
      p_chat_id: chatId,
      p_client_id: clientId,
      p_instance_id: instanceId,
      p_message: messageInfo
    });

    if (error) {
      console.error('❌ [BATCH-RPC] Erro na RPC, usando fallback:', error);
      return await upsertMessageBatchDirect(chatId, clientId, instanceId, messageInfo);
    }

    console.log('✅ [BATCH-RPC] Resultado:', result);

    // Se é um novo batch, agendar processamento
    if (result?.is_new_batch) {
      console.log('🔥 [BATCH-RPC] ⚡ Novo batch criado - agendando processamento em segundo plano');
      
      // Usar EdgeRuntime.waitUntil para processamento em background
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(
          scheduleBackgroundProcessing(result.batch_id, messageInfo.isAudio ? 5000 : BATCH_TIMEOUT)
        );
      }
    }

    return { success: true, isNewBatch: result?.is_new_batch, batchId: result?.batch_id };

  } catch (error) {
    console.error('❌ [BATCH-RPC] Erro crítico, usando fallback direto:', error);
    return await upsertMessageBatchDirect(chatId, clientId, instanceId, messageInfo);
  }
}

// FALLBACK DIRETO PARA BATCH
async function upsertMessageBatchDirect(chatId: string, clientId: string, instanceId: string, messageInfo: any) {
  try {
    console.log('🔥 [BATCH-DIRECT] Usando fallback direto...');

    const { data: existingBatch } = await supabase
      .from('message_batches')
      .select('id, messages')
      .eq('chat_id', chatId)
      .eq('client_id', clientId)
      .is('processing_started_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingBatch) {
      const updatedMessages = [...(existingBatch.messages as any[]), messageInfo];
      
      const { error } = await supabase
        .from('message_batches')
        .update({
          messages: updatedMessages,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingBatch.id);

      if (error) throw error;

      console.log('✅ [BATCH-DIRECT] Batch atualizado:', existingBatch.id);
      return { success: true, isNewBatch: false, batchId: existingBatch.id };
    } else {
      const { data: newBatch, error } = await supabase
        .from('message_batches')
        .insert({
          chat_id: chatId,
          client_id: clientId,
          instance_id: instanceId,
          messages: [messageInfo]
        })
        .select('id')
        .single();

      if (error) throw error;

      console.log('✅ [BATCH-DIRECT] Novo batch criado:', newBatch.id);
      return { success: true, isNewBatch: true, batchId: newBatch.id };
    }

  } catch (error) {
    console.error('❌ [BATCH-DIRECT] Erro no fallback:', error);
    return { success: false, error: error.message };
  }
}

// PROCESSAMENTO EM BACKGROUND
async function scheduleBackgroundProcessing(batchId: string, timeoutMs: number) {
  try {
    console.log(`🔥 [BACKGROUND] Agendando processamento para batch ${batchId} em ${timeoutMs}ms`);
    
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
    
    console.log(`🔥 [BACKGROUND] Iniciando processamento do batch ${batchId}`);
    
    const { data, error } = await supabase.functions.invoke('process-message-batches', {
      body: { batchId, source: 'webhook-scheduled' }
    });

    if (error) {
      console.error('❌ [BACKGROUND] Erro ao processar batch:', error);
    } else {
      console.log('✅ [BACKGROUND] Batch processado com sucesso:', data);
    }

  } catch (error) {
    console.error('❌ [BACKGROUND] Erro crítico no processamento:', error);
  }
}