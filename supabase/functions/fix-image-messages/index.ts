import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  console.log('🔧 [FIX-IMAGES] Iniciando correção de mensagens de imagem...');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { clientId } = body;
      
      if (!clientId) {
        return new Response(
          JSON.stringify({ error: 'clientId é obrigatório' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log(`🔧 [FIX-IMAGES] Corrigindo mensagens para cliente: ${clientId}`);

      // 1. ENCONTRAR MENSAGENS COM PROBLEMAS DE TIPO
      const { data: brokenImages, error: fetchError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('message_type', 'text')
        .neq('raw_data', null)
        .limit(100);

      if (fetchError) {
        throw fetchError;
      }

      console.log(`🔧 [FIX-IMAGES] Encontradas ${brokenImages?.length || 0} mensagens para analisar`);

      let fixedImages = 0;
      let reprocessedTickets = 0;

      for (const message of brokenImages || []) {
        try {
          const rawData = message.raw_data;
          
          // Verificar se é realmente uma imagem baseado no contentType ou content
          const isImage = rawData?.contentType === 'image' || 
                         rawData?.content?.imageMessage ||
                         (rawData?.content && rawData.content.url && 
                          (rawData.content.mimetype?.includes('image') || 
                           rawData.content.mediaKey));

          if (isImage) {
            console.log(`🖼️ [FIX-IMAGES] Corrigindo mensagem de imagem: ${message.message_id}`);
            
            // Extrair dados de mídia do raw_data
            const imageData = rawData.content?.imageMessage || rawData.content || rawData;
            
            const updateData = {
              message_type: 'image',
              body: imageData.caption || '📷 Imagem',
              media_url: imageData.url,
              media_key: imageData.mediaKey,
              file_enc_sha256: imageData.fileEncSha256,
              file_sha256: imageData.fileSha256,
              direct_path: imageData.directPath,
              media_mime_type: imageData.mimetype || 'image/jpeg'
            };

            // Atualizar whatsapp_messages
            const { error: updateError } = await supabase
              .from('whatsapp_messages')
              .update(updateData)
              .eq('id', message.id);

            if (updateError) {
              console.error('❌ [FIX-IMAGES] Erro ao atualizar whatsapp_messages:', updateError);
              continue;
            }

            fixedImages++;

            // Verificar se existe ticket_message correspondente
            const { data: ticketMessage } = await supabase
              .from('ticket_messages')
              .select('*')
              .eq('message_id', message.message_id)
              .single();

            if (ticketMessage) {
              // Atualizar ticket_messages com os dados corretos
              const { error: ticketUpdateError } = await supabase
                .from('ticket_messages')
                .update({
                  message_type: 'image',
                  content: imageData.caption || '📷 Imagem',
                  media_url: imageData.url,
                  media_key: imageData.mediaKey,
                  file_enc_sha256: imageData.fileEncSha256,
                  file_sha256: imageData.fileSha256,
                  media_mime_type: imageData.mimetype || 'image/jpeg',
                  media_duration: null
                })
                .eq('id', ticketMessage.id);

              if (ticketUpdateError) {
                console.error('❌ [FIX-IMAGES] Erro ao atualizar ticket_messages:', ticketUpdateError);
              } else {
                reprocessedTickets++;
                console.log(`✅ [FIX-IMAGES] Ticket message atualizado: ${ticketMessage.id}`);
              }
            }
          }
        } catch (error) {
          console.error('❌ [FIX-IMAGES] Erro ao processar mensagem:', message.message_id, error);
        }
      }

      console.log(`✅ [FIX-IMAGES] Correção concluída: ${fixedImages} imagens corrigidas, ${reprocessedTickets} tickets atualizados`);

      return new Response(JSON.stringify({
        success: true,
        fixed_images: fixedImages,
        reprocessed_tickets: reprocessedTickets,
        message: `Correção concluída: ${fixedImages} imagens corrigidas`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('❌ [FIX-IMAGES] Erro crítico:', error);
      return new Response(JSON.stringify({
        error: error.message,
        success: false
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({
    error: 'Method not allowed'
  }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});