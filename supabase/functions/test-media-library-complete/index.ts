import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { clientId, testCommand, mediaType = 'audio' } = await req.json()
    
    console.log(`🔍 [MEDIA-TEST] Iniciando diagnóstico completo para ${mediaType}:`, {
      clientId,
      testCommand,
      mediaType
    })

    const diagnosticResults = {
      success: false,
      clientId,
      testCommand,
      mediaType,
      errors: [],
      warnings: [],
      recommendations: [],
      steps: [],
      summary: {}
    }

    // Conectar ao Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // === ETAPA 1: BUSCAR ASSISTENTE ===
    console.log('👤 [STEP-1] Buscando assistente...')
    diagnosticResults.steps.push({
      step: 1,
      name: 'Buscar Assistente',
      status: 'running'
    })

    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('*')
      .eq('client_id', clientId)
      .single()

    if (assistantError || !assistant) {
      const error = `Assistente não encontrado para cliente ${clientId}`
      diagnosticResults.errors.push(`Etapa 1 falhou: ${error}`)
      diagnosticResults.steps[0].status = 'failed'
      diagnosticResults.steps[0].error = error
      throw new Error(error)
    }

    diagnosticResults.steps[0].status = 'success'
    diagnosticResults.steps[0].result = `Assistente encontrado: ${assistant.name}`
    diagnosticResults.assistantName = assistant.name
    console.log(`✅ [STEP-1] Assistente encontrado: ${assistant.name}`)

    // === ETAPA 2: VALIDAR ADVANCED_SETTINGS ===
    console.log('⚙️ [STEP-2] Validando advanced_settings...')
    diagnosticResults.steps.push({
      step: 2,
      name: 'Validar Advanced Settings',
      status: 'running'
    })

    if (!assistant.advanced_settings) {
      const error = 'advanced_settings é NULL'
      diagnosticResults.errors.push(`Etapa 2 falhou: ${error}`)
      diagnosticResults.steps[1].status = 'failed'
      diagnosticResults.steps[1].error = error
      throw new Error(error)
    }

    let advancedSettings
    try {
      if (typeof assistant.advanced_settings === 'string') {
        advancedSettings = JSON.parse(assistant.advanced_settings)
      } else {
        advancedSettings = assistant.advanced_settings
      }
    } catch (e) {
      const error = `advanced_settings não é JSON válido: ${e.message}`
      diagnosticResults.errors.push(`Etapa 2 falhou: ${error}`)
      diagnosticResults.steps[1].status = 'failed'
      diagnosticResults.steps[1].error = error
      throw new Error(error)
    }

    diagnosticResults.steps[1].status = 'success'
    diagnosticResults.steps[1].result = 'advanced_settings é um objeto JSON válido'
    console.log('✅ [STEP-2] advanced_settings válido')

    // === ETAPA 3: VALIDAR BIBLIOTECA DE MÍDIA ===
    console.log(`📚 [STEP-3] Validando biblioteca de ${mediaType}...`)
    diagnosticResults.steps.push({
      step: 3,
      name: `Validar Biblioteca de ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}`,
      status: 'running'
    })

    const libraryKey = `${mediaType}_library`
    const mediaLibrary = advancedSettings[libraryKey]

    if (!mediaLibrary) {
      const error = `${libraryKey} não existe em advanced_settings`
      diagnosticResults.errors.push(`Etapa 3 falhou: ${error}`)
      diagnosticResults.steps[2].status = 'failed'
      diagnosticResults.steps[2].error = error
      throw new Error(error)
    }

    if (!Array.isArray(mediaLibrary)) {
      const error = `${libraryKey} não é um array`
      diagnosticResults.errors.push(`Etapa 3 falhou: ${error}`)
      diagnosticResults.steps[2].status = 'failed'
      diagnosticResults.steps[2].error = error
      throw new Error(error)
    }

    if (mediaLibrary.length === 0) {
      const error = `${libraryKey} está vazio`
      diagnosticResults.errors.push(`Etapa 3 falhou: ${error}`)
      diagnosticResults.steps[2].status = 'failed'
      diagnosticResults.steps[2].error = error
      diagnosticResults.recommendations.push(`Adicione itens à biblioteca de ${mediaType}`)
      throw new Error(error)
    }

    diagnosticResults.steps[2].status = 'success'
    diagnosticResults.steps[2].result = `${libraryKey} tem ${mediaLibrary.length} itens`
    diagnosticResults.mediaLibrarySize = mediaLibrary.length
    console.log(`✅ [STEP-3] ${libraryKey} válida com ${mediaLibrary.length} itens`)

    // === ETAPA 4: TESTE DE REGEX PARA DETECTAR TRIGGER ===
    console.log('🔍 [STEP-4] Testando detecção de trigger...')
    diagnosticResults.steps.push({
      step: 4,
      name: 'Detectar Trigger via Regex',
      status: 'running'
    })

    const triggerRegex = new RegExp(`^(${mediaType})\\s+(.+)$`, 'i')
    const match = testCommand.match(triggerRegex)

    if (!match) {
      const error = `Comando "${testCommand}" não segue o padrão "${mediaType} <trigger>"`
      diagnosticResults.errors.push(`Etapa 4 falhou: ${error}`)
      diagnosticResults.steps[3].status = 'failed'
      diagnosticResults.steps[3].error = error
      diagnosticResults.recommendations.push(`Use o formato: "${mediaType} <nome_do_trigger>"`)
      throw new Error(error)
    }

    const detectedTrigger = match[2].trim()
    diagnosticResults.detectedTrigger = detectedTrigger
    diagnosticResults.steps[3].status = 'success'
    diagnosticResults.steps[3].result = `Trigger detectado: "${detectedTrigger}"`
    console.log(`✅ [STEP-4] Trigger detectado: "${detectedTrigger}"`)

    // === ETAPA 5: BUSCAR MATCH NA BIBLIOTECA ===
    console.log('🎯 [STEP-5] Buscando match na biblioteca...')
    diagnosticResults.steps.push({
      step: 5,
      name: 'Buscar Match na Biblioteca',
      status: 'running'
    })

    const mediaItem = mediaLibrary.find((item: any) => {
      if (!item.trigger) return false
      
      const itemTrigger = item.trigger.toString().toLowerCase().trim()
      const searchTrigger = detectedTrigger.toLowerCase().trim()
      
      return itemTrigger === searchTrigger || 
             itemTrigger.includes(searchTrigger) ||
             searchTrigger.includes(itemTrigger)
    })

    if (!mediaItem) {
      const availableTriggers = mediaLibrary.map((item: any) => item.trigger).join(', ')
      const error = `Trigger "${detectedTrigger}" não encontrado na biblioteca`
      diagnosticResults.errors.push(`Etapa 5 falhou: ${error}`)
      diagnosticResults.steps[4].status = 'failed'
      diagnosticResults.steps[4].error = error
      diagnosticResults.steps[4].availableTriggers = availableTriggers
      diagnosticResults.recommendations.push(`Triggers disponíveis: ${availableTriggers}`)
      throw new Error(error)
    }

    diagnosticResults.steps[4].status = 'success'
    diagnosticResults.steps[4].result = `Match encontrado: ${mediaItem.trigger}`
    console.log(`✅ [STEP-5] Match: ${mediaItem.trigger}`)

    // === ETAPA 6: VALIDAR MÍDIA BASE64 ===
    console.log(`🎼 [STEP-6] Validando ${mediaType} base64...`)
    diagnosticResults.steps.push({
      step: 6,
      name: `Validar ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} Base64`,
      status: 'running'
    })

    const base64Key = mediaType === 'audio' ? 'audioBase64' : 
                      mediaType === 'video' ? 'videoBase64' : 
                      mediaType === 'image' ? 'imageBase64' : null

    if (!base64Key) {
      const error = `Tipo de mídia não suportado: ${mediaType}`
      diagnosticResults.errors.push(`Etapa 6 falhou: ${error}`)
      diagnosticResults.steps[5].status = 'failed'
      diagnosticResults.steps[5].error = error
      throw new Error(error)
    }

    if (!mediaItem[base64Key]) {
      const error = `${base64Key} não existe no item da biblioteca`
      diagnosticResults.errors.push(`Etapa 6 falhou: ${error}`)
      diagnosticResults.steps[5].status = 'failed'
      diagnosticResults.steps[5].error = error
      throw new Error(error)
    }

    if (typeof mediaItem[base64Key] !== 'string' || mediaItem[base64Key].length < 100) {
      const error = `${base64Key} parece ser inválido (muito curto ou não é string)`
      diagnosticResults.errors.push(`Etapa 6 falhou: ${error}`)
      diagnosticResults.steps[5].status = 'failed'
      diagnosticResults.steps[5].error = error
      throw new Error(error)
    }

    diagnosticResults.steps[5].status = 'success'
    diagnosticResults.steps[5].result = `${base64Key} válido (${mediaItem[base64Key].length} caracteres)`
    diagnosticResults.mediaBase64Length = mediaItem[base64Key].length
    console.log(`✅ [STEP-6] ${base64Key} válido (${mediaItem[base64Key].length} chars)`)

    // === ETAPA 7: SIMULAR PREPARAÇÃO PARA ENVIO ===
    console.log('📤 [STEP-7] Simulando preparação para envio...')
    diagnosticResults.steps.push({
      step: 7,
      name: 'Simular Preparação para Envio',
      status: 'running'
    })

    try {
      const simulatedSendData = {
        clientId,
        assistantId: assistant.id,
        assistantName: assistant.name,
        mediaType,
        trigger: mediaItem.trigger,
        name: mediaItem.name,
        category: mediaItem.category,
        [base64Key]: mediaItem[base64Key],
        readyToSend: true,
        timestamp: new Date().toISOString()
      }

      diagnosticResults.steps[6].status = 'success'
      diagnosticResults.steps[6].result = `Dados preparados para envio de ${mediaType}`
      diagnosticResults.simulatedData = {
        trigger: mediaItem.trigger,
        name: mediaItem.name,
        category: mediaItem.category,
        base64Length: mediaItem[base64Key].length
      }
      console.log(`✅ [STEP-7] ${mediaType} pronto para envio`)

    } catch (e) {
      const error = `Falha na preparação dos dados: ${e.message}`
      diagnosticResults.errors.push(`Etapa 7 falhou: ${error}`)
      diagnosticResults.steps[6].status = 'failed'
      diagnosticResults.steps[6].error = error
      throw new Error(error)
    }

    // === SUCESSO COMPLETO ===
    diagnosticResults.success = true
    diagnosticResults.summary = {
      status: '✅ TODOS OS TESTES PASSARAM',
      assistantName: assistant.name,
      mediaType,
      librarySize: mediaLibrary.length,
      detectedTrigger,
      matchedItem: mediaItem.trigger,
      base64Valid: true,
      readyToSend: true
    }

    console.log(`🎉 [SUCCESS] Diagnóstico completo bem-sucedido para ${mediaType}!`)

    return new Response(JSON.stringify(diagnosticResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ [ERROR] Falha no diagnóstico:', error.message)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      diagnosticResults
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})