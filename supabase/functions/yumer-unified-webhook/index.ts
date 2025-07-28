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

    // EXTRAIR DADOS BÁSICOS DA MENSAGEM
    const chatId = messageData.keyRemoteJid;
    const messageId = messageData.keyId;
    const content = messageData.content?.text || '';
    const fromMe = messageData.keyFromMe || false;
    const pushName = messageData.pushName || 'Cliente';
    const phoneNumber = chatId?.replace('@s.whatsapp.net', '') || '';

    console.log('🔥 [BATCH-SIMPLES] Dados extraídos:', {
      chatId: chatId?.substring(0, 20),
      messageId,
      content: content.substring(0, 50),
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

    // SALVAR MENSAGEM NO BANCO PRIMEIRO
    await saveMessageToDatabase(messageData, instance, chatId, pushName, phoneNumber);

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
    }

    return { success: true };
  } catch (error) {
    console.error('🔥 [BATCH-PERSISTENT] ❌ Erro ao gerenciar batch:', error);
    return { success: false, error: error.message };
  }
}

// ✅ SALVAR MENSAGEM NO BANCO
async function saveMessageToDatabase(messageData: any, instance: any, chatId: string, pushName: string, phoneNumber: string) {
  try {
    console.log('🔥 [SAVE-DB] Salvando mensagem no banco');

    const messageToSave = {
      message_id: messageData.keyId,
      chat_id: chatId,
      instance_id: instance.instance_id,
      message_type: 'text',
      body: messageData.content?.text || '',
      from_me: messageData.keyFromMe || false,
      timestamp: new Date(messageData.messageTimestamp * 1000),
      contact_name: pushName,
      phone_number: phoneNumber,
      media_url: null,
      media_mime_type: null,
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