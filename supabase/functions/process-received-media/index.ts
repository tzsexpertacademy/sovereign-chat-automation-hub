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

    // 🛡️ PROTEÇÃO CONTRA LOOP INFINITO: Timeout global de 30 segundos
    const processingTimeout = setTimeout(() => {
      console.log('⏰ [TIMEOUT] Processamento cancelado por timeout (30s)')
      throw new Error('Processing timeout exceeded')
    }, 30000)

        // ✅ MÉTODO ÚNICO: Buscar mensagens que precisam descriptografia via API directly-download
        console.log('🔍 [MEDIA-DECRYPT] Buscando mensagens pendentes de descriptografia...')
        
        const { data: pendingMessages, error: queryError } = await supabase
          .from('ticket_messages')
          .select('*')
          .in('message_type', ['audio', 'image', 'video', 'document'])
          .not('media_key', 'is', null)
          .not('media_url', 'is', null)
          .eq('processing_status', 'received')
          .or('and(message_type.eq.image,image_base64.is.null),and(message_type.eq.audio,audio_base64.is.null),and(message_type.eq.video,video_base64.is.null),and(message_type.eq.document,document_base64.is.null)')
          .order('created_at', { ascending: true })
          .limit(5)
    
    console.log(`🔍 [MEDIA-DECRYPT] Encontradas ${pendingMessages?.length || 0} mensagens para processamento`)

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

        console.log(`📥 [MEDIA-DECRYPT] Response status: ${downloadResponse.status}`)
        console.log(`📥 [MEDIA-DECRYPT] Response headers:`, Object.fromEntries(downloadResponse.headers.entries()))

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

        // Converter para base64
        const mediaBuffer = await downloadResponse.arrayBuffer()
        console.log(`📦 [MEDIA-DECRYPT] Buffer recebido: ${mediaBuffer.byteLength} bytes`)
        
        if (mediaBuffer.byteLength === 0) {
          console.error(`❌ Buffer vazio recebido para: ${message.message_id}`)
          continue
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(mediaBuffer)))
        console.log(`✅ [MEDIA-DECRYPT] Base64 gerado: ${base64Data.length} caracteres`)

        // Salvar dados base64 na coluna apropriada
        const updateData: any = {
          processing_status: 'processing'
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
              updateData.media_transcription = transcription
              updateData.processing_status = 'completed'
              console.log('✅ [AUTO-TRANSCRIBE] Content atualizado com transcrição')
              
              // Também atualizar na tabela whatsapp_messages se existir
              await supabase
                .from('whatsapp_messages')
                .update({ 
                  body: updateData.content,
                  is_processed: true,
                  processed_at: new Date().toISOString()
                })
                .eq('message_id', message.message_id)
              
              // ✅ CRIAR BATCH APÓS TRANSCRIÇÃO BEM-SUCEDIDA
              console.log('🎵 [POST-TRANSCRIPTION] Criando batch com transcrição para IA...')
              
              const batchMessage = {
                messageId: message.message_id,
                chatId: ticketData.instance_id, // Usar instance_id como chat_id
                content: transcription, // USAR A TRANSCRIÇÃO COMO CONTEÚDO
                fromMe: false,
                timestamp: Date.now(),
                pushName: message.sender_name || 'Unknown'
              };

              // Buscar chat_id real da mensagem original
              const { data: originalMessage } = await supabase
                .from('whatsapp_messages')
                .select('chat_id')
                .eq('message_id', message.message_id)
                .single();

              if (originalMessage?.chat_id) {
                batchMessage.chatId = originalMessage.chat_id;
              }

              // Criar batch com RPC V2
              const { data: batchResult, error: batchError } = await supabase
                .rpc('manage_message_batch_v2', {
                  p_chat_id: batchMessage.chatId,
                  p_client_id: ticketData.client_id,
                  p_instance_id: ticketData.instance_id,
                  p_message: batchMessage
                });

              if (batchError) {
                console.error('❌ [POST-TRANSCRIPTION] Erro ao criar batch:', batchError);
              } else {
                console.log('✅ [POST-TRANSCRIPTION] Batch criado com transcrição:', batchResult);
                
                // Disparar processamento se for novo batch
                if (batchResult?.is_new_batch) {
                  console.log('🚀 [POST-TRANSCRIPTION] Disparando processamento de batch com transcrição...');
                  
                  await supabase.functions.invoke('process-message-batches', {
                    body: { 
                      trigger: 'post_transcription',
                      chatId: batchMessage.chatId,
                      timestamp: new Date().toISOString()
                    }
                  });
                }
              }
              
              console.log('🔄 [AUTO-TRANSCRIBE] Mensagem sincronizada em todas as tabelas')
            } else {
              console.log('⚠️ [AUTO-TRANSCRIBE] Transcrição falhou, mantendo placeholder')
              updateData.processing_status = 'completed'
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
        console.log(`🎯 [MEDIA-DECRYPT] Base64 salvo: ${base64Data.length} bytes`)
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
    case 'image': return 'image/jpeg'
    case 'video': return 'video/mp4'
    case 'document': return 'application/octet-stream'
    default: return 'application/octet-stream'
  }
}