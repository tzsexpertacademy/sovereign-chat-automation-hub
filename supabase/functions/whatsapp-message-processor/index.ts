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

      // Inserir mensagem
      const messageRecord = {
        ticket_id: ticketId,
        message_id: messageData.key?.id || `webhook_${Date.now()}`,
        from_me: messageData.key?.fromMe || false,
        sender_name: messageData.key?.fromMe ? 'Atendente' : customerName,
        content: content,
        message_type: getMessageType(messageData.message),
        timestamp: new Date(messageData.messageTimestamp * 1000).toISOString(),
        processing_status: 'received',
        is_ai_response: false
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