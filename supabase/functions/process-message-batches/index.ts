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

  console.log('🤖 [PROCESS-BATCHES] Verificando batches pendentes...');

  try {
    // BUSCAR BATCHES ANTIGOS (últimos 4+ segundos sem atualização)
    const cutoffTime = new Date(Date.now() - 4000).toISOString(); // 4 segundos atrás
    
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
    
    // PROCESSAR CADA BATCH
    for (const batch of pendingBatches) {
      console.log('🤖 [PROCESS-BATCHES] 🚀 Processando batch:', batch.id, 'com', batch.messages.length, 'mensagens');
      
      try {
        await processBatch(batch);
        processedCount++;
      } catch (error) {
        console.error('🤖 [PROCESS-BATCHES] ❌ Erro ao processar batch:', batch.id, error);
      }
    }

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
      console.log('🤖 [PROCESS-BATCH] ❌ Ticket não encontrado para:', batch.chat_id);
      // PROCESSAR MENSAGEM INDIVIDUAL COMO FALLBACK
      await processSingleMessage(batch.messages[0]);
      await deleteBatch(batch.id);
      return;
    }

    // CHAMAR IA COM BATCH
    console.log('🤖 [PROCESS-BATCH] 🧠 Chamando IA para ticket:', ticket.id);
    
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
 * PROCESSAR MENSAGEM INDIVIDUAL (FALLBACK)
 */
async function processSingleMessage(message: any) {
  console.log('🤖 [SINGLE-MESSAGE] Processando mensagem individual como fallback');
  return { success: true };
}