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
    console.log('🔧 [MEDIA-KEYS-FIX-ROBUST] Iniciando correção robusta de media keys...');

    // Buscar mensagens com problemas nas chaves de mídia (bytes array)
    const { data: ticketMessages, error: ticketFetchError } = await supabase
      .from('ticket_messages')
      .select('id, message_id, media_key, file_enc_sha256, file_sha256, message_type, processing_status')
      .in('message_type', ['image', 'video', 'audio', 'document'])
      .or('processing_status.eq.received,processing_status.eq.failed')
      .limit(100);

    const { data: whatsappMessages, error: whatsappFetchError } = await supabase
      .from('whatsapp_messages')
      .select('id, message_id, media_key, file_enc_sha256, file_sha256, message_type')
      .in('message_type', ['image', 'video', 'audio', 'document'])
      .not('media_key', 'is', null)
      .limit(100);

    if (ticketFetchError || whatsappFetchError) {
      console.error('❌ [MEDIA-KEYS-FIX-ROBUST] Erro ao buscar mensagens:', ticketFetchError || whatsappFetchError);
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
      console.log('✅ [MEDIA-KEYS-FIX-ROBUST] Nenhuma mensagem de mídia para corrigir');
      return new Response(JSON.stringify({ 
        success: true, 
        fixed: 0, 
        message: 'Nenhuma mensagem para corrigir' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔧 [MEDIA-KEYS-FIX-ROBUST] Encontradas ${allMessages.length} mensagens para verificar`);

    let fixed = 0;
    let errors = 0;
    let alreadyFixed = 0;

    for (const message of allMessages) {
      try {
        let needsUpdate = false;
        let updatedFields: any = {};

        // Verificar e corrigir media_key de forma robusta
        if (message.media_key) {
          const correctedMediaKey = convertToBase64Robust(message.media_key);
          if (correctedMediaKey && correctedMediaKey !== message.media_key) {
            updatedFields.media_key = correctedMediaKey;
            needsUpdate = true;
            console.log(`🔑 [MEDIA-KEYS-FIX-ROBUST] Convertendo media_key para ${message.message_id} (${typeof message.media_key} → string)`);
          } else if (typeof message.media_key === 'string') {
            alreadyFixed++;
          }
        }

        // Verificar e corrigir file_enc_sha256
        if (message.file_enc_sha256) {
          const correctedFileEncSha256 = convertToBase64Robust(message.file_enc_sha256);
          if (correctedFileEncSha256 && correctedFileEncSha256 !== message.file_enc_sha256) {
            updatedFields.file_enc_sha256 = correctedFileEncSha256;
            needsUpdate = true;
            console.log(`🔐 [MEDIA-KEYS-FIX-ROBUST] Convertendo file_enc_sha256 para ${message.message_id} (${typeof message.file_enc_sha256} → string)`);
          }
        }

        // Verificar e corrigir file_sha256
        if (message.file_sha256) {
          const correctedFileSha256 = convertToBase64Robust(message.file_sha256);
          if (correctedFileSha256 && correctedFileSha256 !== message.file_sha256) {
            updatedFields.file_sha256 = correctedFileSha256;
            needsUpdate = true;
            console.log(`🔒 [MEDIA-KEYS-FIX-ROBUST] Convertendo file_sha256 para ${message.message_id} (${typeof message.file_sha256} → string)`);
          }
        }

        // Se é ticket_message e precisa de reprocessamento, resetar status
        if (needsUpdate && message.source === 'ticket_messages') {
          updatedFields.processing_status = 'received';
          console.log(`🔄 [MEDIA-KEYS-FIX-ROBUST] Resetando status para reprocessamento: ${message.message_id}`);
        }

        if (needsUpdate) {
          // Atualizar na tabela de origem
          const { error: updateError } = await supabase
            .from(message.source)
            .update(updatedFields)
            .eq('id', message.id);

          if (updateError) {
            console.error(`❌ [MEDIA-KEYS-FIX-ROBUST] Erro ao atualizar ${message.source} ${message.id}:`, updateError);
            errors++;
            continue;
          }

          // Tentar sincronizar com a outra tabela
          const otherTable = message.source === 'ticket_messages' ? 'whatsapp_messages' : 'ticket_messages';
          const { error: crossUpdateError } = await supabase
            .from(otherTable)
            .update({
              media_key: updatedFields.media_key,
              file_enc_sha256: updatedFields.file_enc_sha256,
              file_sha256: updatedFields.file_sha256
            })
            .eq('message_id', message.message_id);

          if (crossUpdateError && crossUpdateError.code !== 'PGRST116') {
            console.log(`ℹ️ [MEDIA-KEYS-FIX-ROBUST] Não foi possível sincronizar ${otherTable} para ${message.message_id}`);
          }

          fixed++;
          console.log(`✅ [MEDIA-KEYS-FIX-ROBUST] Mensagem ${message.message_id} corrigida em ${message.source}`);
        }

      } catch (error) {
        console.error(`❌ [MEDIA-KEYS-FIX-ROBUST] Erro ao processar mensagem ${message.message_id}:`, error);
        errors++;
      }
    }

    const summary = {
      success: true,
      fixed,
      errors,
      alreadyFixed,
      total: allMessages.length,
      message: `Correção robusta concluída: ${fixed} corrigidas, ${alreadyFixed} já estavam corretas, ${errors} erros`
    };

    console.log('🎉 [MEDIA-KEYS-FIX-ROBUST] Resumo:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [MEDIA-KEYS-FIX-ROBUST] Erro geral:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Converter dados para Base64 de forma extremamente robusta
 */
function convertToBase64Robust(data: any): string | null {
  try {
    if (!data) return null;
    
    // Se já é string Base64, retornar como está
    if (typeof data === 'string') return data;
    
    // Se é Uint8Array
    if (data instanceof Uint8Array) {
      return btoa(String.fromCharCode.apply(null, Array.from(data)));
    }
    
    // Se é array de números
    if (Array.isArray(data) && data.every(item => typeof item === 'number')) {
      const uint8Array = new Uint8Array(data);
      return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
    }
    
    // Se é objeto {0: 251, 1: 128, ...} (Uint8Array serializado)
    if (typeof data === 'object' && !Array.isArray(data)) {
      // Verificar se todas as chaves são números sequenciais
      const keys = Object.keys(data).map(Number).sort((a, b) => a - b);
      
      if (keys.length > 0 && keys.every(k => !isNaN(k) && k >= 0)) {
        // Verificar se é sequencial a partir de 0
        const isSequential = keys.every((key, index) => key === index);
        
        if (isSequential) {
          const uint8Array = new Uint8Array(keys.length);
          keys.forEach(key => {
            uint8Array[key] = data[key];
          });
          return btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
        }
      }
    }
    
    console.warn('🔧 [CONVERT-ROBUST] Tipo não reconhecido para conversão:', {
      type: typeof data,
      isArray: Array.isArray(data),
      keys: typeof data === 'object' ? Object.keys(data).slice(0, 5) : null
    });
    return null;
  } catch (error) {
    console.error('❌ [CONVERT-ROBUST] Erro na conversão:', error);
    return null;
  }
}