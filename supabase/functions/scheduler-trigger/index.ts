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
    console.log('⏰ [SCHEDULER-TRIGGER] Iniciando processamento de batches...');
    
    // Chamar a função de processamento de batches
    const response = await supabase.functions.invoke('process-message-batches', {
      body: { trigger: 'scheduler', timestamp: new Date().toISOString() }
    });

    console.log('⏰ [SCHEDULER-TRIGGER] Resultado:', {
      success: !response.error,
      data: response.data,
      error: response.error?.message,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Scheduler executed',
      result: response.data
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