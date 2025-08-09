import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

console.log('🚀 [MESSAGE-PROCESSOR] Sistema único iniciado');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      status: 'active', 
      message: 'Message Processor - Sistema Único Clean',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (req.method === 'POST') {
    try {
      const webhookData = await req.json();
      console.log('📨 [MESSAGE-PROCESSOR] Webhook recebido:', webhookData.event);

      // Processar apenas mensagens do Yumer (suporta ambos formatos)
      const event = webhookData?.event;
      const isMessageEvent = event === 'messages.upsert' || event === 'messagesUpsert';
      if (isMessageEvent && webhookData.data) {
        return await processMessage(webhookData);
      }

      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('❌ [MESSAGE-PROCESSOR] Erro:', error);
      return new Response(JSON.stringify({ error: (error as any).message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});

async function processMessage(webhookData: any) {
  const messageData = webhookData.data;
  // Resolver instanceId de várias formas possíveis
  const instanceId = webhookData.instance?.instanceId 
    || messageData?.instanceInstanceId 
    || webhookData?.instanceId 
    || messageData?.instance?.instanceId;
  
  if (!messageData || !instanceId) {
    return new Response(JSON.stringify({ error: 'Dados inválidos', hasData: !!messageData, instanceId }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('🔄 [PROCESS] Iniciando processamento:', messageData.keyId);

    // 1. BUSCAR INSTÂNCIA E CLIENT_ID
    const { data: instanceData } = await supabase
      .from('whatsapp_instances')
      .select('client_id, id')
      .eq('instance_id', instanceId)
      .single();

    if (!instanceData) {
      console.error('❌ [PROCESS] Instância não encontrada:', instanceId);
      return new Response(JSON.stringify({ error: 'Instância não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const clientId = instanceData.client_id;
    console.log('✅ [PROCESS] Cliente encontrado:', clientId);

    // 2. EXTRAIR DADOS DA MENSAGEM (com fallbacks robustos)
    const chatId = messageData.keyRemoteJid || messageData.remoteJid || messageData.key?.remoteJid;
    const messageId = messageData.keyId || messageData.messageId || messageData.key?.id;
    const fromMeRaw = messageData.keyFromMe ?? messageData.fromMe ?? messageData.key?.fromMe;
    const fromMe = typeof fromMeRaw === 'boolean'
      ? fromMeRaw
      : (fromMeRaw === true || fromMeRaw === 'true' || fromMeRaw === 1 || fromMeRaw === '1');
    const timestamp = messageData.messageTimestamp
      ? new Date(messageData.messageTimestamp * 1000)
      : (messageData.createdAt ? new Date(messageData.createdAt) : new Date());
    const senderName = messageData.pushName || messageData.verifiedBizName || 'Usuário';
    
    // Conteúdo da mensagem
    let content = '';
    let messageType: 'text' | 'audio' | 'ptt' | 'image' | 'video' | 'document' = 'text';
    let mediaData: any = null;

    // Novo: detectar mídia no formato contentType/content (Yumer v2)
    if (messageData.contentType && messageData.content) {
      const ct = String(messageData.contentType).toLowerCase();
      const c = messageData.content || {};
      if (ct === 'audio') {
        content = '🎵 Áudio';
        messageType = c.ptt ? 'ptt' : 'audio';
        mediaData = {
          url: c.url,
          mediaKey: c.mediaKey,
          mimetype: c.mimetype,
          fileEncSha256: c.fileEncSha256,
          fileSha256: c.fileSha256,
          directPath: c.directPath,
          seconds: c.seconds,
          fileLength: c.fileLength
        };
      } else if (ct === 'image') {
        content = '📷 Imagem';
        messageType = 'image';
        mediaData = {
          url: c.url,
          mediaKey: c.mediaKey,
          mimetype: c.mimetype,
          fileEncSha256: c.fileEncSha256,
          fileSha256: c.fileSha256,
          directPath: c.directPath
        };
      } else if (ct === 'video') {
        content = '📹 Vídeo';
        messageType = 'video';
        mediaData = {
          url: c.url,
          mediaKey: c.mediaKey,
          mimetype: c.mimetype,
          fileEncSha256: c.fileEncSha256,
          fileSha256: c.fileSha256,
          directPath: c.directPath
        };
      } else if (ct === 'document' || ct === 'sticker') {
        content = `📄 Documento`;
        messageType = 'document';
        mediaData = {
          url: c.url,
          mediaKey: c.mediaKey,
          mimetype: c.mimetype,
          fileEncSha256: c.fileEncSha256,
          fileSha256: c.fileSha256,
          directPath: c.directPath
        };
      } else if (c.text) {
        content = c.text;
      }
    } else if (messageData.message?.conversation) {
      content = messageData.message.conversation;
    } else if (messageData.message?.extendedTextMessage?.text) {
      content = messageData.message.extendedTextMessage.text;
    } else if (messageData.content?.text) {
      // Fallback para payload "data.content.text"
      content = messageData.content.text;
    } else if (messageData.message?.audioMessage) {
      content = '🎵 Áudio';
      messageType = 'audio';
      mediaData = extractMediaData(messageData.message.audioMessage);
    } else if (messageData.message?.imageMessage) {
      content = '📷 Imagem';
      messageType = 'image';
      mediaData = extractMediaData(messageData.message.imageMessage);
    } else if (messageData.message?.videoMessage) {
      content = '📹 Vídeo';
      messageType = 'video';
      mediaData = extractMediaData(messageData.message.videoMessage);
    } else if (messageData.message?.documentMessage) {
      content = `📄 ${messageData.message.documentMessage.fileName || 'Documento'}`;
      messageType = 'document';
      mediaData = extractMediaData(messageData.message.documentMessage);
    }

    console.log('📝 [PROCESS] Mensagem extraída:', { content, messageType, fromMe });

    // 3. GUARDA DE IDEMPOTÊNCIA (evitar duplas inserções e respostas)
    const { data: existingTicketMessage } = await supabase
      .from('ticket_messages')
      .select('id,ticket_id')
      .eq('message_id', messageId)
      .maybeSingle();

    if (existingTicketMessage) {
      console.log('🔁 [IDEMPOTENCY] Mensagem já processada, ignorando duplicata:', messageId);
      return new Response(JSON.stringify({
        success: true,
        messageId,
        ticketId: existingTicketMessage.ticket_id,
        processed: true,
        deduped: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. SALVAR MENSAGEM NO BANCO (whatsapp_messages)
    const { error: messageError } = await supabase
      .from('whatsapp_messages')
      .insert({
        message_id: messageId,
        chat_id: chatId,
        instance_id: instanceId,
        client_id: clientId,
        from_me: fromMe,
        body: content,
        message_type: messageType,
        sender: senderName,
        timestamp,
        media_key: mediaData?.mediaKey,
        media_url: mediaData?.url,
        file_enc_sha256: mediaData?.fileEncSha256,
        file_sha256: mediaData?.fileSha256,
        media_mime_type: mediaData?.mimetype,
        media_duration: mediaData?.seconds,
        direct_path: mediaData?.directPath,
        is_processed: fromMe ? true : false, // Cliente: pendente até IA responder
        processed_at: fromMe ? new Date() : null
      });

    if (messageError) {
      console.error('❌ [PROCESS] Erro ao salvar mensagem:', messageError);
    } else {
      console.log('✅ [PROCESS] Mensagem salva no banco');
    }

    // 4. CRIAR/ATUALIZAR TICKET
    const ticketResult = await supabase.rpc('upsert_conversation_ticket', {
      p_client_id: clientId,
      p_chat_id: chatId,
      p_instance_id: instanceId,
      p_customer_name: senderName,
      p_customer_phone: chatId.split('@')[0],
      p_last_message: content,
      p_last_message_at: timestamp
    });

    if (ticketResult.error) {
      console.error('❌ [PROCESS] Erro ao criar/atualizar ticket:', ticketResult.error);
    } else {
      console.log('✅ [PROCESS] Ticket criado/atualizado:', ticketResult.data);
    }

    const ticketId = ticketResult.data;

    // 5. SALVAR MENSAGEM NO TICKET
    if (ticketId) {
      const insertPayload = {
        ticket_id: ticketId,
        message_id: messageId,
        content,
        message_type: messageType,
        from_me: fromMe,
        timestamp,
        sender_name: senderName,
        media_url: mediaData?.url,
        media_duration: mediaData?.seconds,
        media_key: mediaData?.mediaKey,
        file_enc_sha256: mediaData?.fileEncSha256,
        file_sha256: mediaData?.fileSha256,
        media_mime_type: mediaData?.mimetype,
        direct_path: mediaData?.directPath,
        processing_status: 'received'
      };

      const { error: ticketMessageError } = await supabase
        .from('ticket_messages')
        .upsert(insertPayload, { onConflict: 'message_id', ignoreDuplicates: true });

      if (ticketMessageError) {
        console.error('❌ [PROCESS] Erro ao salvar no ticket:', ticketMessageError);
      } else {
        console.log('✅ [PROCESS] Mensagem salva no ticket');
        // Disparar processamento de mídia (descrifrar + transcrever) para áudio
        try {
          if ((messageType === 'audio' || messageType === 'ptt') && mediaData) {
            const resp = await supabase.functions.invoke('process-received-media', {
              body: {
                messageId,
                instanceId,
                mediaType: 'audio',
                mimetype: mediaData?.mimetype,
                url: mediaData?.url,
                mediaKey: mediaData?.mediaKey,
                directPath: mediaData?.directPath
              }
            });
            if (resp.error) {
              console.error('❌ [MEDIA] Erro ao invocar process-received-media:', resp.error);
            } else {
              console.log('✅ [MEDIA] process-received-media invocada:', resp.data);
            }
          }
        } catch (e) {
          console.error('❌ [MEDIA] Falha ao agendar processamento de mídia:', e);
        }

        // Fallback agressivo: garantir resposta de texto imediata
        try {
          if (!fromMe && messageType === 'text' && ticketId) {
            console.log('🚀 [FALLBACK] Preparando batch imediato e artifact antes da IA');
            // 1) Criar batch imediato para garantir que a IA tenha conteúdo para processar
            const payload = {
              chat_id: chatId,
              client_id: clientId,
              instance_id: instanceId,
              message: {
                messageId,
                chatId,
                content,
                fromMe: false,
                timestamp: Math.floor((timestamp instanceof Date ? timestamp.getTime() : Date.now()) / 1000)
              }
            };
            const batchResp = await supabase.rpc('manage_message_batch_immediate', { p_payload: payload });
            if (batchResp.error) {
              console.error('❌ [FALLBACK] Erro ao criar batch imediato:', batchResp.error);
            } else {
              console.log('✅ [FALLBACK] Batch imediato criado:', batchResp.data);
              // Acionar processamento em blocos para agregar múltiplas mensagens do chat
              try {
                const batchProc = await supabase.functions.invoke('process-message-batches', {
                  body: { trigger: 'webhook', limit: 10, debounceWindowSec: 10 }
                });
                if (batchProc.error) {
                  console.error('❌ [BATCH] Erro ao invocar process-message-batches:', batchProc.error);
                } else {
                  console.log('✅ [BATCH] process-message-batches acionado:', batchProc.data);
                }
              } catch (batchErr) {
                console.error('❌ [BATCH] Falha ao acionar processamento em blocos:', batchErr);
              }
            }

            // 2) Registrar artifact de texto (idempotente)
            const artifact = {
              message_id: messageId,
              correlation_id: `ticket:${ticketId}`,
              ticket_id: ticketId,
              client_id: clientId,
              instance_id: instanceId,
              chat_id: chatId,
              type: 'clean_text',
              status: 'done',
              payload: { text: content, sender: senderName },
              pipeline: 'text@1.0.0',
              idempotency_key: `${messageId}-clean_text`
            };
            const { error: artifactErr } = await supabase
              .from('message_artifacts')
              .upsert(artifact, { onConflict: 'idempotency_key' });
            if (artifactErr) {
              console.error('❌ [FALLBACK] Erro ao registrar artifact de texto:', artifactErr);
            } else {
              console.log('✅ [FALLBACK] Artifact de texto registrado');
            }

            // 3) Envio direto da IA foi desativado para garantir batching de texto
            console.log('🛑 [FALLBACK] Envio direto desabilitado (texto será processado em lotes após janela de debounce)');
          }
        } catch (e) {
          console.error('❌ [FALLBACK] Falha no caminho de preparação para batching:', e);
        }
      }
    }

    // 6. AGENDAR IA VIA DEBOUNCE (apenas para mensagens recebidas)
    if (!fromMe && ticketId) {
      try {
        // Janela de debounce: 10s para texto, 10s para mídia (garante batching)
        const hasMedia = ['audio','ptt','image','video','document'].includes(messageType);
        const timeoutSec = hasMedia ? 10 : 10;
        const debounceUntil = new Date(Date.now() + timeoutSec * 1000).toISOString();

        // Upsert do estado de debounce por ticket
        const { error: upsertErr } = await supabase
          .from('assistant_debounce')
          .upsert({
            ticket_id: ticketId,
            client_id: clientId,
            instance_id: instanceId,
            chat_id: chatId,
            debounce_until: debounceUntil,
            scheduled: true,
            last_updated: new Date().toISOString()
          }, { onConflict: 'ticket_id' });

        if (upsertErr) {
          console.error('❌ [DEBOUNCE] Erro no upsert assistant_debounce:', upsertErr);
        }

        // Disparar processador imediato (idempotente)
        const resp = await supabase.functions.invoke('immediate-batch-processor', {
          body: { ticketId }
        });

        if (resp.error) {
          console.error('❌ [DEBOUNCE] Erro ao invocar immediate-batch-processor:', resp.error);
        } else {
          console.log('✅ [DEBOUNCE] immediate-batch-processor acionado');
        }
      } catch (e) {
        console.error('❌ [DEBOUNCE] Falha ao agendar processamento:', e);
      }
    }

    console.log('🎉 [PROCESS] Processamento completo');

    return new Response(JSON.stringify({ 
      success: true,
      messageId,
      ticketId,
      processed: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [PROCESS] Erro crítico:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

function extractMediaData(mediaObj: any) {
  if (!mediaObj) return null;
  
  return {
    url: mediaObj.url,
    mediaKey: mediaObj.mediaKey,
    mimetype: mediaObj.mimetype,
    fileEncSha256: mediaObj.fileEncSha256,
    fileSha256: mediaObj.fileSha256,
    directPath: mediaObj.directPath,
    seconds: mediaObj.seconds,
    fileLength: mediaObj.fileLength
  };
}