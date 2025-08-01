/**
 * ETAPA 4: WEBHOOK REAL-TIME
 * Edge Function para processar webhooks do CodeChat v2.2.1 em tempo real
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  event: string;
  instance: string;
  data: {
    key?: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: any;
    messageTimestamp?: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎯 [WEBHOOK] Processando webhook CodeChat v2.2.1');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: WebhookPayload = await req.json();
    console.log('📥 [WEBHOOK] Payload recebido:', payload.event, payload.instance);

    // Processar apenas eventos de mensagem
    if (payload.event === 'messages.upsert') {
      const messageData = payload.data;
      const instanceId = payload.instance;
      
      // Buscar informações da instância no Supabase
      const { data: instanceInfo } = await supabase
        .from('whatsapp_instances')
        .select('client_id, business_business_id')
        .eq('instance_id', instanceId)
        .single();

      if (!instanceInfo) {
        console.warn('⚠️ [WEBHOOK] Instância não encontrada:', instanceId);
        return new Response(JSON.stringify({ error: 'Instance not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const clientId = instanceInfo.client_id;
      const chatId = messageData.key?.remoteJid;

      if (!chatId) {
        console.warn('⚠️ [WEBHOOK] Chat ID não encontrado na mensagem');
        return new Response(JSON.stringify({ error: 'Chat ID not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Extrair conteúdo da mensagem
      const content = messageData.message?.conversation || 
                     messageData.message?.extendedTextMessage?.text ||
                     messageData.message?.imageMessage?.caption ||
                     '[Mídia]';

      const customerName = messageData.pushName || chatId.split('@')[0];
      const customerPhone = chatId.includes('@s.whatsapp.net') ? chatId.split('@')[0] : chatId;

      // Criar ou atualizar ticket
      const { data: ticketId, error: ticketError } = await supabase.rpc('upsert_conversation_ticket', {
        p_client_id: clientId,
        p_chat_id: chatId,
        p_instance_id: instanceId,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_last_message: content,
        p_last_message_at: new Date(messageData.messageTimestamp * 1000).toISOString()
      });

      if (ticketError) {
        console.error('❌ [WEBHOOK] Erro ao criar/atualizar ticket:', ticketError);
        return new Response(JSON.stringify({ error: 'Ticket creation failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Extrair dados de mídia se aplicável
      const mediaData = extractMediaData(messageData.message);
      const messageType = getMessageType(messageData.message);
      
      // Inserir mensagem
      const messageRecord = {
        ticket_id: ticketId,
        message_id: messageData.key?.id || `webhook_${Date.now()}`,
        from_me: messageData.key?.fromMe || false,
        sender_name: messageData.key?.fromMe ? 'Atendente' : customerName,
        content: content,
        message_type: messageType,
        timestamp: new Date(messageData.messageTimestamp * 1000).toISOString(),
        processing_status: mediaData ? 'pending' : 'received',
        is_ai_response: false,
        // Dados de mídia criptografada
        ...(mediaData && {
          media_url: mediaData.media_url,
          media_key: mediaData.media_key,
          file_enc_sha256: mediaData.file_enc_sha256,
          file_sha256: mediaData.file_sha256,
          media_duration: mediaData.media_duration,
          file_name: mediaData.file_name
        })
      };

      const { error: messageError } = await supabase
        .from('ticket_messages')
        .insert(messageRecord);

      if (messageError) {
        console.error('❌ [WEBHOOK] Erro ao inserir mensagem:', messageError);
        return new Response(JSON.stringify({ error: 'Message insertion failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ [WEBHOOK] Mensagem processada com sucesso:', messageData.key?.id);

      // Se tem mídia pendente, processar automaticamente
      if (mediaData && messageType !== 'text') {
        console.log('🎯 [WEBHOOK] Iniciando processamento de mídia para:', messageType);
        
        try {
          // Chamar função de processamento de mídia (não aguardar resposta)
          supabase.functions.invoke('process-received-media').catch(error => {
            console.error('❌ [WEBHOOK] Erro ao processar mídia:', error);
          });
        } catch (error) {
          console.error('❌ [WEBHOOK] Erro ao invocar processamento de mídia:', error);
        }
      }

      // Se não for mensagem enviada por nós, processar com IA (implementar depois)
      if (!messageData.key?.fromMe) {
        console.log('🤖 [WEBHOOK] Mensagem do cliente - marcar para processamento IA');
        // TODO: Implementar processamento IA na próxima etapa
      }

      return new Response(JSON.stringify({ 
        success: true, 
        ticketId,
        messageId: messageRecord.message_id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Outros eventos (ignorar por enquanto)
    console.log('ℹ️ [WEBHOOK] Evento ignorado:', payload.event);
    return new Response(JSON.stringify({ success: true, ignored: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [WEBHOOK] Erro no processamento:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function getMessageType(message: any): string {
  if (message?.conversation || message?.extendedTextMessage) return 'text';
  if (message?.imageMessage) return 'image';
  if (message?.videoMessage) return 'video';
  if (message?.audioMessage) return 'audio';
  if (message?.documentMessage) return 'document';
  return 'unknown';
}

function extractMediaData(message: any): any {
  if (!message) return null
  
  // Áudio
  if (message.audioMessage) {
    return {
      media_url: message.audioMessage.url,
      media_key: message.audioMessage.mediaKey,
      file_enc_sha256: message.audioMessage.fileEncSha256,
      file_sha256: message.audioMessage.fileSha256,
      direct_path: message.audioMessage.directPath,
      mime_type: message.audioMessage.mimetype,
      media_duration: message.audioMessage.seconds
    }
  }
  
  // Imagem
  if (message.imageMessage) {
    return {
      media_url: message.imageMessage.url,
      media_key: message.imageMessage.mediaKey,
      file_enc_sha256: message.imageMessage.fileEncSha256,
      file_sha256: message.imageMessage.fileSha256,
      direct_path: message.imageMessage.directPath,
      mime_type: message.imageMessage.mimetype
    }
  }
  
  // Vídeo
  if (message.videoMessage) {
    return {
      media_url: message.videoMessage.url,
      media_key: message.videoMessage.mediaKey,
      file_enc_sha256: message.videoMessage.fileEncSha256,
      file_sha256: message.videoMessage.fileSha256,
      direct_path: message.videoMessage.directPath,
      mime_type: message.videoMessage.mimetype,
      media_duration: message.videoMessage.seconds
    }
  }
  
  // Documento
  if (message.documentMessage) {
    return {
      media_url: message.documentMessage.url,
      media_key: message.documentMessage.mediaKey,
      file_enc_sha256: message.documentMessage.fileEncSha256,
      file_sha256: message.documentMessage.fileSha256,
      direct_path: message.documentMessage.directPath,
      mime_type: message.documentMessage.mimetype,
      file_name: message.documentMessage.fileName,
      file_length: message.documentMessage.fileLength
    }
  }
  
  return null
}