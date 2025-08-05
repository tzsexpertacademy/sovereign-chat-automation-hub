import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  console.log('🔥 [YUMER-WEBHOOK] Requisição recebida:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'active', message: 'YUMER Webhook Principal - CodeChat v2' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'POST') {
    try {
      const webhookData = await req.json();
      console.log('🔥 [YUMER-WEBHOOK] Dados recebidos:', JSON.stringify(webhookData, null, 2));

      // DETECTAR MENSAGENS YUMER
      if (webhookData.event === 'messages.upsert' && webhookData.data && webhookData.instance?.instanceId) {
        console.log('📨 [YUMER-WEBHOOK] MENSAGEM DETECTADA - PROCESSANDO');
        return await processYumerMessage(webhookData);
      }

      return new Response(JSON.stringify({ success: true, message: 'Event processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('❌ [YUMER-WEBHOOK] ERRO CRÍTICO:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: corsHeaders
  });
});

// 🔧 FUNÇÃO PRINCIPAL PARA PROCESSAR MENSAGEM YUMER
async function processYumerMessage(yumerData: any) {
  try {
    console.log('🔧 [PROCESS-YUMER] Iniciando processamento da mensagem');
    
    const messageData = yumerData.data;
    const instanceId = yumerData.instance?.instanceId;
    
    if (!instanceId) {
      throw new Error('Instance ID não encontrado');
    }

    // 🔍 BUSCAR INSTÂNCIA E CLIENT_ID
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('client_id, id')
      .eq('instance_id', instanceId)
      .single();

    if (instanceError || !instance) {
      console.error('❌ [PROCESS-YUMER] Instância não encontrada:', instanceError);
      throw new Error(`Instância não encontrada: ${instanceId}`);
    }

    const clientId = instance.client_id;
    console.log('✅ [PROCESS-YUMER] Instância encontrada:', { instanceId, clientId });

    // 🗺️ MAPEAMENTO DEFINITIVO DOS CAMPOS YUMER PARA BANCO
    const mappedMessage = {
      message_id: messageData.keyId || messageData.messageId,
      chat_id: messageData.keyRemoteJid || messageData.chatId,
      body: messageData.content?.text || messageData.content || '',
      message_type: messageData.contentType || 'text',
      from_me: Boolean(messageData.keyFromMe), // GARANTIR BOOLEAN CORRETO
      sender: messageData.pushName || 'Unknown',
      timestamp: messageData.messageTimestamp ? 
        new Date(messageData.messageTimestamp * 1000).toISOString() : 
        new Date().toISOString(),
      instance_id: instanceId, // USAR INSTANCIA CORRETA SEMPRE
      client_id: clientId,
      is_processed: false,
      created_at: new Date().toISOString()
    };

    console.log('🗺️ [MAPEAMENTO] Dados mapeados:', JSON.stringify(mappedMessage, null, 2));

    // 💾 SALVAR MENSAGEM NO BANCO COM TRATAMENTO DE ERRO ESPECÍFICO
    const { data: savedMessage, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert(mappedMessage)
      .select()
      .single();

    if (saveError) {
      console.error('❌ [SAVE] Erro ao salvar whatsapp_messages:', saveError);
      console.error('❌ [SAVE] Dados que causaram erro:', JSON.stringify(mappedMessage, null, 2));
      throw new Error(`Erro ao salvar mensagem: ${saveError.message}`);
    }

    console.log('✅ [SAVE] Mensagem salva com sucesso:', savedMessage.id);

    // 📦 CRIAR BATCH PARA PROCESSAMENTO IA - SÓ PARA MENSAGENS RECEBIDAS
    if (!mappedMessage.from_me && mappedMessage.chat_id) {
      console.log('📦 [BATCH] Criando batch para processamento IA');
      
      const batchMessage = {
        messageId: mappedMessage.message_id,
        chatId: mappedMessage.chat_id,
        content: mappedMessage.body,
        fromMe: mappedMessage.from_me,
        timestamp: Date.now(),
        pushName: mappedMessage.sender
      };

      // Usar RPC V2 para gestão de batches com timeouts sincronizados
      const { data: batchResult, error: batchError } = await supabase
        .rpc('manage_message_batch_v2', {
          p_chat_id: mappedMessage.chat_id,
          p_client_id: clientId,
          p_instance_id: instanceId,
          p_message: batchMessage
        });

      if (batchError) {
        console.error('❌ [BATCH-ERROR] Erro ao criar batch:', batchError);
      } else {
        console.log('✅ [BATCH-SUCCESS] Batch criado:', batchResult);
        
        // 🚀 TRIGGER PROCESSAMENTO BACKGROUND SE NOVO BATCH
        if (batchResult?.is_new_batch) {
          console.log('🚀 [TRIGGER] Disparando processamento background');
          
          // Chamar function de processamento em background
          const { error: triggerError } = await supabase.functions.invoke(
            'process-message-batches',
            {
              body: { 
                trigger: 'new_message',
                chatId: mappedMessage.chat_id,
                timestamp: new Date().toISOString()
              }
            }
          );

          if (triggerError) {
            console.error('❌ [TRIGGER-ERROR] Erro ao disparar processamento:', triggerError);
          } else {
            console.log('✅ [TRIGGER-SUCCESS] Processamento disparado com sucesso');
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Mensagem processada com sucesso',
      messageId: mappedMessage.message_id,
      chatId: mappedMessage.chat_id,
      saved: true,
      batchCreated: !mappedMessage.from_me
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [PROCESS-YUMER] ERRO:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}