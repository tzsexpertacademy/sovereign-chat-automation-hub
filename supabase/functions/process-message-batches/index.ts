import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Servidor Supabase
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Extrair informações do trigger
  let triggerInfo = { type: 'unknown', chatId: null };
  try {
    const body = await req.text();
    if (body) {
      const data = JSON.parse(body);
      triggerInfo = {
        type: data.trigger || 'unknown',
        chatId: data.chatId || null
      };
    }
  } catch (e) {
    // Ignore parsing errors for trigger info
  }

  console.log('🤖 [PROCESS-BATCHES] Verificando batches pendentes...', {
    trigger: triggerInfo.type,
    chatId: triggerInfo.chatId?.substring(0, 20),
    timestamp: new Date().toISOString()
  });

  try {
    const processingId = `${triggerInfo.type}_${Date.now()}`;
    const cutoffTime = new Date(Date.now() - 3000).toISOString(); // 3 segundos atrás
    const lockTimeout = new Date(Date.now() - 30000).toISOString(); // 30 segundos para timeout
    
    // BUSCAR BATCHES DISPONÍVEIS (não processados E não em processamento)
    const { data: pendingBatches, error } = await supabase
      .from('message_batches')
      .select('*')
      .lt('last_updated', cutoffTime)
      .or(`processing_started_at.is.null,processing_started_at.lt.${lockTimeout}`)
      .order('created_at', { ascending: true })
      .limit(3);

    if (error) {
      console.error('🤖 [PROCESS-BATCHES] ❌ Erro ao buscar batches:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🤖 [PROCESS-BATCHES] 📦 Encontrados', pendingBatches?.length || 0, 'batches pendentes');

    if (!pendingBatches || pendingBatches.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum batch pendente',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 🎵 CORREÇÃO: Aguardar 500ms para garantir que dados de mídia/áudio estejam salvos
    console.log('🎵 [AUDIO-FIX] ⏳ Aguardando 500ms para garantir dados de mídia salvos...');
    await new Promise(resolve => setTimeout(resolve, 500));

    // BLOQUEAR BATCHES PARA PROCESSAMENTO (evitar duplicação)
    const batchIds = pendingBatches.map(b => b.id);
    const { data: lockedBatches, error: lockError } = await supabase
      .from('message_batches')
      .update({
        processing_started_at: new Date().toISOString(),
        processing_by: processingId
      })
      .in('id', batchIds)
      .is('processing_started_at', null)
      .select('id');

    if (lockError) {
      console.error('🤖 [PROCESS-BATCHES] ❌ Erro ao bloquear batches:', lockError);
      return new Response(JSON.stringify({ error: lockError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const lockedBatchIds = lockedBatches?.map(b => b.id) || [];
    const batchesToProcess = pendingBatches.filter(b => lockedBatchIds.includes(b.id));
    
    console.log('🤖 [PROCESS-BATCHES] 🔒 Bloqueados', lockedBatchIds.length, 'de', batchIds.length, 'batches para processamento');

    if (batchesToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum batch disponível para processamento (já sendo processados)',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let processedCount = 0;
    
    console.log('🤖 [PROCESS-BATCHES] 🚀 Processando', batchesToProcess.length, 'batches em paralelo');
    
    const batchPromises = batchesToProcess.map(async (batch) => {
      console.log('🤖 [PROCESS-BATCHES] 🚀 Processando batch:', batch.id, 'com', batch.messages?.length || 0, 'mensagens');
      
      try {
        await processBatch(batch);
        return { success: true, batchId: batch.id };
      } catch (error) {
        console.error('🤖 [PROCESS-BATCHES] ❌ Erro ao processar batch:', batch.id, error);
        return { success: false, batchId: batch.id, error: error.message };
      }
    });
    
    const results = await Promise.allSettled(batchPromises);
    processedCount = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      total: pendingBatches.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🤖 [PROCESS-BATCHES] ❌ Erro geral:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * PROCESSAR UM BATCH ESPECÍFICO
 */
async function processBatch(batch: any) {
  console.log('🤖 [PROCESS-BATCH] Processando batch:', batch.id);

  // 🎵 VERIFICAR SE HÁ MENSAGENS DE ÁUDIO NO BATCH
  const audioMessages = batch.messages.filter((msg: any) => 
    msg.content && (msg.content.includes('🎵 Áudio') || msg.content === '🎵 Áudio')
  );

  if (audioMessages.length > 0) {
    console.log('🎵 [AUDIO-FIX] 🔍 Detectados', audioMessages.length, 'áudios no batch');
    
    // Verificar se dados de áudio estão disponíveis no banco
    for (const audioMsg of audioMessages) {
      console.log('🎵 [AUDIO-FIX] 🔍 Verificando dados de áudio para messageId:', audioMsg.messageId);
      
      const { data: audioData } = await supabase
        .from('whatsapp_messages')
        .select('message_id, media_url, media_key, file_enc_sha256, content_type, created_at')
        .eq('message_id', audioMsg.messageId)
        .single();
      
      if (audioData) {
        console.log('🎵 [AUDIO-FIX] ✅ Dados encontrados:', {
          messageId: audioData.message_id,
          hasMediaUrl: !!audioData.media_url,
          hasMediaKey: !!audioData.media_key,
          hasFileEncSha256: !!audioData.file_enc_sha256,
          contentType: audioData.content_type,
          createdAt: audioData.created_at
        });
      } else {
        console.log('🎵 [AUDIO-FIX] ❌ Dados de áudio NÃO encontrados para:', audioMsg.messageId);
      }
    }
    
    // DELAY EXTRA para áudios (garante que decriptação/salvamento terminou)
    console.log('🎵 [AUDIO-FIX] ⏳ Delay extra de 1s para processamento de áudio...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  try {
    // BUSCAR TICKET
    const { data: ticketData } = await supabase
      .from('conversation_tickets')
      .select('*')
      .eq('chat_id', batch.chat_id)
      .eq('client_id', batch.client_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let ticket = ticketData;

    if (!ticket) {
      console.log('🤖 [PROCESS-BATCH] ❌ Ticket não encontrado - CRIANDO NOVO TICKET');
      
      // CRIAR TICKET ANTES DE PROCESSAR
      const newTicket = await createTicketFromBatch(batch);
      if (!newTicket) {
        console.error('🤖 [PROCESS-BATCH] ❌ Falha ao criar ticket');
        await deleteBatch(batch.id);
        return;
      }
      
      // Usar o ticket recém-criado
      ticket = newTicket;
    }

    // 🎥 DETECTAR COMANDOS DE VÍDEO NO BATCH
    const hasVideoCommands = batch.messages.some((msg: any) => {
      const content = msg.content || '';
      const isVideoCommand = /^video\s+([a-zA-Z0-9_-]+)$/i.test(content.trim());
      console.log('🎥 [PROCESS-BATCH] Verificando comando de vídeo:', {
        content: content,
        isVideoCommand: isVideoCommand,
        messageId: msg.messageId
      });
      return isVideoCommand;
    });

    console.log('🎥 [PROCESS-BATCH] Comandos de vídeo detectados no batch:', hasVideoCommands);

    // CHAMAR IA COM BATCH
    console.log('🤖 [PROCESS-BATCH] 🧠 Chamando IA para ticket:', ticket.id, 'com', batch.messages?.length || 0, 'mensagens');
    console.log('🤖 [PROCESS-BATCH] 📄 Mensagens do batch:', JSON.stringify(batch.messages, null, 2));
    
    const aiResponse = await supabase.functions.invoke('ai-assistant-process', {
      body: {
        ticketId: ticket.id,
        messages: batch.messages,
        context: {
          chatId: batch.chat_id,
          customerName: batch.messages[0]?.customerName || 'Cliente',
          phoneNumber: batch.messages[0]?.phoneNumber || '',
          batchInfo: `Batch de ${batch.messages.length} mensagens`
        }
      }
    });

    console.log('🤖 [PROCESS-BATCH] 🎯 Resultado da IA:', { 
      success: !aiResponse.error, 
      hasError: !!aiResponse.error,
      errorMsg: aiResponse.error?.message 
    });

    if (!aiResponse.error) {
      console.log('🤖 [PROCESS-BATCH] ✅ IA processou com SUCESSO!');
      
      // MARCAR MENSAGENS COMO PROCESSADAS
      await markMessagesAsProcessed(batch.messages);
    }

    // REMOVER BATCH PROCESSADO
    await deleteBatch(batch.id);

  } catch (error) {
    console.error('🤖 [PROCESS-BATCH] ❌ Erro ao processar batch:', error);
    await deleteBatch(batch.id);
    throw error;
  }
}

/**
 * MARCAR MENSAGENS COMO PROCESSADAS (OTIMIZADO)
 */
async function markMessagesAsProcessed(messages: any[]) {
  const messageIds = messages.map(msg => msg.messageId).filter(Boolean);
  
  if (messageIds.length === 0) return;

  // Verificar quais já estão processadas para evitar updates desnecessários
  const { data: alreadyProcessed } = await supabase
    .from('whatsapp_messages')
    .select('message_id')
    .in('message_id', messageIds)
    .eq('is_processed', true);

  const alreadyProcessedIds = new Set(alreadyProcessed?.map(m => m.message_id) || []);
  const toProcess = messageIds.filter(id => !alreadyProcessedIds.has(id));

  if (toProcess.length === 0) {
    console.log('🤖 [MARK-PROCESSED] ℹ️ Todas as mensagens já estão processadas');
    return;
  }

  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ 
      is_processed: true,
      processed_at: new Date().toISOString()
    })
    .in('message_id', toProcess);

  if (error) {
    console.error('🤖 [MARK-PROCESSED] ❌ Erro ao marcar mensagens:', error);
  } else {
    console.log(`🤖 [MARK-PROCESSED] ✅ Marcadas ${toProcess.length} mensagens como processadas (${alreadyProcessedIds.size} já estavam processadas)`);
  }
}

/**
 * DELETAR BATCH PROCESSADO
 */
async function deleteBatch(batchId: string) {
  const { error } = await supabase
    .from('message_batches')
    .delete()
    .eq('id', batchId);

  if (error) {
    console.error('🤖 [DELETE-BATCH] ❌ Erro ao deletar batch:', error);
  } else {
    console.log('🤖 [DELETE-BATCH] ✅ Batch deletado:', batchId);
  }
}

/**
 * CRIAR TICKET A PARTIR DO BATCH
 */
async function createTicketFromBatch(batch: any) {
  console.log('🤖 [CREATE-TICKET] Criando ticket para batch:', batch.id);
  
  try {
    const firstMessage = batch.messages[0];
    const customerName = firstMessage?.customerName || 'Cliente';
    const phoneNumber = firstMessage?.phoneNumber || '';
    const chatId = batch.chat_id;
    const instanceId = batch.instance_id;
    const clientId = batch.client_id;
    
    // Usar a função RPC do Supabase para criar/buscar ticket
    const { data: ticketId, error: rpcError } = await supabase.rpc('upsert_conversation_ticket', {
      p_client_id: clientId,
      p_chat_id: chatId,
      p_instance_id: instanceId,
      p_customer_name: customerName,
      p_customer_phone: phoneNumber,
      p_last_message: firstMessage?.content || '',
      p_last_message_at: new Date().toISOString()
    });

    if (rpcError) {
      console.error('🤖 [CREATE-TICKET] ❌ Erro RPC:', rpcError);
      return null;
    }

    // Buscar o ticket criado
    const { data: ticket, error: fetchError } = await supabase
      .from('conversation_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (fetchError) {
      console.error('🤖 [CREATE-TICKET] ❌ Erro ao buscar ticket:', fetchError);
      return null;
    }

    console.log('🤖 [CREATE-TICKET] ✅ Ticket criado/encontrado:', ticket.id);
    return ticket;
    
  } catch (error) {
    console.error('🤖 [CREATE-TICKET] ❌ Erro geral:', error);
    return null;
  }
}

/**
 * PROCESSAR MENSAGEM INDIVIDUAL (FALLBACK)
 */
async function processSingleMessage(message: any) {
  console.log('🤖 [SINGLE-MESSAGE] Processando mensagem individual como fallback');
  return { success: true };
}