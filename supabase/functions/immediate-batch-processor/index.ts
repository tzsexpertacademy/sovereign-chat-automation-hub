import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Mapa global para controlar timeouts de batches
const batchTimeouts = new Map<string, number>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('⚡ [IMMEDIATE-PROCESSOR] Requisição recebida');

  try {
    const { batchId, timeout, action = 'schedule' } = await req.json();
    
    if (action === 'schedule') {
      // Agendar processamento imediato após timeout
      return await scheduleImmediateProcessing(batchId, timeout);
    } else if (action === 'cancel') {
      // Cancelar processamento agendado
      return await cancelScheduledProcessing(batchId);
    } else if (action === 'process') {
      // Processar imediatamente
      return await processImmediately(batchId);
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [IMMEDIATE-PROCESSOR] Erro:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function scheduleImmediateProcessing(batchId: string, timeout: number) {
  console.log(`⏰ [IMMEDIATE-PROCESSOR] Agendando processamento para batch ${batchId} em ${timeout}ms`);
  
  // Cancelar timeout anterior se existir
  if (batchTimeouts.has(batchId)) {
    clearTimeout(batchTimeouts.get(batchId)!);
  }
  
  // Agendar novo processamento
  const timeoutId = setTimeout(async () => {
    console.log(`🚀 [IMMEDIATE-PROCESSOR] EXECUTANDO processamento para batch: ${batchId}`);
    
    try {
      // Chamar process-message-batches diretamente
      const { data, error } = await supabase.functions.invoke('process-message-batches', {
        body: { 
          trigger: 'immediate_timeout',
          batchId: batchId,
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        console.error(`❌ [IMMEDIATE-PROCESSOR] Erro ao processar batch ${batchId}:`, error);
      } else {
        console.log(`✅ [IMMEDIATE-PROCESSOR] Batch ${batchId} processado com sucesso:`, data);
      }
      
      // Remover timeout do mapa
      batchTimeouts.delete(batchId);
      
    } catch (error) {
      console.error(`💥 [IMMEDIATE-PROCESSOR] Falha crítica no processamento do batch ${batchId}:`, error);
      batchTimeouts.delete(batchId);
    }
  }, timeout);

  // Armazenar referência do timeout
  batchTimeouts.set(batchId, timeoutId);
  
  console.log(`✅ [IMMEDIATE-PROCESSOR] Timeout agendado para batch ${batchId}: ${timeout}ms`);

  return new Response(JSON.stringify({
    success: true,
    batchId: batchId,
    timeoutMs: timeout,
    action: 'scheduled'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function cancelScheduledProcessing(batchId: string) {
  console.log(`🛑 [IMMEDIATE-PROCESSOR] Cancelando processamento agendado para batch: ${batchId}`);
  
  if (batchTimeouts.has(batchId)) {
    clearTimeout(batchTimeouts.get(batchId)!);
    batchTimeouts.delete(batchId);
    
    console.log(`✅ [IMMEDIATE-PROCESSOR] Processamento cancelado para batch: ${batchId}`);
    
    return new Response(JSON.stringify({
      success: true,
      batchId: batchId,
      action: 'cancelled'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: false,
    batchId: batchId,
    message: 'Nenhum processamento agendado encontrado'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function processImmediately(batchId: string) {
  console.log(`⚡ [IMMEDIATE-PROCESSOR] Processando IMEDIATAMENTE batch: ${batchId}`);
  
  // Cancelar timeout agendado se existir
  if (batchTimeouts.has(batchId)) {
    clearTimeout(batchTimeouts.get(batchId)!);
    batchTimeouts.delete(batchId);
  }
  
  try {
    // Processar imediatamente
    const { data, error } = await supabase.functions.invoke('process-message-batches', {
      body: { 
        trigger: 'immediate_manual',
        batchId: batchId,
        timestamp: new Date().toISOString()
      }
    });

    if (error) {
      throw new Error(`Erro no processamento: ${error.message}`);
    }

    console.log(`✅ [IMMEDIATE-PROCESSOR] Batch ${batchId} processado imediatamente:`, data);

    return new Response(JSON.stringify({
      success: true,
      batchId: batchId,
      action: 'processed_immediately',
      result: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error(`❌ [IMMEDIATE-PROCESSOR] Erro no processamento imediato:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      batchId: batchId,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Cleanup em shutdown
addEventListener('beforeunload', () => {
  console.log('🧹 [IMMEDIATE-PROCESSOR] Limpando timeouts no shutdown...');
  batchTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  batchTimeouts.clear();
});