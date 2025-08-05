import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messageId } = await req.json()
    
    console.log('🔧 [FORCE-IMAGE] Forçando processamento da imagem:', messageId)
    
    // Buscar mensagem específica
    const { data: message, error: messageError } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('message_id', messageId)
      .eq('message_type', 'image')
      .single()
    
    if (messageError || !message) {
      throw new Error(`Mensagem não encontrada: ${messageError?.message}`)
    }
    
    console.log('✅ [FORCE-IMAGE] Mensagem encontrada:', {
      messageId: message.message_id,
      hasImageBase64: !!message.image_base64,
      imageSize: message.image_base64?.length,
      currentTranscription: message.media_transcription
    })
    
    if (!message.image_base64) {
      throw new Error('Imagem base64 não disponível')
    }
    
    // Processar imagem com GPT-4 Vision
    console.log('🖼️ [FORCE-IMAGE] Processando com GPT-4 Vision...')
    const analysis = await processImageWithVision(message.image_base64, openAIApiKey)
    
    console.log('✅ [FORCE-IMAGE] Análise gerada:', analysis.substring(0, 200))
    
    // Salvar análise
    const { error: updateError } = await supabase
      .from('ticket_messages')
      .update({ media_transcription: analysis })
      .eq('id', message.id)
    
    if (updateError) {
      throw new Error(`Erro ao salvar análise: ${updateError.message}`)
    }
    
    console.log('✅ [FORCE-IMAGE] Análise salva com sucesso')
    
    // Chamar AI Assistant para reprocessar com nova análise
    console.log('🤖 [FORCE-IMAGE] Chamando AI Assistant para reprocessar...')
    
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant-process', {
      body: {
        ticketId: message.ticket_id,
        message: 'Forçar reprocessamento com análise de imagem atualizada',
        context: {
          forceReprocess: true,
          updatedImageAnalysis: true
        }
      }
    })
    
    if (aiError) {
      console.error('❌ [FORCE-IMAGE] Erro ao chamar AI Assistant:', aiError)
    } else {
      console.log('✅ [FORCE-IMAGE] AI Assistant chamado com sucesso')
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysis.substring(0, 200) + '...',
        messageId,
        aiProcessed: !aiError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('❌ [FORCE-IMAGE] Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Processar imagem com GPT-4 Vision
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
        max_tokens: 1000
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