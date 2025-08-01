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

    // Buscar mensagens de imagem com media_key em formato de objeto nas duas tabelas
    const { data: ticketMessages, error: ticketFetchError } = await supabase
      .from('ticket_messages')
      .select('id, message_id, media_key, file_enc_sha256, file_sha256, message_type')
      .eq('message_type', 'image')
      .not('media_key', 'is', null)
      .limit(50);

    const { data: whatsappMessages, error: whatsappFetchError } = await supabase
      .from('whatsapp_messages')
      .select('id, message_id, media_key, file_enc_sha256, file_sha256, message_type')
      .eq('message_type', 'image')
      .not('media_key', 'is', null)
      .limit(50);

    if (ticketFetchError || whatsappFetchError) {
      console.error('❌ [MEDIA-KEYS-FIX] Erro ao buscar mensagens:', ticketFetchError || whatsappFetchError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar mensagens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const allMessages = [
      ...(ticketMessages || []).map(m => ({...m, source: 'ticket_messages'})),
      ...(whatsappMessages || []).map(m => ({...m, source: 'whatsapp_messages'}))
    ];

    if (allMessages.length === 0) {
      console.log('✅ [MEDIA-KEYS-FIX] Nenhuma mensagem de imagem para corrigir');
      return new Response(JSON.stringify({ 
        success: true, 
        fixed: 0, 
        message: 'Nenhuma mensagem para corrigir' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔧 [MEDIA-KEYS-FIX] Encontradas ${allMessages.length} mensagens para verificar`);

    let fixed = 0;
    let errors = 0;
    let alreadyFixed = 0;

    for (const message of allMessages) {
      try {
        let needsUpdate = false;
        let updatedFields: any = {};

        // Verificar e corrigir media_key
        if (message.media_key && typeof message.media_key === 'object') {
          const correctedMediaKey = convertObjectToBase64(message.media_key);
          if (correctedMediaKey) {
            updatedFields.media_key = correctedMediaKey;
            needsUpdate = true;
            console.log(`🔑 [MEDIA-KEYS-FIX] Convertendo media_key para ${message.message_id}`);
          }
        } else if (typeof message.media_key === 'string') {
          alreadyFixed++;
        }

        // Verificar e corrigir file_enc_sha256
        if (message.file_enc_sha256 && typeof message.file_enc_sha256 === 'object') {
          const correctedFileEncSha256 = convertObjectToBase64(message.file_enc_sha256);
          if (correctedFileEncSha256) {
            updatedFields.file_enc_sha256 = correctedFileEncSha256;
            needsUpdate = true;
            console.log(`🔐 [MEDIA-KEYS-FIX] Convertendo file_enc_sha256 para ${message.message_id}`);
          }
        }

        // Verificar e corrigir file_sha256
        if (message.file_sha256 && typeof message.file_sha256 === 'object') {
          const correctedFileSha256 = convertObjectToBase64(message.file_sha256);
          if (correctedFileSha256) {
            updatedFields.file_sha256 = correctedFileSha256;
            needsUpdate = true;
            console.log(`🔒 [MEDIA-KEYS-FIX] Convertendo file_sha256 para ${message.message_id}`);
          }
        }

        if (needsUpdate) {
          // Atualizar na tabela de origem
          const { error: updateError } = await supabase
            .from(message.source)
            .update(updatedFields)
            .eq('id', message.id);

          if (updateError) {
            console.error(`❌ [MEDIA-KEYS-FIX] Erro ao atualizar ${message.source} ${message.id}:`, updateError);
            errors++;
            continue;
          }

          // Tentar atualizar na tabela cruzada também
          const otherTable = message.source === 'ticket_messages' ? 'whatsapp_messages' : 'ticket_messages';
          const { error: crossUpdateError } = await supabase
            .from(otherTable)
            .update(updatedFields)
            .eq('message_id', message.message_id);

          if (crossUpdateError && crossUpdateError.code !== 'PGRST116') {
            console.log(`ℹ️ [MEDIA-KEYS-FIX] Não foi possível atualizar ${otherTable} para ${message.message_id} (pode ser normal)`);
          }

          fixed++;
          console.log(`✅ [MEDIA-KEYS-FIX] Mensagem ${message.message_id} corrigida em ${message.source}`);
        }

      } catch (error) {
        console.error(`❌ [MEDIA-KEYS-FIX] Erro ao processar mensagem ${message.message_id}:`, error);
        errors++;
      }
    }

    const summary = {
      success: true,
      fixed,
      errors,
      alreadyFixed,
      total: allMessages.length,
      message: `Correção concluída: ${fixed} corrigidas, ${alreadyFixed} já estavam corretas, ${errors} erros`
    };

    console.log('🎉 [MEDIA-KEYS-FIX] Resumo:', summary);

    return new Response(JSON.stringify(summary), {
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