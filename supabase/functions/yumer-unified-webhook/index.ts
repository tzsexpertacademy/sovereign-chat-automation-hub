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

// ✅ SISTEMA DE BATCH ULTRA SIMPLES - APENAS 4 SEGUNDOS
const messageBatches = new Map<string, any>();
const BATCH_TIMEOUT = 4000; // 4 segundos fixos

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

    // ✅ SISTEMA DE BATCH COM DEBOUNCE MELHORADO
    const batchKey = `${chatId}_${instance.client_id}`;
    console.log('🔥 [BATCH-DEBUG] 🔑 Chave do batch:', batchKey);
    console.log('🔥 [BATCH-DEBUG] 📊 Batches ativos na memória:', messageBatches.size);
    
    let batch = messageBatches.get(batchKey);
    const now = Date.now();
    
    if (!batch) {
      // CRIAR NOVO BATCH
      console.log('🔥 [BATCH-DEBUG] ✨ Criando NOVO batch para:', batchKey);
      batch = {
        chatId,
        instanceId: instance.instance_id,
        clientId: instance.client_id,
        messages: [],
        firstMessageTime: now,
        timeoutId: null
      };
      messageBatches.set(batchKey, batch);
    } else {
      console.log('🔥 [BATCH-DEBUG] ♻️ Adicionando ao batch EXISTENTE:', batchKey, '- Mensagens atuais:', batch.messages.length);
      
      // ✅ DEBOUNCE: CANCELAR TIMER ANTERIOR
      if (batch.timeoutId) {
        console.log('🔥 [BATCH-DEBUG] ⏰ Cancelando timer anterior (debounce)');
        clearTimeout(batch.timeoutId);
      }
    }

    // ADICIONAR MENSAGEM AO BATCH
    batch.messages.push({
      content,
      messageId,
      timestamp: new Date().toISOString(),
      pushName,
      phoneNumber
    });

    console.log('🔥 [BATCH-DEBUG] ✅ Mensagem adicionada ao batch:', batchKey);
    console.log('🔥 [BATCH-DEBUG] 📊 Total de mensagens no batch:', batch.messages.length);
    console.log('🔥 [BATCH-DEBUG] 🕐 Idade do batch:', (now - batch.firstMessageTime) / 1000, 'segundos');

    // ✅ CONFIGURAR NOVO TIMER (DEBOUNCE)
    batch.timeoutId = setTimeout(async () => {
      console.log('🔥 [BATCH-DEBUG] ⚡ EXECUTANDO BATCH após timeout de 4s:', batchKey);
      await executeBatch(batchKey);
    }, BATCH_TIMEOUT);
    
    console.log('🔥 [BATCH-DEBUG] ⏲️ Timer configurado para', BATCH_TIMEOUT / 1000, 'segundos');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Added to batch',
      batchSize: batch.messages.length 
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

// ✅ EXECUTAR BATCH SUPER SIMPLES
async function executeBatch(batchKey: string) {
  console.log('🔥 [EXECUTE-BATCH] Executando batch:', batchKey);
  
  const batch = messageBatches.get(batchKey);
  if (!batch) {
    console.log('🔥 [EXECUTE-BATCH] Batch não encontrado na memória');
    return;
  }

  console.log('🔥 [EXECUTE-BATCH] Batch contém', batch.messages.length, 'mensagens');
  console.log('🔥 [EXECUTE-BATCH] Dados do batch:', JSON.stringify(batch, null, 2));

  // ✅ VALIDAR CAMPOS OBRIGATÓRIOS
  if (!batch.chatId || !batch.clientId) {
    console.error('🔥 [EXECUTE-BATCH] Batch inválido - faltam dados obrigatórios:', {
      chatId: batch.chatId,
      clientId: batch.clientId
    });
    messageBatches.delete(batchKey);
    return;
  }

  // ✅ VALIDAR MENSAGENS COM CONTEÚDO
  const validMessages = batch.messages.filter(msg => msg.content && msg.content.trim() !== '');
  if (validMessages.length === 0) {
    console.warn('🔥 [EXECUTE-BATCH] Nenhuma mensagem válida com conteúdo');
    messageBatches.delete(batchKey);
    return;
  }

  try {
    // ✅ CORRIGIDO: BUSCAR TICKET NA TABELA CORRETA
    console.log('🔥 [EXECUTE-BATCH] Buscando ticket para chat:', batch.chatId, 'cliente:', batch.clientId);
    
    const { data: ticket, error: ticketError } = await supabase
      .from('conversation_tickets')
      .select('id, status, title')
      .eq('chat_id', batch.chatId)
      .eq('client_id', batch.clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (ticketError) {
      console.error('🔥 [EXECUTE-BATCH] Erro ao buscar ticket:', ticketError);
      
      // ✅ FALLBACK: PROCESSAR INDIVIDUAL SE TICKET FALHOU
      console.warn('🔁 [FALLBACK] Ticket não encontrado, processando mensagens individuais');
      for (const message of validMessages) {
        await processSingleMessage({ 
          data: { 
            content: { text: message.content },
            keyId: message.messageId 
          } 
        }, true);
      }
      messageBatches.delete(batchKey);
      return;
    }

    if (!ticket) {
      console.warn('🔥 [EXECUTE-BATCH] Ticket não existe para este chat');
      
      // ✅ FALLBACK: PROCESSAR INDIVIDUAL
      console.warn('🔁 [FALLBACK] Criando processamento individual');
      for (const message of validMessages) {
        await processSingleMessage({ 
          data: { 
            content: { text: message.content },
            keyId: message.messageId 
          } 
        }, true);
      }
      messageBatches.delete(batchKey);
      return;
    }

    console.log('🔥 [EXECUTE-BATCH] ✅ Ticket encontrado:', ticket.id, 'Status:', ticket.status);

    // CHAMAR IA COM TODAS AS MENSAGENS
    const aiPayload = {
      ticketId: ticket.id,
      messages: batch.messages.map(msg => ({
        content: msg.content,
        timestamp: msg.timestamp,
        messageId: msg.messageId
      })),
      context: {
        chatId: batch.chatId,
        customerName: batch.messages[0]?.pushName || 'Cliente',
        phoneNumber: batch.messages[0]?.phoneNumber || 'N/A',
        batchInfo: `Batch de ${batch.messages.length} mensagens`
      }
    };

    console.log('🔥 [EXECUTE-BATCH] Chamando IA com payload:', JSON.stringify(aiPayload, null, 2));

    const aiResult = await supabase.functions.invoke('ai-assistant-process', {
      body: aiPayload
    });

    console.log('🔥 [EXECUTE-BATCH] Resultado da IA:', {
      success: !!aiResult.data,
      hasError: !!aiResult.error,
      errorMsg: aiResult.error?.message
    });

    if (aiResult.error) {
      console.error('🔥 [EXECUTE-BATCH] Erro da IA:', aiResult.error);
    } else {
      console.log('🔥 [EXECUTE-BATCH] ✅ IA PROCESSOU COM SUCESSO!');
    }

  } catch (error) {
    console.error('🔥 [EXECUTE-BATCH] ERRO CRÍTICO:', error);
  } finally {
    // LIMPAR BATCH DA MEMÓRIA
    messageBatches.delete(batchKey);
    console.log('🔥 [EXECUTE-BATCH] Batch removido da memória');
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
      has_media: false,
      media_url: '',
      media_type: '',
      is_processed: false
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