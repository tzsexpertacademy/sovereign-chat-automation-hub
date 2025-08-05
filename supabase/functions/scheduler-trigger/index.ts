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

  console.log('⏰ [SCHEDULER-TRIGGER] Executando trigger do scheduler');

  try {
    console.log('⏰ [SCHEDULER-TRIGGER] 🔄 ESTRATÉGIA HÍBRIDA: Primário → Fallback → Análise');
    
    // 1️⃣ SISTEMA PRIMÁRIO: process-received-media (descriptografia + transcrição 100%)
    const mediaResponse = await supabase.functions.invoke('process-received-media', {
      body: { trigger: 'scheduler', timestamp: new Date().toISOString() }
    });
    
    console.log('⏰ [SCHEDULER-TRIGGER] 1️⃣ Sistema Primário (descriptografia):', mediaResponse.data);
    
    // ⏳ DELAY para evitar race condition na API Yumer
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 2️⃣ SISTEMA FALLBACK: process-message-batches (apenas áudios não processados)
    const batchResponse = await supabase.functions.invoke('process-message-batches', {
      body: { trigger: 'scheduler_fallback', timestamp: new Date().toISOString() }
    });

    console.log('⏰ [SCHEDULER-TRIGGER] 2️⃣ Sistema Fallback (batch):', batchResponse.data);
    
    // ⏳ DELAY antes da análise final
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3️⃣ ANÁLISE FINAL: GPT-4 Vision para todas as mídias processadas
    const analysisResponse = await supabase.functions.invoke('process-media-analysis', {
      body: { trigger: 'scheduler', timestamp: new Date().toISOString() }
    });
    
    console.log('⏰ [SCHEDULER-TRIGGER] 3️⃣ Análise Final:', analysisResponse.data);

    return new Response(JSON.stringify({
      success: true,
      message: 'Hybrid strategy executed - Primary + Fallback + Analysis',
      steps: {
        primary_decryption: mediaResponse.data,
        fallback_batch: batchResponse.data,
        final_analysis: analysisResponse.data
      },
      strategy: 'hybrid_sequential'
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