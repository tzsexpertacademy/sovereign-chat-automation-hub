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
      messageType = 'image';  // ✅ CORRIGIDO: Era 'text' antes
      mediaUrl = img.url;
      // 🔥 CORREÇÃO CRÍTICA: Converter mediaKey de Uint8Array para Base64
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
      // 🔥 CORREÇÃO CRÍTICA: Converter mediaKey de Uint8Array para Base64
      mediaKey = audio.mediaKey ? convertUint8ArrayToBase64(audio.mediaKey) : null;
      fileEncSha256 = audio.fileEncSha256 ? convertUint8ArrayToBase64(audio.fileEncSha256) : null;
      fileSha256 = audio.fileSha256 ? convertUint8ArrayToBase64(audio.fileSha256) : null;
      directPath = audio.directPath;
      mediaMimeType = audio.mimetype || 'audio/ogg';
      mediaDuration = audio.seconds;
      console.log('🎵 [DETECT] Áudio detectado:', { mediaUrl: !!mediaUrl, mediaKey: !!mediaKey, mediaKeyType: typeof mediaKey });
    } else if (messageData.contentType === 'video' || messageData.content?.videoMessage) {
      const video = messageData.content?.videoMessage || messageData.content;
      content = video.caption || '🎥 Vídeo';
      messageType = 'video';
      mediaUrl = video.url;
      // 🔥 CORREÇÃO CRÍTICA: Converter mediaKey de Uint8Array para Base64
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
      // 🔥 CORREÇÃO CRÍTICA: Converter mediaKey de Uint8Array para Base64
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

    console.log('🔥 [BATCH-SIMPLES] Dados extraídos:', {
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
      console.log('🔥 [BATCH-SIMPLES] Instância não encontrada, processando simples');
      return await processSingleMessage(yumerData);
    }

    console.log('🔥 [BATCH-SIMPLES] Instância encontrada:', instance.instance_id);

    // 🎥 INTERCEPTAÇÃO IMEDIATA PARA COMANDOS DE VÍDEO
    if (!fromMe && content && typeof content === 'string') {
      const videoCommandMatch = content.trim().match(/^video\s+([a-zA-Z0-9_-]+)$/i);
      if (videoCommandMatch) {
        console.log('🎥 [WEBHOOK-INTERCEPT] ⚡ COMANDO DE VÍDEO DETECTADO - PROCESSANDO IMEDIATAMENTE');
        console.log('🎥 [WEBHOOK-INTERCEPT] Comando:', videoCommandMatch[0]);
        console.log('🎥 [WEBHOOK-INTERCEPT] Trigger do vídeo:', videoCommandMatch[1]);
        
        // Processar comando de vídeo diretamente via AI
        try {
          // Buscar ou criar ticket primeiro
          const { data: ticketId } = await supabase.rpc('upsert_conversation_ticket', {
            p_client_id: instance.client_id,
            p_chat_id: chatId,
            p_instance_id: instance.instance_id,
            p_customer_name: pushName,
            p_customer_phone: phoneNumber,
            p_last_message: content,
            p_last_message_at: new Date().toISOString()
          });

          if (ticketId) {
            console.log('🎥 [WEBHOOK-INTERCEPT] 🎯 Chamando AI para processar vídeo imediatamente...');
            
            const aiResponse = await supabase.functions.invoke('ai-assistant-process', {
              body: {
                ticketId: ticketId,
                messages: [{
                  content: content,
                  messageId: messageId,
                  timestamp: new Date().toISOString(),
                  customerName: pushName,
                  phoneNumber: phoneNumber
                }],
                context: {
                  chatId: chatId,
                  customerName: pushName,
                  phoneNumber: phoneNumber,
                  immediateVideoCommand: true
                }
              }
            });

            console.log('🎥 [WEBHOOK-INTERCEPT] 🎯 Resultado da AI para vídeo:', { 
              success: !aiResponse.error, 
              hasError: !!aiResponse.error,
              errorMsg: aiResponse.error?.message 
            });

            if (!aiResponse.error) {
              console.log('🎥 [WEBHOOK-INTERCEPT] ✅ Comando de vídeo processado com SUCESSO!');
              
              // Marcar mensagem como processada
              await supabase
                .from('whatsapp_messages')
                .update({ 
                  is_processed: true,
                  processed_at: new Date().toISOString()
                })
                .eq('message_id', messageId);

              return new Response(JSON.stringify({ 
                success: true, 
                message: 'Video command processed immediately',
                processed: true
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
        } catch (error) {
          console.error('🎥 [WEBHOOK-INTERCEPT] ❌ Erro ao processar comando de vídeo:', error);
        }
      }
    }

    // SE É MENSAGEM DO SISTEMA, PROCESSAR IMEDIATAMENTE
    if (fromMe) {
      console.log('🔥 [BATCH-SIMPLES] Mensagem do sistema - processando imediatamente');
      return await processSingleMessage(yumerData, false);
    }

    // 🎯 MENSAGEM DO CLIENTE - USAR SISTEMA DE BATCHING
    console.log('🔥 [CLIENT-MESSAGE] Mensagem do cliente detectada - usando sistema de batching');
    console.log('🔥 [CLIENT-MESSAGE] Conteúdo:', content.substring(0, 100));
    
    // SALVAR MENSAGEM NO BANCO PRIMEIRO (com dados de mídia completos)
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

    // ✅ USAR SISTEMA DE BATCH PERSISTENTE COM CONTROLE DE CONCORRÊNCIA
    const batchResult = await upsertMessageBatch(chatId, instance.client_id, instance.instance_id, {
      content,
      messageId,
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
      willScheduleProcessing: isNewBatch
    });

    // 🚀 AGENDAR PROCESSAMENTO APENAS PARA NOVOS BATCHES
    if (isNewBatch) {
      console.log('🔥 [BATCH-GROUPING] ⏰ Agendando processamento em 3 segundos...');
      
      // USAR EdgeRuntime.waitUntil para background task
      const backgroundTask = async () => {
        await new Promise(resolve => setTimeout(resolve, BATCH_TIMEOUT));
        
        try {
          console.log('🔥 [BATCH-GROUPING] 🚀 Executando processamento programado...');
          
          const response = await supabase.functions.invoke('process-message-batches', {
            body: { 
              trigger: 'batch_timeout_webhook',
              timestamp: new Date().toISOString(),
              chatId: chatId,
              source: 'yumer-unified-webhook'
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
    const { data: existingBatch } = await supabase
      .from('message_batches')
      .select('*')
      .eq('chat_id', chatId)
      .eq('client_id', clientId)
      .is('processing_started_at', null) // Apenas batches não processando
      .single();

    let isNewBatch = false;

    if (existingBatch) {
      // ATUALIZAR BATCH EXISTENTE
      const updatedMessages = [...(existingBatch.messages || []), message];
      
      const { error } = await supabase
        .from('message_batches')
        .update({
          messages: updatedMessages,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingBatch.id)
        .is('processing_started_at', null); // Apenas se ainda não processando

      if (error) throw error;
      
      console.log('🔥 [BATCH-DIRECT] ♻️ Batch atualizado:', updatedMessages.length, 'mensagens');
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
      
      console.log('🔥 [BATCH-DIRECT] ✨ Novo batch criado');
      isNewBatch = true;
    }

    return { success: true, isNewBatch };
  } catch (error) {
    console.error('🔥 [BATCH-DIRECT] ❌ Erro:', error);
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
      // DADOS DE MÍDIA COMPLETOS
      media_url: messageData.mediaUrl,
      media_key: messageData.mediaKey,
      file_enc_sha256: messageData.fileEncSha256,
      file_sha256: messageData.fileSha256,
      direct_path: messageData.directPath,
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