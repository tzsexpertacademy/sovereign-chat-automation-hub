import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧹 [CLEANUP] Iniciando limpeza de mensagens processadas...');

    // 1. Marcar mensagens antigas como processadas se estiverem órfãs
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: oldUnprocessed, error: fetchError } = await supabaseClient
      .from('whatsapp_messages')
      .select('id, message_id, chat_id, created_at')
      .eq('is_processed', false)
      .eq('from_me', false)
      .lt('created_at', oneDayAgo);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`🔍 [CLEANUP] Encontradas ${oldUnprocessed?.length || 0} mensagens antigas não processadas`);

    if (oldUnprocessed && oldUnprocessed.length > 0) {
      // Marcar como processadas mensagens antigas (mais de 24h)
      const { error: updateError } = await supabaseClient
        .from('whatsapp_messages')
        .update({ 
          is_processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('is_processed', false)
        .eq('from_me', false)
        .lt('created_at', oneDayAgo);

      if (updateError) {
        throw updateError;
      }

      console.log(`✅ [CLEANUP] ${oldUnprocessed.length} mensagens antigas marcadas como processadas`);
    }

    // 2. Logs de estatísticas
    const { data: stats } = await supabaseClient
      .from('whatsapp_messages')
      .select('is_processed, from_me', { count: 'exact' });

    const processed = stats?.filter(m => m.is_processed).length || 0;
    const unprocessed = stats?.filter(m => !m.is_processed).length || 0;
    const total = stats?.length || 0;

    console.log('📊 [CLEANUP] Estatísticas:', {
      total,
      processed,
      unprocessed,
      processedPercentage: total > 0 ? ((processed / total) * 100).toFixed(1) + '%' : '0%'
    });

    return new Response(
      JSON.stringify({
        success: true,
        cleanedCount: oldUnprocessed?.length || 0,
        stats: {
          total,
          processed,
          unprocessed
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ [CLEANUP] Erro na limpeza:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to cleanup messages',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});