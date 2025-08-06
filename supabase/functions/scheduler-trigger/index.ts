import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('⏰ [SCHEDULER-TRIGGER] Executando como BACKUP (sistema imediato em uso)');

  try {
    console.log('⏰ [SCHEDULER-TRIGGER] 🔄 MODO BACKUP: Limpeza + Recuperação');
    
    // 1️⃣ LIMPEZA: Batches órfãos e timeouts travados
    const { data: cleanupResult } = await supabase.rpc('cleanup_orphaned_batches');
    console.log('⏰ [SCHEDULER-TRIGGER] 1️⃣ Limpeza:', cleanupResult);
    
    // 2️⃣ RECUPERAÇÃO: Apenas mensagens realmente órfãs (mais de 5 minutos)
    const batchResponse = await supabase.functions.invoke('process-message-batches', {
      body: { 
        trigger: 'scheduler_backup', 
        timestamp: new Date().toISOString(),
        onlyOrphaned: true
      }
    });

    console.log('⏰ [SCHEDULER-TRIGGER] 2️⃣ Recuperação órfãs:', batchResponse.data);
    
    // 3️⃣ ANÁLISE: Mídias processadas sem análise
    const analysisResponse = await supabase.functions.invoke('process-media-analysis', {
      body: { trigger: 'scheduler_backup', timestamp: new Date().toISOString() }
    });
    
    console.log('⏰ [SCHEDULER-TRIGGER] 3️⃣ Análise Final:', analysisResponse.data);

    return new Response(JSON.stringify({
      success: true,
      message: 'Backup cleanup and recovery executed - Immediate processing is primary',
      steps: {
        cleanup: cleanupResult,
        recovery: batchResponse.data,
        analysis: analysisResponse.data
      },
      strategy: 'backup_mode',
      note: 'Primary processing is now immediate via webhooks'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('⏰ [SCHEDULER-TRIGGER] ❌ Erro:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});