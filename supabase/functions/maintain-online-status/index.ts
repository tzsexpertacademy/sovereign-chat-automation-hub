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
 * Delay com promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Chamada HTTP com retry robusta
 */
async function httpCallWithRetry(url: string, options: any, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 [MAINTAIN-${attempt}] ${options.method} ${url}`);
      
      const response = await fetch(url, options);
      const responseText = await response.text();
      
      console.log(`📊 [MAINTAIN-${attempt}] Status: ${response.status} | Response: ${responseText.substring(0, 200)}`);
      
      if (response.ok) {
        return true;
      }
      
      // Backoff exponencial
      await sleep(1000 * Math.pow(2, attempt - 1));
      
    } catch (error) {
      console.error(`❌ [MAINTAIN-${attempt}] Erro:`, error);
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
  
  return false;
}

/**
 * Aplica configurações de perfil completas
 */
async function applyFullProfileConfig(instanceId: string, businessToken: string, config: any): Promise<boolean> {
  try {
    // 1. Privacidade online
    console.log('🔒 [MAINTAIN-PROFILE-1] Aplicando privacidade online...');
    await httpCallWithRetry(
      `https://api.yumer.com.br/api/v2/instance/${instanceId}/update/profile-privacy`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${businessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          onlinePrivacy: config?.onlinePrivacy || 'all'
        })
      }
    );
    
    await sleep(1000);
    
    // 2. Privacidade do visto por último
    console.log('👁️ [MAINTAIN-PROFILE-2] Aplicando privacidade do visto por último...');
    await httpCallWithRetry(
      `https://api.yumer.com.br/api/v2/instance/${instanceId}/update/profile-privacy`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${businessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lastSeenPrivacy: config?.seenPrivacy || 'all'
        })
      }
    );
    
    await sleep(1000);
    
    // 3. Status do perfil
    console.log('📝 [MAINTAIN-PROFILE-3] Aplicando status do perfil...');
    await httpCallWithRetry(
      `https://api.yumer.com.br/api/v2/instance/${instanceId}/update/profile-status`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${businessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profileStatus: config?.profileStatus || 'Atendimento automatizado ativo'
        })
      }
    );
    
    console.log('✅ [MAINTAIN-PROFILE] Todas as configurações aplicadas com sucesso');
    return true;
    
  } catch (error) {
    console.error('❌ [MAINTAIN-PROFILE] Erro na sequência:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, chatId, businessToken, clientId } = await req.json();
    
    console.log('💓 [MAINTAIN-ONLINE] Iniciando manutenção de status online');
    console.log(`🔍 [MAINTAIN-ONLINE] Instância: ${instanceId}, Chat: ${chatId}, Cliente: ${clientId}`);
    
    // Buscar configuração atualizada do cliente
    const { data: aiConfig } = await supabase
      .from('client_ai_configs')
      .select('online_status_config')
      .eq('client_id', clientId)
      .single();
    
    if (!aiConfig?.online_status_config?.enabled) {
      console.log('⚠️ [MAINTAIN-ONLINE] Status online desabilitado, saindo...');
      return new Response(
        JSON.stringify({ success: false, reason: 'Status online desabilitado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('🔍 [MAINTAIN-CONFIG]', JSON.stringify(aiConfig.online_status_config, null, 2));
    
    let heartbeatCount = 0;
    const maxHeartbeats = 40; // ~40 minutos
    let currentInterval = 60000; // Começar com 1 minuto
    const maxInterval = 180000; // Máximo 3 minutos
    
    const heartbeatFunction = async () => {
      try {
        heartbeatCount++;
        console.log(`💓 [MAINTAIN-HEARTBEAT] Heartbeat ${heartbeatCount} iniciado`);
        
        // 🚫 PRESENÇA DESABILITADA: Endpoint /chat/presence não existe no CodeChat v2.2.1
        console.log(`🚫 [MAINTAIN-HEARTBEAT] Heartbeat ${heartbeatCount} - presença via perfil mantida`);
        console.log(`⚠️ [MAINTAIN-HEARTBEAT] NOTA: /api/v2/instance/{id}/chat/presence não existe - usando apenas configuração de perfil`);
        
        // Aplicar apenas configurações de perfil (endpoints válidos)
        const profileSuccess = await applyFullProfileConfig(instanceId, businessToken, aiConfig.online_status_config);

        if (profileSuccess) {
          console.log(`✅ [MAINTAIN-HEARTBEAT] Heartbeat ${heartbeatCount} - configuração de perfil mantida`);
        } else {
          console.log(`❌ [MAINTAIN-HEARTBEAT] Heartbeat ${heartbeatCount} falhou na configuração de perfil`);
        }

        // A cada 5 heartbeats, reaplicar configurações de perfil
        if (heartbeatCount % 5 === 0) {
          console.log(`🔄 [MAINTAIN-HEARTBEAT] Reaplicando configurações de perfil (heartbeat ${heartbeatCount})`);
          await applyFullProfileConfig(instanceId, businessToken, aiConfig.online_status_config);
        }

        // Aumentar gradualmente o intervalo
        if (heartbeatCount % 8 === 0 && currentInterval < maxInterval) {
          currentInterval = Math.min(currentInterval * 1.2, maxInterval);
          console.log(`⏱️ [MAINTAIN-HEARTBEAT] Intervalo ajustado para: ${currentInterval/1000}s`);
        }

        // Continuar se ainda não atingiu o máximo
        if (heartbeatCount < maxHeartbeats) {
          setTimeout(heartbeatFunction, currentInterval);
        } else {
          console.log('💓 [MAINTAIN-HEARTBEAT] Ciclo de heartbeat finalizado após 40 minutos');
        }

      } catch (error) {
        console.error(`❌ [MAINTAIN-HEARTBEAT] Erro no heartbeat ${heartbeatCount}:`, error);
        
        // Tentar novamente após erro, mas reduzir tentativas
        if (heartbeatCount < maxHeartbeats - 3) {
          setTimeout(heartbeatFunction, currentInterval * 1.5);
        }
      }
    };

    // Iniciar o primeiro heartbeat imediatamente
    heartbeatFunction();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sistema de manutenção de status online iniciado',
        maxHeartbeats,
        initialInterval: currentInterval 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [MAINTAIN-ONLINE] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});