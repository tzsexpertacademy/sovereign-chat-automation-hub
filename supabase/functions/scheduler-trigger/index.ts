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
    console.log('⏰ [SCHEDULER-TRIGGER] ✅ FLUXO UNIFICADO: Descriptografia → Análise → Batches');
    
    // 1. Descriptografar mídias pendentes (API directly-download)
    const mediaResponse = await supabase.functions.invoke('process-received-media', {
      body: { trigger: 'scheduler', timestamp: new Date().toISOString() }
    });
    
    console.log('⏰ [SCHEDULER-TRIGGER] 1️⃣ Descriptografia:', mediaResponse.data);
    
    // 2. Analisar mídias descriptografadas (GPT-4 Vision)
    const analysisResponse = await supabase.functions.invoke('process-media-analysis', {
      body: { trigger: 'scheduler', timestamp: new Date().toISOString() }
    });
    
    console.log('⏰ [SCHEDULER-TRIGGER] 2️⃣ Análise:', analysisResponse.data);
    
    // 3. Processar batches com contexto completo
    const batchResponse = await supabase.functions.invoke('process-message-batches', {
      body: { trigger: 'scheduler', timestamp: new Date().toISOString() }
    });

    console.log('⏰ [SCHEDULER-TRIGGER] 3️⃣ Batches:', batchResponse.data);

    return new Response(JSON.stringify({
      success: true,
      message: 'Unified media flow executed',
      steps: {
        decryption: mediaResponse.data,
        analysis: analysisResponse.data,
        batches: batchResponse.data
      }
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