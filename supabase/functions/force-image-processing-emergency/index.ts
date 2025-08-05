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
    const messageId = '3EB07072704AA397730C7E'
    
    console.log('🚨 [EMERGENCY-FIX] Forçando processamento emergencial da imagem:', messageId)
    
    // Buscar mensagem específica com dados completos
    const { data: message, error: messageError } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('message_id', messageId)
      .single()
    
    if (messageError || !message) {
      throw new Error(`Mensagem não encontrada: ${messageError?.message}`)
    }
    
    console.log('🔍 [EMERGENCY-FIX] Status da mensagem:', {
      messageId: message.message_id,
      hasImageBase64: !!message.image_base64,
      imageSize: message.image_base64?.length,
      currentTranscription: message.media_transcription,
      processingStatus: message.processing_status
    })
    
    // Se não tem image_base64, tentar descriptografar primeiro
    if (!message.image_base64 && message.media_url && message.media_key) {
      console.log('🔓 [EMERGENCY-FIX] Tentando descriptografar imagem...')
      
      try {
        const { data: decryptResult, error: decryptError } = await supabase.functions.invoke('whatsapp-decrypt-image', {
          body: {
            mediaUrl: message.media_url,
            mediaKey: message.media_key,
            messageId: message.message_id
          }
        })
        
        if (decryptError) {
          console.error('❌ [EMERGENCY-FIX] Erro na descriptografia:', decryptError)
        } else {
          console.log('✅ [EMERGENCY-FIX] Descriptografia concluída')
          
          // Recarregar mensagem após descriptografia
          const { data: updatedMessage } = await supabase
            .from('ticket_messages')
            .select('*')
            .eq('message_id', messageId)
            .single()
          
          if (updatedMessage?.image_base64) {
            message.image_base64 = updatedMessage.image_base64
            console.log('✅ [EMERGENCY-FIX] image_base64 obtido após descriptografia')
          }
        }
      } catch (decryptError) {
        console.error('❌ [EMERGENCY-FIX] Erro crítico na descriptografia:', decryptError)
      }
    }
    
    if (!message.image_base64) {
      throw new Error('Imagem base64 não disponível mesmo após tentativa de descriptografia')
    }
    
    // Processar imagem com GPT-4 Vision
    console.log('🖼️ [EMERGENCY-FIX] Processando com GPT-4 Vision...')
    const analysis = await processImageWithVision(message.image_base64, openAIApiKey)
    
    console.log('✅ [EMERGENCY-FIX] Análise gerada:', analysis.substring(0, 200))
    
    // Salvar análise forçada
    const { error: updateError } = await supabase
      .from('ticket_messages')
      .update({ 
        media_transcription: analysis,
        processing_status: 'analyzed'
      })
      .eq('id', message.id)
    
    if (updateError) {
      throw new Error(`Erro ao salvar análise: ${updateError.message}`)
    }
    
    console.log('✅ [EMERGENCY-FIX] Análise salva com sucesso')
    
    // Reprocessar o batch com a análise atualizada
    console.log('🔄 [EMERGENCY-FIX] Reprocessando batch com análise completa...')
    
    const { data: batchReprocess, error: batchError } = await supabase.functions.invoke('process-message-batches', {
      body: {
        trigger: 'emergency_fix',
        chatId: '554796451886@s.whats',
        forceReprocess: true
      }
    })
    
    if (batchError) {
      console.error('❌ [EMERGENCY-FIX] Erro ao reprocessar batch:', batchError)
    } else {
      console.log('✅ [EMERGENCY-FIX] Batch reprocessado com sucesso')
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysis.substring(0, 200) + '...',
        messageId,
        reprocessed: !batchError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('❌ [EMERGENCY-FIX] Erro:', error)
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
                text: 'Analise esta imagem detalhadamente em português. Descreva o que você vê, identifique textos se houver, e forneça informações úteis para um assistente de atendimento ao cliente. Esta análise deve ser contextual com base em uma solicitação prévia por áudio.'
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
    return '[Erro ao analisar imagem - processamento emergencial falhou]'
  }
}