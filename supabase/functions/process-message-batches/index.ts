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
    // BUSCAR BATCHES ANTIGOS (últimos 3+ segundos sem atualização)
    const cutoffTime = new Date(Date.now() - 3000).toISOString(); // 3 segundos atrás
    
    const { data: pendingBatches, error } = await supabase
      .from('message_batches')
      .select('*')
      .lt('last_updated', cutoffTime);

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

    let processedCount = 0;
    
    // PROCESSAR BATCHES EM PARALELO (máximo 3 simultâneos para não sobrecarregar)
    const batchLimit = Math.min(pendingBatches.length, 3);
    const batches = pendingBatches.slice(0, batchLimit);
    
    console.log('🤖 [PROCESS-BATCHES] 🚀 Processando', batches.length, 'batches em paralelo');
    
    const batchPromises = batches.map(async (batch) => {
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

  try {
    // BUSCAR TICKET
    const { data: ticket } = await supabase
      .from('conversation_tickets')
      .select('*')
      .eq('chat_id', batch.chat_id)
      .eq('client_id', batch.client_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

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
 * MARCAR MENSAGENS COMO PROCESSADAS
 */
async function markMessagesAsProcessed(messages: any[]) {
  const messageIds = messages.map(msg => msg.messageId).filter(Boolean);
  
  if (messageIds.length === 0) return;

  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ is_processed: true })
    .in('message_id', messageIds);

  if (error) {
    console.error('🤖 [MARK-PROCESSED] ❌ Erro ao marcar mensagens:', error);
  } else {
    console.log('🤖 [MARK-PROCESSED] ✅ Marcadas', messageIds.length, 'mensagens como processadas');
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