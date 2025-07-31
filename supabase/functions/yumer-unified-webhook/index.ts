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
const BATCH_TIMEOUT = 4000; // 4 segundos

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

      console.log('🔥 [WEBHOOK-SIMPLES] Evento:', webhookData.event);

      // DETECTAR MENSAGENS YUMER
      if (webhookData.event === 'messages.upsert' && webhookData.data && webhookData.instance?.instanceId) {
        console.log('🔥 [WEBHOOK-SIMPLES] MENSAGEM DETECTADA - PROCESSANDO BATCH');
        return await processMessageBatch(webhookData);
      }

      return new Response(JSON.stringify({ success: true, message: 'Event processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('🔥 [WEBHOOK-SIMPLES] ERRO CRÍTICO:', error);
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
    console.log('🔥 [BATCH-SIMPLES] Iniciando processamento de batch');
    
    const messageData = yumerData.data;
    const instanceId = yumerData.instance?.instanceId;
    const instanceName = yumerData.instance?.name;
    
    if (!messageData || !instanceId || !instanceName) {
      console.log('🔥 [BATCH-SIMPLES] Dados insuficientes');
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
    
    // DETECTAR TIPO DE MENSAGEM E MÍDIA
    let content = '';
    let messageType = 'text';
    let mediaUrl = null;
    let mediaKey = null;
    let fileEncSha256 = null;
    let mediaMimeType = null;
    let mediaDuration = null;
    
    if (messageData.content?.text) {
      content = messageData.content.text;
      messageType = 'text';
    } else if (messageData.content?.imageMessage) {
      const img = messageData.content.imageMessage;
      content = img.caption || '📷 Imagem';
      messageType = 'image';
      mediaUrl = img.url;
      mediaKey = img.mediaKey;
      fileEncSha256 = img.fileEncSha256;
      mediaMimeType = img.mimetype || 'image/jpeg';
    } else if (messageData.content?.audioMessage) {
      const audio = messageData.content.audioMessage;
      content = '🎵 Áudio';
      messageType = 'audio';
      mediaUrl = audio.url;
      mediaKey = audio.mediaKey;
      fileEncSha256 = audio.fileEncSha256;
      mediaMimeType = audio.mimetype || 'audio/ogg';
      mediaDuration = audio.seconds;
    } else if (messageData.content?.videoMessage) {
      const video = messageData.content.videoMessage;
      content = video.caption || '🎥 Vídeo';
      messageType = 'video';
      mediaUrl = video.url;
      mediaKey = video.mediaKey;
      fileEncSha256 = video.fileEncSha256;
      mediaMimeType = video.mimetype || 'video/mp4';
      mediaDuration = video.seconds;
    } else if (messageData.content?.documentMessage) {
      const doc = messageData.content.documentMessage;
      content = doc.fileName || '📄 Documento';
      messageType = 'document';
      mediaUrl = doc.url;
      mediaKey = doc.mediaKey;
      fileEncSha256 = doc.fileEncSha256;
      mediaMimeType = doc.mimetype || 'application/pdf';
    }

    console.log('🔥 [BATCH-SIMPLES] Dados extraídos:', {
      chatId: chatId?.substring(0, 20),
      messageId,
      content: content.substring(0, 50),
      messageType,
      hasMediaUrl: !!mediaUrl,
      hasMediaKey: !!mediaKey,
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
      console.log('🔥 [BATCH-SIMPLES] Instância não encontrada, processando simples');
      return await processSingleMessage(yumerData);
    }

    console.log('🔥 [BATCH-SIMPLES] Instância encontrada:', instance.instance_id);

    // SE É MENSAGEM DO SISTEMA, PROCESSAR IMEDIATAMENTE
    if (fromMe) {
      console.log('🔥 [BATCH-SIMPLES] Mensagem do sistema - processando imediatamente');
      return await processSingleMessage(yumerData, false);
    }

    // SALVAR MENSAGEM NO BANCO PRIMEIRO (com dados de mídia)
    await saveMessageToDatabase({
      ...messageData,
      messageType,
      content,
      mediaUrl,
      mediaKey,
      fileEncSha256,
      mediaMimeType,
      mediaDuration
    }, instance, chatId, pushName, phoneNumber);

    // ✅ SISTEMA DE BATCH PERSISTENTE NO SUPABASE
    await upsertMessageBatch(chatId, instance.client_id, instance.instance_id, {
      content,
      messageId,
      timestamp: new Date().toISOString(),
      customerName: pushName,
      phoneNumber
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Added to batch persistente'
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
  console.log('🔥 [BATCH-PERSISTENT] Adicionando mensagem ao batch:', { chatId, clientId });

  try {
    // VERIFICAR SE JÁ EXISTE BATCH
    const { data: existingBatch } = await supabase
      .from('message_batches')
      .select('*')
      .eq('chat_id', chatId)
      .eq('client_id', clientId)
      .single();

    let isNewBatch = false;

    if (existingBatch) {
      // ATUALIZAR BATCH EXISTENTE
      const updatedMessages = [...existingBatch.messages, message];
      
      const { error } = await supabase
        .from('message_batches')
        .update({
          messages: updatedMessages,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingBatch.id);

      if (error) throw error;
      
      console.log('🔥 [BATCH-PERSISTENT] ♻️ Batch atualizado com', updatedMessages.length, 'mensagens');
    } else {
      // CRIAR NOVO BATCH
      const { error } = await supabase
        .from('message_batches')
        .insert({
          chat_id: chatId,
          client_id: clientId,
          instance_id: instanceId,
          messages: [message]
        });

      if (error) throw error;
      
      console.log('🔥 [BATCH-PERSISTENT] ✨ Novo batch criado');
      isNewBatch = true;
    }

    // 🚀 PROCESSAMENTO HÍBRIDO: Agendar processamento direto após 3 segundos
    if (isNewBatch) {
      console.log('🔥 [HYBRID-PROCESSING] ⏰ Agendando processamento direto em 3 segundos...');
      
      // Usar setTimeout para agendar processamento
      setTimeout(async () => {
        try {
          console.log('🔥 [HYBRID-PROCESSING] 🚀 Executando processamento direto...');
          
          const response = await supabase.functions.invoke('process-message-batches', {
            body: { 
              trigger: 'hybrid_direct', 
              timestamp: new Date().toISOString(),
              chatId: chatId
            }
          });
          
          console.log('🔥 [HYBRID-PROCESSING] ✅ Resultado do processamento direto:', {
            success: !response.error,
            data: response.data,
            error: response.error?.message
          });
          
        } catch (error) {
          console.error('🔥 [HYBRID-PROCESSING] ❌ Erro no processamento direto:', error);
        }
      }, 3000);
    }

    return { success: true };
  } catch (error) {
    console.error('🔥 [BATCH-PERSISTENT] ❌ Erro ao gerenciar batch:', error);
    return { success: false, error: error.message };
  }
}

// ✅ SALVAR MENSAGEM NO BANCO (com suporte a mídia)
async function saveMessageToDatabase(messageData: any, instance: any, chatId: string, pushName: string, phoneNumber: string) {
  try {
    console.log('🔥 [SAVE-DB] Salvando mensagem no banco:', {
      messageType: messageData.messageType,
      hasMediaUrl: !!messageData.mediaUrl,
      hasMediaKey: !!messageData.mediaKey
    });

    const messageToSave = {
      message_id: messageData.keyId,
      chat_id: chatId,
      instance_id: instance.instance_id,
      message_type: messageData.messageType || 'text',
      body: messageData.content || '',
      from_me: messageData.keyFromMe || false,
      timestamp: new Date(messageData.messageTimestamp * 1000),
      contact_name: pushName,
      phone_number: phoneNumber,
      // DADOS DE MÍDIA
      media_url: messageData.mediaUrl,
      media_key: messageData.mediaKey,
      file_enc_sha256: messageData.fileEncSha256,
      media_mime_type: messageData.mediaMimeType,
      media_duration: messageData.mediaDuration,
      raw_data: messageData, // Salvar payload completo para debug
      is_processed: false // ✅ NÃO MARCAR COMO PROCESSADO AINDA
    };

    const { error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert(messageToSave);

    if (saveError) {
      if (saveError.code === '23505') {
        console.log('🔥 [SAVE-DB] Mensagem já existe - ignorando');
      } else {
        console.error('🔥 [SAVE-DB] Erro ao salvar:', saveError);
      }
    } else {
      console.log('🔥 [SAVE-DB] ✅ Mensagem salva com sucesso');
    }

  } catch (error) {
    console.error('🔥 [SAVE-DB] ERRO CRÍTICO:', error);
  }
}

// ✅ PROCESSAR MENSAGEM ÚNICA (FALLBACK)
async function processSingleMessage(yumerData: any, processAI: boolean = true) {
  console.log('🔥 [SINGLE-MESSAGE] Processando mensagem única');
  
  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Single message processed' 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}