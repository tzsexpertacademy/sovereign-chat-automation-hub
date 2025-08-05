import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para transcrever áudio automaticamente
async function transcribeAudio(base64Audio: string, clientId: string, supabase: any) {
  try {
    console.log('🎙️ [AUTO-TRANSCRIBE] Iniciando transcrição automática...')
    
    // Buscar API key do cliente
    const { data: clientConfig } = await supabase
      .from('clients')
      .select('openai_api_key')
      .eq('id', clientId)
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

    // Buscar mensagens com mídia pendente de processamento
    const { data: pendingMessages, error: queryError } = await supabase
      .from('ticket_messages')
      .select('*')
      .in('processing_status', ['pending', 'received'])
      .in('message_type', ['audio', 'image', 'video', 'document'])
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

        // Buscar dados da instância usando instance_id como string
        const { data: instanceData } = await supabase
          .from('whatsapp_instances')
          .select('instance_id, business_token')
          .eq('instance_id', message.instance_id)
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