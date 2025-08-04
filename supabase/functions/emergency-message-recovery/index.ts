import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Database {
  public: {
    Functions: {
      emergency_message_recovery: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      monitor_message_health: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
    };
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'recovery';

    console.log(`🚨 [EMERGENCY-RECOVERY] Iniciando ação: ${action}`);

    if (action === 'monitor') {
      // Monitorar saúde do sistema
      const { data: healthData, error: healthError } = await supabase.rpc('monitor_message_health');
      
      if (healthError) {
        console.error('❌ [EMERGENCY-RECOVERY] Erro no monitoramento:', healthError);
        throw healthError;
      }

      console.log('📊 [EMERGENCY-RECOVERY] Status do sistema:', healthData);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'monitor',
          health: healthData,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (action === 'recovery') {
      // Executar recuperação emergencial
      console.log('🔄 [EMERGENCY-RECOVERY] Iniciando recuperação de mensagens...');
      
      const { data: recoveryData, error: recoveryError } = await supabase.rpc('emergency_message_recovery');
      
      if (recoveryError) {
        console.error('❌ [EMERGENCY-RECOVERY] Erro na recuperação:', recoveryError);
        throw recoveryError;
      }

      console.log('✅ [EMERGENCY-RECOVERY] Recuperação concluída:', recoveryData);

      // Verificar saúde após recuperação
      const { data: healthData } = await supabase.rpc('monitor_message_health');

      // Invocar processamento de batches
      try {
        const { error: batchError } = await supabase.functions.invoke('process-message-batches', {
          body: { trigger: 'emergency-recovery' }
        });
        
        if (batchError) {
          console.warn('⚠️ [EMERGENCY-RECOVERY] Aviso no processamento de batches:', batchError);
        } else {
          console.log('🚀 [EMERGENCY-RECOVERY] Processamento de batches invocado com sucesso');
        }
      } catch (batchInvokeError) {
        console.warn('⚠️ [EMERGENCY-RECOVERY] Erro ao invocar process-message-batches:', batchInvokeError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'recovery',
          recovery: recoveryData,
          health: healthData,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (action === 'force-batch-processing') {
      // Forçar processamento de todos os batches pendentes
      console.log('⚡ [EMERGENCY-RECOVERY] Forçando processamento de batches...');
      
      const { error: batchError } = await supabase.functions.invoke('process-message-batches', {
        body: { 
          trigger: 'force-processing',
          force: true
        }
      });
      
      if (batchError) {
        console.error('❌ [EMERGENCY-RECOVERY] Erro no processamento forçado:', batchError);
        throw batchError;
      }

      console.log('✅ [EMERGENCY-RECOVERY] Processamento forçado iniciado');

      return new Response(
        JSON.stringify({
          success: true,
          action: 'force-batch-processing',
          message: 'Processamento de batches forçado iniciado',
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Ação desconhecida
    return new Response(
      JSON.stringify({
        success: false,
        error: `Ação desconhecida: ${action}`,
        available_actions: ['recovery', 'monitor', 'force-batch-processing']
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );

  } catch (error) {
    console.error('❌ [EMERGENCY-RECOVERY] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});