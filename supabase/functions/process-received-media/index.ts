import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função simplificada para transcrever áudio (versão que funcionava)
async function transcribeAudio(base64Audio: string, clientId: string, supabase: any) {
  try {
    console.log('🎙️ [AUTO-TRANSCRIBE] Iniciando transcrição automática...')
    console.log('🎙️ [AUTO-TRANSCRIBE] Usando client_id:', clientId)
    
    // Buscar API key do cliente
    const { data: clientConfig } = await supabase
      .from('client_ai_configs')
      .select('openai_api_key')
      .eq('client_id', clientId)
      .single()
    
    if (!clientConfig?.openai_api_key) {
      console.log('⚠️ [AUTO-TRANSCRIBE] API key OpenAI não encontrada')
      return null
    }
    
    console.log('🔑 [AUTO-TRANSCRIBE] API key encontrada:', {
      keyLength: clientConfig.openai_api_key.length,
      keyPrefix: clientConfig.openai_api_key.substring(0, 10)
    })
    
    console.log('🎙️ [AUTO-TRANSCRIBE] Iniciando transcrição automática...', {
      audioLength: base64Audio.length,
      clientId,
      audioPrefix: base64Audio.substring(0, 50)
    })
    
    // Chamar speech-to-text (versão original simples)
    const transcriptionResponse = await supabase.functions.invoke('speech-to-text', {
      body: {
        audio: base64Audio,
        openaiApiKey: clientConfig.openai_api_key,
        messageId: '3EB08D00A4AE4B491D46F6'
      }
    })
    
    console.log('📡 [AUTO-TRANSCRIBE] Response status:', transcriptionResponse.error ? 'ERROR' : 'SUCCESS')
    
    if (transcriptionResponse.error) {
      console.error('❌ [AUTO-TRANSCRIBE] Erro na transcrição:', transcriptionResponse.error)
      return null
    }
    
    const transcription = transcriptionResponse.data?.text
    console.log('✅ [AUTO-TRANSCRIBE] Content atualizado com transcrição')
    
    return transcription
    
  } catch (error) {
    console.error('❌ [AUTO-TRANSCRIBE] Erro na transcrição:', error)
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

    // 🛡️ PROTEÇÃO CONTRA LOOP INFINITO: Timeout global de 30 segundos
    const processingTimeout = setTimeout(() => {
      console.log('⏰ [TIMEOUT] Processamento cancelado por timeout (30s)')
      throw new Error('Processing timeout exceeded')
    }, 30000)

    // 🔄 MODO DIRETO (single-message) OU VARREDURA PADRÃO
    const body = await req.json().catch(() => null)

    let pendingMessages: any[] = []

    if (body?.messageId) {
      console.log('🎯 [MEDIA-DECRYPT] Modo direto por messageId:', body.messageId)
      const { data: single, error: singleErr } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('message_id', body.messageId)
        .single()
      if (singleErr || !single) {
        console.error('❌ [MEDIA-DECRYPT] Mensagem não encontrada para processamento direto:', singleErr)
        return new Response(JSON.stringify({ error: 'Message not found', messageId: body.messageId }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      pendingMessages = [single]
    } else {
      // ✅ MÉTODO ÚNICO: Buscar mensagens que precisam descriptografia via API directly-download
      console.log('🔍 [MEDIA-DECRYPT] Buscando mensagens pendentes de descriptografia...')
      const { data: qData, error: queryError } = await supabase
        .from('ticket_messages')
        .select('*')
        .in('message_type', ['audio', 'ptt', 'image', 'video', 'document'])
        .not('media_key', 'is', null)
        .not('media_url', 'is', null)
        .eq('processing_status', 'received')
        .or('and(message_type.eq.image,image_base64.is.null),and(message_type.eq.audio,audio_base64.is.null),and(message_type.eq.ptt,audio_base64.is.null),and(message_type.eq.video,video_base64.is.null),and(message_type.eq.document,document_base64.is.null)')
        .order('created_at', { ascending: true })
        .limit(5)

      if (queryError) {
        console.error('❌ Erro ao buscar mensagens pendentes:', queryError)
        return new Response(JSON.stringify({ error: 'Query failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      pendingMessages = qData || []
    }

    console.log(`🔍 [MEDIA-DECRYPT] Encontradas ${pendingMessages.length} mensagens para processamento`)


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
            case 'ptt': return !message.audio_base64
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

        // ✅ Normalizar mediaKey em Base64 (pode vir como JSON/array/Buffer)
        if (!message.media_key) {
          console.error(`❌ [MEDIA-KEY] MediaKey não encontrada`)
          continue
        }

        let mediaKeyBase64: string | null = null
        try {
          if (typeof message.media_key === 'string') {
            const str = message.media_key.trim()
            if (str.startsWith('[') && str.endsWith(']')) {
              // Array string → Uint8Array → base64
              const arr = JSON.parse(str) as number[]
              mediaKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(arr)))
            } else if (str.includes('"type":"Buffer"') || str.includes('Uint8Array')) {
              // Buffer-like JSON dentro de string
              const json = JSON.parse(str)
              const data = Array.isArray(json?.data) ? json.data : []
              mediaKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(data)))
            } else {
              // Assumir já base64
              mediaKeyBase64 = str
            }
          } else if (Array.isArray(message.media_key)) {
            mediaKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(message.media_key as number[])))
          } else if (typeof message.media_key === 'object' && message.media_key !== null) {
            const data = Array.isArray((message.media_key as any).data) ? (message.media_key as any).data : null
            if (data) {
              mediaKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(data)))
            }
          }
        } catch (e) {
          console.error('⚠️ [MEDIA-KEY] Falha ao normalizar media_key:', e)
        }

        if (!mediaKeyBase64) {
          console.error('❌ [MEDIA-KEY] MediaKey inválida após normalização')
          continue
        }

        // Garantir directPath
        const directPath = message.direct_path || (message.media_url ? new URL(message.media_url).pathname + (new URL(message.media_url).search || '') : null)

        const downloadRequest = {
          contentType: message.message_type === 'ptt' ? 'audio' : message.message_type,
          content: {
            url: message.media_url,
            mediaKey: mediaKeyBase64,
            directPath,
            mimetype: message.media_mime_type || getDefaultMimeType(message.message_type)
          }
        }

        console.log(`📡 [MEDIA-DECRYPT] Calling Yumer API...`)
        console.log(`📡 [MEDIA-DECRYPT] Request: ${downloadRequest.contentType}, URL: ${downloadRequest.content.url?.substring(0, 30)}...`)

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

        console.log(`📥 [MEDIA-DECRYPT] Response status: ${downloadResponse.status}`)
        console.log(`📥 [MEDIA-DECRYPT] Response headers:`, Object.fromEntries(downloadResponse.headers.entries()))
        
        // ✅ LOG CRÍTICO: Verificar se a resposta tem conteúdo
        const responseSize = downloadResponse.headers.get('content-length')
        console.log(`📏 [MEDIA-DECRYPT] Response size header: ${responseSize} bytes`)

        if (!downloadResponse.ok) {
          const errorText = await downloadResponse.text()
          console.error(`❌ Erro ao baixar mídia: ${downloadResponse.status} - ${downloadResponse.statusText}`)
          console.error(`❌ Resposta da API:`, errorText)
          console.error(`❌ Request que falhou:`, {
            endpoint: downloadUrl,
            requestBody: downloadRequest,
            businessToken: `${clientData.business_token.substring(0, 20)}...`
          })
          continue
        }

        // ✅ SIMPLIFICAÇÃO: Baixar e converter diretamente
        const arrayBuffer = await downloadResponse.arrayBuffer()
        console.log(`📦 [MEDIA-DECRYPT] Downloaded: ${arrayBuffer.byteLength} bytes`)
        
        if (arrayBuffer.byteLength === 0) {
          console.error(`❌ Empty response for: ${message.message_id}`)
          continue
        }
        
        // Conversão simples para Base64
        const base64String = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        console.log(`✅ [MEDIA-DECRYPT] Base64 created: ${base64String.length} chars`)

        // Salvar dados base64 na coluna apropriada
        const updateData: any = {
          processing_status: 'processing'
        }

        switch (message.message_type) {
          case 'audio':
          case 'ptt':
            updateData.audio_base64 = base64String
            break
          case 'image':
            updateData.image_base64 = base64String
            break
          case 'video':
            updateData.video_base64 = base64String
            break
          case 'document':
            updateData.document_base64 = base64String
            break
        }

        // Para áudios, tentar transcrição automática e atualizar content
        if (message.message_type === 'audio' || message.message_type === 'ptt') {
          console.log('🎙️ [AUTO-TRANSCRIBE] Processando áudio para transcrição...')
          
          // Usar o ticketData já obtido anteriormente
          if (ticketData?.client_id) {
            console.log(`🎙️ [AUTO-TRANSCRIBE] Usando client_id: ${ticketData.client_id}`)
            const transcription = await transcribeAudio(base64String, ticketData.client_id, supabase)
            
            if (transcription) {
              // Atualizar modelo da própria mensagem: conteúdo textual = transcrição
              updateData.content = transcription
              updateData.media_transcription = transcription
              updateData.processing_status = 'transcribed'
              console.log('✅ [AUTO-TRANSCRIBE] Transcrição obtida (conteúdo atualizado)')

              // Atualizar somente a transcrição na whatsapp_messages (não alterar body/is_processed)
              await supabase
                .from('whatsapp_messages')
                .update({ 
                  media_transcription: transcription
                })
                .eq('message_id', message.message_id)

              // Atualizar preview do ticket
              try {
                await supabase
                  .from('conversation_tickets')
                  .update({
                    last_message_preview: transcription,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', message.ticket_id)
              } catch (e) {
                console.error('⚠️ [POST-TRANSCRIPTION] Falha ao atualizar ticket preview:', e)
              }

              // Reprogramar debounce para garantir resposta após transcrição
              try {
                const debounceUntil = new Date(Date.now() + 4000).toISOString()
                await supabase
                  .from('assistant_debounce')
                  .upsert({
                    ticket_id: message.ticket_id,
                    client_id: ticketData.client_id,
                    instance_id: ticketData.instance_id,
                    chat_id: (await supabase.from('whatsapp_messages').select('chat_id').eq('message_id', message.message_id).maybeSingle()).data?.chat_id || null,
                    debounce_until: debounceUntil,
                    scheduled: true,
                    last_updated: new Date().toISOString()
                  }, { onConflict: 'ticket_id' })
              } catch (e) {
                console.error('⚠️ [POST-TRANSCRIPTION] Falha no upsert assistant_debounce:', e)
              }

              // Disparar (ou reforçar) processador imediato para este ticket
              try {
                await supabase.functions.invoke('immediate-batch-processor', {
                  body: { ticketId: message.ticket_id }
                })
                console.log('🚀 [POST-TRANSCRIPTION] immediate-batch-processor acionado')
              } catch (e) {
                console.error('⚠️ [POST-TRANSCRIPTION] Falha ao acionar immediate-batch-processor:', e)
              }
            } else {
              console.log('⚠️ [AUTO-TRANSCRIBE] Transcrição falhou, mantendo placeholder')
              updateData.processing_status = 'processed'
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

        console.log(`✅ [MEDIA-DECRYPT] Mídia descriptografada: ${message.message_type} - ${message.message_id}`)
        console.log(`🎯 [MEDIA-DECRYPT] Base64 salvo: ${base64String.length} bytes`)
        processedCount++

      } catch (error) {
        console.error(`❌ Erro ao processar mensagem ${message.message_id}:`, error)
        errorCount++
      }
    }

    // 🛡️ LIMPAR TIMEOUT: Cancelar timeout se chegou até aqui
    clearTimeout(processingTimeout)
    
    console.log(`🎯 Descriptografia concluída: ${processedCount} sucesso, ${errorCount} erros`)

    // ✅ FLUXO UNIFICADO: Chamar análise de mídia se houve descriptografias
    if (processedCount > 0) {
      console.log('🧠 [UNIFIED-FLOW] Disparando análise de mídia...')
      try {
        await supabase.functions.invoke('process-media-analysis')
        console.log('✅ [UNIFIED-FLOW] Análise de mídia disparada')
      } catch (analysisError) {
        console.error('❌ [UNIFIED-FLOW] Erro ao disparar análise:', analysisError)
      }
    }

    return new Response(JSON.stringify({
      decrypted: processedCount,
      errors: errorCount,
      total: pendingMessages.length,
      analysisTriggered: processedCount > 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro no processamento de mídia:', error)
    
    // 🛡️ LIMPAR TIMEOUT: Garantir que timeout seja cancelado em caso de erro
    try {
      clearTimeout(processingTimeout)
    } catch {}
    
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
    case 'ptt': return 'audio/ogg; codecs=opus'
    case 'image': return 'image/jpeg'
    case 'video': return 'video/mp4'
    case 'document': return 'application/octet-stream'
    default: return 'application/octet-stream'
  }
}