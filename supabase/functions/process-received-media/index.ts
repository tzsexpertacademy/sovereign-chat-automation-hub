import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para transcrever áudio automaticamente
async function transcribeAudio(base64Audio: string, clientId: string, supabase: any) {
  try {
    console.log('🎙️ [AUTO-TRANSCRIBE] Iniciando transcrição automática...')
    
    // Buscar API key do cliente na tabela client_ai_configs
    const { data: clientConfig } = await supabase
      .from('client_ai_configs')
      .select('openai_api_key')
      .eq('client_id', clientId)
      .single()
    
    if (!clientConfig?.openai_api_key) {
      console.log('⚠️ [AUTO-TRANSCRIBE] API key OpenAI não encontrada para cliente')
      return null
    }
    
    // Chamar edge function de speech-to-text
    const transcriptionResponse = await supabase.functions.invoke('speech-to-text', {
      body: {
        audio: base64Audio,
        openaiApiKey: clientConfig.openai_api_key,
        messageId: 'auto-transcribe'
      }
    })
    
    if (transcriptionResponse.error) {
      console.error('❌ [AUTO-TRANSCRIBE] Erro na transcrição:', transcriptionResponse.error)
      return null
    }
    
    const transcription = transcriptionResponse.data?.text
    console.log('✅ [AUTO-TRANSCRIBE] Transcrição obtida:', transcription?.substring(0, 100) + '...')
    
    return transcription
    
  } catch (error) {
    console.error('❌ [AUTO-TRANSCRIBE] Erro na transcrição automática:', error)
    return null
  }
}

// Função para atualizar mensagem em batches pendentes
async function updateMessageInBatch(messageId: string, newContent: string, supabase: any) {
  try {
    console.log('📦 [UPDATE-BATCH] Buscando batches pendentes com a mensagem:', messageId)
    
    // Buscar batches pendentes que contenham esta mensagem
    const { data: batches } = await supabase
      .from('message_batches')
      .select('*')
      .is('processing_started_at', null)
    
    if (!batches || batches.length === 0) {
      console.log('📦 [UPDATE-BATCH] Nenhum batch pendente encontrado')
      return
    }
    
    for (const batch of batches) {
      if (!batch.messages || !Array.isArray(batch.messages)) continue
      
      // Verificar se o batch contém a mensagem
      const messages = batch.messages as any[]
      let updated = false
      
      const updatedMessages = messages.map(msg => {
        if (msg.messageId === messageId) {
          console.log('📦 [UPDATE-BATCH] Atualizando mensagem no batch:', batch.id)
          updated = true
          return { ...msg, content: newContent }
        }
        return msg
      })
      
      if (updated) {
        // Atualizar o batch com a mensagem modificada
        await supabase
          .from('message_batches')
          .update({ messages: updatedMessages })
          .eq('id', batch.id)
        
        console.log('✅ [UPDATE-BATCH] Batch atualizado com transcrição:', batch.id)
      }
    }
    
  } catch (error) {
    console.error('❌ [UPDATE-BATCH] Erro ao atualizar batch:', error)
  }
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

    // ✅ CORREÇÃO: Buscar mensagens de mídia que precisam ser descriptografadas
    // Inclui mensagens que têm media_key mas não têm os dados base64 correspondentes
    const { data: pendingMessages, error: queryError } = await supabase
      .from('ticket_messages')
      .select('*')
      .in('message_type', ['audio', 'image', 'video', 'document'])
      .not('media_key', 'is', null)
      .not('media_url', 'is', null)
      .or('processing_status.in.(pending,received),and(message_type.eq.image,image_base64.is.null),and(message_type.eq.audio,audio_base64.is.null),and(message_type.eq.video,video_base64.is.null),and(message_type.eq.document,document_base64.is.null)')
      .limit(20)

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
        // ✅ VERIFICAÇÃO DE COMPLETUDE: Verificar se a mídia já foi processada
        const needsProcessing = (() => {
          switch (message.message_type) {
            case 'image': return !message.image_base64
            case 'audio': return !message.audio_base64
            case 'video': return !message.video_base64
            case 'document': return !message.document_base64
            default: return false
          }
        })()

        if (!needsProcessing) {
          console.log(`⏭️ Mídia já processada: ${message.message_type} - ${message.message_id}`)
          continue
        }

        console.log(`🔧 [MEDIA-DECRYPT] Processando mídia incompleta: ${message.message_type} - ${message.message_id}`)
        console.log(`🔍 [MEDIA-DECRYPT] Dados disponíveis: media_key=${!!message.media_key}, media_url=${!!message.media_url}`)
        console.log(`🎯 [MEDIA-DECRYPT] Ticket ID: ${message.ticket_id}`)

        // ✅ CORREÇÃO DEFINITIVA: Buscar instance_id através do ticket
        const { data: ticketData, error: ticketError } = await supabase
          .from('conversation_tickets')
          .select('instance_id, client_id')
          .eq('id', message.ticket_id)
          .single()

        if (ticketError || !ticketData) {
          console.error(`❌ Ticket não encontrado: ${message.ticket_id}`, ticketError)
          continue
        }

        console.log(`🎯 [MEDIA-DECRYPT] Instance ID encontrado: ${ticketData.instance_id}`)
        console.log(`🎯 [MEDIA-DECRYPT] Client ID encontrado: ${ticketData.client_id}`)

        // Buscar business_token do cliente
        const { data: clientData } = await supabase
          .from('clients')
          .select('business_token')
          .eq('id', ticketData.client_id)
          .single()

        if (!clientData?.business_token) {
          console.error(`❌ Business token não encontrado para cliente: ${ticketData.client_id}`)
          continue
        }

        console.log(`🔑 [MEDIA-DECRYPT] Business token encontrado para cliente`)

        // Preparar dados para descriptografia
        const downloadRequest = {
          contentType: message.message_type,
          content: {
            url: message.media_url,
            mediaKey: message.media_key,
            directPath: message.direct_path || message.media_url,
            mimetype: message.media_mime_type || getDefaultMimeType(message.message_type)
          }
        }

        console.log(`📡 [MEDIA-DECRYPT] Request preparado:`, {
          contentType: downloadRequest.contentType,
          url: downloadRequest.content.url?.substring(0, 50) + '...',
          hasMediaKey: !!downloadRequest.content.mediaKey,
          mimetype: downloadRequest.content.mimetype
        })

        // Chamar endpoint de descriptografia
        const downloadUrl = `https://api.yumer.com.br/api/v2/instance/${ticketData.instance_id}/media/directly-download`
        console.log(`🌐 [MEDIA-DECRYPT] Chamando endpoint: ${downloadUrl}`)
        
        const downloadResponse = await fetch(downloadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${clientData.business_token}`
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
            break
          case 'image':
            updateData.image_base64 = base64Data
            break
          case 'video':
            updateData.video_base64 = base64Data
            break
          case 'document':
            updateData.document_base64 = base64Data
            break
        }

        // Para áudios, tentar transcrição automática e atualizar content
        if (message.message_type === 'audio') {
          console.log('🎙️ [AUTO-TRANSCRIBE] Processando áudio para transcrição...')
          
          // Buscar ticket para obter client_id
          const { data: ticketData } = await supabase
            .from('conversation_tickets')
            .select('client_id')
            .eq('id', message.ticket_id)
            .single()
          
          if (ticketData?.client_id) {
            console.log(`🎙️ [AUTO-TRANSCRIBE] Usando client_id: ${ticketData.client_id}`)
            const transcription = await transcribeAudio(base64Data, ticketData.client_id, supabase)
            
            if (transcription) {
              // Atualizar content da mensagem com transcrição
              updateData.content = `🎵 Áudio - Transcrição: ${transcription}`
              console.log('✅ [AUTO-TRANSCRIBE] Content atualizado com transcrição')
              
              // Também atualizar na tabela whatsapp_messages se existir
              await supabase
                .from('whatsapp_messages')
                .update({ body: updateData.content })
                .eq('message_id', message.message_id)
              
              // Atualizar batch se existir
              await updateMessageInBatch(message.message_id, updateData.content, supabase)
              
              console.log('🔄 [AUTO-TRANSCRIBE] Mensagem sincronizada em todas as tabelas')
            } else {
              console.log('⚠️ [AUTO-TRANSCRIBE] Transcrição falhou, mantendo placeholder')
            }
          }
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

        console.log(`✅ [MEDIA-DECRYPT] Mídia processada com sucesso: ${message.message_type} - ${message.message_id}`)
        console.log(`🎯 [MEDIA-DECRYPT] Base64 salvo: ${base64Data.length} bytes`)
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