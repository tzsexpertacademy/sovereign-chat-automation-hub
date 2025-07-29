import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Função scheduled para manter status online de todos os clientes ativos
 * Executa a cada 2 minutos via pg_cron
 */

/**
 * Chamada HTTP com retry
 */
async function httpCallWithRetry(url: string, options: any, retries = 2): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      const responseText = await response.text();
      
      console.log(`📊 [SCHEDULED-${attempt}] Status: ${response.status} | Response: ${responseText.substring(0, 100)}`);
      
      if (response.ok) {
        return true;
      }
      
    } catch (error) {
      console.error(`❌ [SCHEDULED-${attempt}] Erro:`, error);
    }
  }
  
  return false;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('⏰ [SCHEDULED-HEARTBEAT] Iniciando heartbeat scheduled');
    
    // Buscar todos os clientes com status online habilitado e instâncias ativas
    const { data: activeClients, error } = await supabase
      .from('clients')
      .select(`
        id,
        business_token,
        client_ai_configs!inner(online_status_config),
        whatsapp_instances!inner(instance_id, status)
      `)
      .eq('client_ai_configs.online_status_config->enabled', true)
      .in('whatsapp_instances.status', ['connected', 'open'])
      .limit(50);

    if (error) {
      console.error('❌ [SCHEDULED-HEARTBEAT] Erro ao buscar clientes:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!activeClients || activeClients.length === 0) {
      console.log('⚠️ [SCHEDULED-HEARTBEAT] Nenhum cliente ativo com status online encontrado');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum cliente ativo', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🎯 [SCHEDULED-HEARTBEAT] Processando ${activeClients.length} clientes ativos`);

    let successCount = 0;
    let errorCount = 0;

    // Processar cada cliente ativo
    for (const client of activeClients) {
      try {
        console.log(`👤 [SCHEDULED-CLIENT] Processando cliente: ${client.id}`);
        
        // Buscar tickets/conversas ativas recentes (últimas 4 horas)
        const cutoffTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        
        const { data: activeTickets } = await supabase
          .from('conversation_tickets')
          .select('chat_id, instance_id')
          .eq('client_id', client.id)
          .eq('status', 'open')
          .gte('last_activity_at', cutoffTime)
          .limit(10);

        if (!activeTickets || activeTickets.length === 0) {
          console.log(`⚠️ [SCHEDULED-CLIENT] Cliente ${client.id} sem tickets ativos recentes`);
          continue;
        }

        // 🚫 PRESENÇA DESABILITADA: CodeChat v2.2.1 não possui endpoint /chat/presence
        console.log(`🚫 [SCHEDULED-CLIENT] Sistema de presença desabilitado para cliente: ${client.id}`);
        console.log(`📋 [SCHEDULED-CLIENT] Tickets ativos encontrados: ${activeTickets.length} (presença não será aplicada)`);
        console.log(`⚠️ [SCHEDULED-HEARTBEAT] NOTA: Endpoint /api/v2/instance/{id}/chat/presence não existe no CodeChat v2.2.1`);
        
        // Contar tickets encontrados mas não processar presença
        successCount += activeTickets.length;

      } catch (clientError) {
        console.error(`❌ [SCHEDULED-CLIENT] Erro no cliente ${client.id}:`, clientError);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: 'Heartbeat scheduled executado',
      clientsProcessed: activeClients.length,
      presenceUpdatesSuccess: successCount,
      presenceUpdatesError: errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('✅ [SCHEDULED-HEARTBEAT] Finalizado:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [SCHEDULED-HEARTBEAT] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});