import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 [MEDIA-KEYS-FIX] Iniciando correção de media keys...');

    // 1. Buscar mensagens com media_key no formato incorreto (objeto JSON)
    const { data: brokenMessages, error: fetchError } = await supabase
      .from('whatsapp_messages')
      .select('id, message_id, media_key, file_enc_sha256, file_sha256, raw_data')
      .not('media_key', 'is', null)
      .limit(100);

    if (fetchError) {
      console.error('❌ [MEDIA-KEYS-FIX] Erro ao buscar mensagens:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!brokenMessages || brokenMessages.length === 0) {
      console.log('✅ [MEDIA-KEYS-FIX] Nenhuma mensagem para corrigir');
      return new Response(JSON.stringify({ 
        success: true, 
        fixed: 0, 
        message: 'Nenhuma mensagem para corrigir' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔧 [MEDIA-KEYS-FIX] Encontradas ${brokenMessages.length} mensagens para verificar`);

    let fixed = 0;
    let errors = 0;

    for (const message of brokenMessages) {
      try {
        // Verificar se media_key precisa de correção
        const needsFix = typeof message.media_key === 'object' && message.media_key !== null;
        
        if (!needsFix) {
          console.log(`⏭️ [MEDIA-KEYS-FIX] Mensagem ${message.message_id} já tem media_key correto`);
          continue;
        }

        console.log(`🔧 [MEDIA-KEYS-FIX] Corrigindo mensagem ${message.message_id}`);

        // Converter media_key de objeto para Base64
        const correctedMediaKey = convertObjectToBase64(message.media_key);
        const correctedFileEncSha256 = convertObjectToBase64(message.file_enc_sha256);
        const correctedFileSha256 = convertObjectToBase64(message.file_sha256);

        // Atualizar mensagem
        const { error: updateError } = await supabase
          .from('whatsapp_messages')
          .update({
            media_key: correctedMediaKey,
            file_enc_sha256: correctedFileEncSha256,
            file_sha256: correctedFileSha256
          })
          .eq('id', message.id);

        if (updateError) {
          console.error(`❌ [MEDIA-KEYS-FIX] Erro ao atualizar mensagem ${message.message_id}:`, updateError);
          errors++;
          continue;
        }

        // Também corrigir em ticket_messages se existir
        const { error: ticketUpdateError } = await supabase
          .from('ticket_messages')
          .update({
            media_key: correctedMediaKey,
            file_enc_sha256: correctedFileEncSha256,
            file_sha256: correctedFileSha256
          })
          .eq('message_id', message.message_id);

        if (ticketUpdateError && ticketUpdateError.code !== 'PGRST116') {
          console.error(`⚠️ [MEDIA-KEYS-FIX] Erro ao atualizar ticket_message ${message.message_id}:`, ticketUpdateError);
        }

        fixed++;
        console.log(`✅ [MEDIA-KEYS-FIX] Mensagem ${message.message_id} corrigida`);

      } catch (error) {
        console.error(`❌ [MEDIA-KEYS-FIX] Erro ao processar mensagem ${message.message_id}:`, error);
        errors++;
      }
    }

    console.log(`🎉 [MEDIA-KEYS-FIX] Correção concluída: ${fixed} corrigidas, ${errors} erros`);

    return new Response(JSON.stringify({ 
      success: true, 
      fixed,
      errors,
      total: brokenMessages.length,
      message: `Correção concluída: ${fixed} mensagens corrigidas`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [MEDIA-KEYS-FIX] Erro geral:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Converter objeto JSON para Base64
 */
function convertObjectToBase64(data: any): string | null {
  try {
    if (!data) return null;
    
    // Se já é string, retornar como está
    if (typeof data === 'string') return data;
    
    // Se é objeto com propriedades numéricas ordenadas (Uint8Array serializado), converter
    if (typeof data === 'object' && !Array.isArray(data)) {
      // Obter chaves numéricas ordenadas
      const keys = Object.keys(data).map(Number).sort((a, b) => a - b);
      const uint8Array = new Uint8Array(keys.length);
      
      // Preencher array ordenado
      keys.forEach((key, index) => {
        uint8Array[index] = data[key];
      });
      
      return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
    }
    
    // Se é array, converter diretamente
    if (Array.isArray(data)) {
      const uint8Array = new Uint8Array(data);
      return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
    }
    
    console.error('🔧 [CONVERT] Tipo de dados não reconhecido:', typeof data);
    return null;
  } catch (error) {
    console.error('🔧 [CONVERT] Erro na conversão:', error);
    return null;
  }
}