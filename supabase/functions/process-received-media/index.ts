import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar mensagens com mídia pendente de processamento
    const { data: pendingMessages, error: queryError } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('processing_status', 'pending')
      .in('message_type', ['audio', 'image', 'video', 'document'])
      .is('audio_base64', null)
      .is('image_base64', null)
      .is('video_base64', null)
      .is('document_base64', null)
      .not('media_key', 'is', null)
      .not('media_url', 'is', null)
      .limit(10)

    if (queryError) {
      console.error('❌ Erro ao buscar mensagens pendentes:', queryError)
      return new Response(JSON.stringify({ error: 'Query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('ℹ️ Nenhuma mensagem de mídia pendente encontrada')
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`🎯 Processando ${pendingMessages.length} mensagens de mídia`)

    let processedCount = 0
    let errorCount = 0

    for (const message of pendingMessages) {
      try {
        console.log(`📱 Processando mídia: ${message.message_type} - ${message.message_id}`)

        // Buscar dados da instância
        const { data: instanceData } = await supabase
          .from('whatsapp_instances')
          .select('instance_id, business_token')
          .eq('id', message.instance_id)
          .single()

        if (!instanceData) {
          console.error(`❌ Instância não encontrada: ${message.instance_id}`)
          continue
        }

        // Preparar dados para descriptografia
        const downloadRequest = {
          contentType: message.message_type,
          content: {
            url: message.media_url,
            mediaKey: message.media_key,
            directPath: message.direct_path || message.media_url,
            mimetype: message.mime_type || getDefaultMimeType(message.message_type)
          }
        }

        // Chamar endpoint de descriptografia
        const downloadUrl = `https://api.yumer.com.br/api/v2/instance/${instanceData.instance_id}/media/directly-download`
        
        const downloadResponse = await fetch(downloadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${instanceData.business_token}`
          },
          body: JSON.stringify(downloadRequest)
        })

        if (!downloadResponse.ok) {
          console.error(`❌ Erro ao baixar mídia: ${downloadResponse.status} - ${downloadResponse.statusText}`)
          continue
        }

        // Converter para base64
        const mediaBuffer = await downloadResponse.arrayBuffer()
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(mediaBuffer)))

        // Salvar dados base64 na coluna apropriada
        const updateData: any = {
          processing_status: 'completed'
        }

        switch (message.message_type) {
          case 'audio':
            updateData.audio_base64 = base64Data
            updateData.has_audio_base64 = true
            break
          case 'image':
            updateData.image_base64 = base64Data
            updateData.has_image_base64 = true
            break
          case 'video':
            updateData.video_base64 = base64Data
            updateData.has_video_base64 = true
            break
          case 'document':
            updateData.document_base64 = base64Data
            updateData.has_document_base64 = true
            break
        }

        // Atualizar mensagem no banco
        const { error: updateError } = await supabase
          .from('ticket_messages')
          .update(updateData)
          .eq('id', message.id)

        if (updateError) {
          console.error(`❌ Erro ao atualizar mensagem ${message.message_id}:`, updateError)
          errorCount++
          continue
        }

        console.log(`✅ Mídia processada: ${message.message_type} - ${message.message_id}`)
        processedCount++

      } catch (error) {
        console.error(`❌ Erro ao processar mensagem ${message.message_id}:`, error)
        errorCount++
      }
    }

    console.log(`🎯 Processamento concluído: ${processedCount} sucesso, ${errorCount} erros`)

    return new Response(JSON.stringify({
      processed: processedCount,
      errors: errorCount,
      total: pendingMessages.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro no processamento de mídia:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function getDefaultMimeType(messageType: string): string {
  switch (messageType) {
    case 'audio': return 'audio/ogg; codecs=opus'
    case 'image': return 'image/jpeg'
    case 'video': return 'video/mp4'
    case 'document': return 'application/octet-stream'
    default: return 'application/octet-stream'
  }
}