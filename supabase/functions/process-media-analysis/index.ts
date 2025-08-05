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

    // Buscar mensagens de mídia que têm base64 mas não têm análise
    console.log('🔍 [MEDIA-ANALYSIS] Buscando mensagens para análise...')
    
    const { data: pendingAnalysis, error: queryError } = await supabase
      .from('ticket_messages')
      .select('*')
      .in('message_type', ['image', 'video', 'audio', 'document'])
      .or('and(message_type.eq.image,image_base64.not.is.null,media_transcription.is.null),and(message_type.eq.video,video_base64.not.is.null,media_transcription.is.null),and(message_type.eq.audio,audio_base64.not.is.null,media_transcription.is.null),and(message_type.eq.document,document_base64.not.is.null,media_transcription.is.null)')
      .order('created_at', { ascending: true })
      .limit(10)
    
    console.log(`🔍 [MEDIA-ANALYSIS] Encontradas ${pendingAnalysis?.length || 0} mensagens para análise`)

    if (queryError) {
      console.error('❌ Erro ao buscar mensagens para análise:', queryError)
      return new Response(JSON.stringify({ error: 'Query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!pendingAnalysis || pendingAnalysis.length === 0) {
      console.log('ℹ️ Nenhuma mensagem pendente para análise')
      return new Response(JSON.stringify({ analyzed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`🧠 Analisando ${pendingAnalysis.length} mensagens de mídia`)

    let analyzedCount = 0
    let errorCount = 0

    for (const message of pendingAnalysis) {
      try {
        console.log(`🔍 [MEDIA-ANALYSIS] Processando: ${message.message_type} - ${message.message_id}`)

        // Buscar client_id através do ticket para obter API key
        const { data: ticketData } = await supabase
          .from('conversation_tickets')
          .select('client_id')
          .eq('id', message.ticket_id)
          .single()

        if (!ticketData?.client_id) {
          console.error(`❌ Client ID não encontrado para ticket: ${message.ticket_id}`)
          errorCount++
          continue
        }

        // Buscar API key OpenAI do cliente
        const { data: clientConfig } = await supabase
          .from('client_ai_configs')
          .select('openai_api_key')
          .eq('client_id', ticketData.client_id)
          .single()

        if (!clientConfig?.openai_api_key) {
          console.log(`⚠️ API key OpenAI não encontrada para cliente: ${ticketData.client_id}`)
          errorCount++
          continue
        }

        let analysis = null

        // Processar baseado no tipo de mídia
        switch (message.message_type) {
          case 'image':
            if (message.image_base64) {
              analysis = await processImageWithVision(message.image_base64, clientConfig.openai_api_key)
            }
            break
          
          case 'audio':
            if (message.audio_base64) {
              analysis = await processAudioAnalysis(message.content, clientConfig.openai_api_key)
            }
            break
          
          case 'video':
            if (message.video_base64) {
              analysis = await processVideoAnalysis(message.video_base64, clientConfig.openai_api_key)
            }
            break
          
          case 'document':
            if (message.document_base64) {
              analysis = await processDocumentAnalysis(message.document_base64, message.media_mime_type, clientConfig.openai_api_key)
            }
            break
          
          default:
            console.log(`⏭️ Tipo de mídia não suportado para análise: ${message.message_type}`)
            continue
        }

        if (!analysis) {
          console.error(`❌ Falha na análise: ${message.message_type} - ${message.message_id}`)
          errorCount++
          continue
        }

        // Salvar análise no banco
        const { error: updateError } = await supabase
          .from('ticket_messages')
          .update({ 
            media_transcription: analysis,
            processing_status: 'analyzed'
          })
          .eq('id', message.id)

        if (updateError) {
          console.error(`❌ Erro ao salvar análise ${message.message_id}:`, updateError)
          errorCount++
          continue
        }

        console.log(`✅ [MEDIA-ANALYSIS] Análise salva: ${message.message_type} - ${message.message_id}`)
        analyzedCount++

      } catch (error) {
        console.error(`❌ Erro ao analisar mensagem ${message.message_id}:`, error)
        errorCount++
      }
    }

    console.log(`🧠 Análise concluída: ${analyzedCount} sucesso, ${errorCount} erros`)

    return new Response(JSON.stringify({
      analyzed: analyzedCount,
      errors: errorCount,
      total: pendingAnalysis.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro no processamento de análise:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/**
 * Processar imagem com GPT-4 Vision - FUNÇÃO ÚNICA
 */
async function processImageWithVision(imageBase64: string, apiKey: string): Promise<string> {
  try {
    console.log('🖼️ [IMAGE-VISION] Processando imagem com GPT-4 Vision')
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise esta imagem detalhadamente em português. Descreva o que você vê, identifique textos se houver, e forneça informações úteis para um assistente de atendimento ao cliente.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500
      }),
    })

    if (!response.ok) {
      throw new Error(`Erro na API OpenAI: ${response.status}`)
    }

    const data = await response.json()
    const analysis = data.choices[0].message.content
    
    console.log('✅ [IMAGE-VISION] Análise concluída:', analysis.substring(0, 100))
    return analysis
    
  } catch (error) {
    console.error('❌ [IMAGE-VISION] Erro ao processar imagem:', error)
    return '[Erro ao analisar imagem]'
  }
}

/**
 * Processar áudio - análise contextual da transcrição
 */
async function processAudioAnalysis(transcription: string, apiKey: string): Promise<string> {
  try {
    console.log('🎵 [AUDIO-ANALYSIS] Processando contexto do áudio...')
    
    if (!transcription || transcription === '🎵 Áudio') {
      return '🎵 Áudio recebido - Transcrição em processamento'
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente especializado em análise de áudios para atendimento ao cliente. Analise a transcrição fornecida e extraia informações relevantes como: sentimento, intenção, urgência, palavras-chave importantes, e contexto da mensagem.'
          },
          {
            role: 'user',
            content: `Analise esta transcrição de áudio: "${transcription}"`
          }
        ],
        max_tokens: 800
      }),
    })

    if (!response.ok) {
      throw new Error(`Erro na API OpenAI: ${response.status}`)
    }

    const data = await response.json()
    const analysis = data.choices[0].message.content
    
    console.log('✅ [AUDIO-ANALYSIS] Análise contextual concluída:', analysis.substring(0, 100))
    return `🎵 ${transcription}\n\nAnálise: ${analysis}`
    
  } catch (error) {
    console.error('❌ [AUDIO-ANALYSIS] Erro ao processar áudio:', error)
    return `🎵 ${transcription}\n\nAnálise: [Erro ao analisar contexto do áudio]`
  }
}

/**
 * Processar vídeo (placeholder - análise de frame)
 */
async function processVideoAnalysis(videoBase64: string, apiKey: string): Promise<string> {
  try {
    console.log('🎬 [VIDEO-ANALYSIS] Processando vídeo...')
    
    // Por enquanto, retornar análise básica
    // Futuramente pode extrair frames e analisar com Vision
    return `📹 Vídeo recebido - Duração estimada e análise de conteúdo disponível para processamento futuro.`
    
  } catch (error) {
    console.error('❌ [VIDEO-ANALYSIS] Erro ao processar vídeo:', error)
    return '[Erro ao analisar vídeo]'
  }
}

/**
 * Processar documento (análise de texto/OCR)
 */
async function processDocumentAnalysis(documentBase64: string, mimeType: string, apiKey: string): Promise<string> {
  try {
    console.log('📄 [DOCUMENT-ANALYSIS] Processando documento...')
    
    // Análise básica baseada no tipo MIME
    const fileType = mimeType?.split('/')[1] || 'unknown'
    return `📄 Documento recebido - Tipo: ${fileType.toUpperCase()} - Disponível para análise de conteúdo.`
    
  } catch (error) {
    console.error('❌ [DOCUMENT-ANALYSIS] Erro ao processar documento:', error)
    return '[Erro ao analisar documento]'
  }
}