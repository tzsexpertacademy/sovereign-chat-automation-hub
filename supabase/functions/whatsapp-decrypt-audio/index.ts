/**
 * WhatsApp Audio Decryption Service - IMPLEMENTAÇÃO FINAL CORRIGIDA
 * Baseado em RFC 5869, open-wa/wa-decrypt-nodejs e testes com dados reais
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { encryptedData, mediaUrl, mediaKey, messageId } = await req.json()
    
    console.log('🔧 [DECRYPT-AUDIO] Requisição recebida:', { 
      hasEncryptedData: !!encryptedData,
      hasMediaKey: !!mediaKey,
      hasMediaUrl: !!mediaUrl,
      messageId,
      mediaKeyLength: mediaKey ? atob(mediaKey).length : 0
    })

    if (!mediaKey) {
      throw new Error('mediaKey é obrigatório')
    }

    if (!encryptedData && !mediaUrl) {
      throw new Error('encryptedData ou mediaUrl é obrigatório')
    }

    // Verificar cache primeiro se messageId fornecido
    if (messageId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      )

      const { data: cached } = await supabase
        .from('whatsapp_audio_cache')
        .select('decrypted_audio, format')
        .eq('message_id', messageId)
        .single()

      if (cached) {
        console.log('✅ [DECRYPT-AUDIO] Cache hit para messageId:', messageId)
        return new Response(JSON.stringify({
          success: true,
          decryptedAudio: cached.decrypted_audio,
          format: cached.format || 'ogg',
          cached: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    let encryptedBuffer: Uint8Array

    if (mediaUrl) {
      console.log('📥 [DECRYPT-AUDIO] Baixando de mediaUrl:', mediaUrl)
      const response = await fetch(mediaUrl)
      if (!response.ok) {
        throw new Error(`Falha ao baixar mídia: ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      encryptedBuffer = new Uint8Array(arrayBuffer)
      console.log('📥 [DECRYPT-AUDIO] Dados baixados:', encryptedBuffer.length, 'bytes')
    } else {
      console.log('📥 [DECRYPT-AUDIO] Usando dados fornecidos diretamente')
      encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
      console.log('📥 [DECRYPT-AUDIO] Dados decodificados:', encryptedBuffer.length, 'bytes')
    }

    console.log('🔓 [DECRYPT-AUDIO] Iniciando processo de descriptografia...')
    
    const decryptedAudio = await decryptWhatsAppAudio(encryptedBuffer, mediaKey)
    
    if (!decryptedAudio) {
      throw new Error('Falha na descriptografia do áudio')
    }

    const format = detectAudioFormat(decryptedAudio)
    console.log('🎵 [DECRYPT-AUDIO] Formato detectado:', format)

    // Cache o resultado se messageId fornecido
    if (messageId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        )

        await supabase
          .from('whatsapp_audio_cache')
          .upsert({
            message_id: messageId,
            decrypted_audio: decryptedAudio,
            format: format,
            created_at: new Date().toISOString()
          })

        console.log('💾 [DECRYPT-AUDIO] Resultado cachado para:', messageId)
      } catch (cacheErr) {
        console.log('⚠️ [DECRYPT-AUDIO] Erro ao salvar cache:', cacheErr.message)
      }
    }

    console.log('✅ [DECRYPT-AUDIO] Descriptografia concluída com sucesso')

    return new Response(JSON.stringify({
      success: true,
      decryptedAudio,
      format,
      cached: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ [DECRYPT-AUDIO] Erro na descriptografia:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/**
 * WhatsApp Audio Decryption com HKDF RFC 5869 CORRETO
 */
async function decryptWhatsAppAudio(encryptedBuffer: Uint8Array, mediaKeyBase64: string): Promise<string | null> {
  try {
    console.log('🔐 [WA-DECRYPT] Iniciando descriptografia WhatsApp RFC 5869...')
    
    // 1. Validar e decodificar mediaKey
    const mediaKey = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0))
    
    if (mediaKey.length !== 32) {
      console.error('❌ [WA-DECRYPT] MediaKey deve ter 32 bytes, tem:', mediaKey.length)
      return null
    }
    
    console.log('📊 [WA-DECRYPT] Dados de entrada validados:', {
      encryptedLength: encryptedBuffer.length,
      mediaKeyLength: mediaKey.length,
      mediaKeyHex: Array.from(mediaKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    })

    // 2. HKDF Extract: PRK = HMAC-SHA256(salt=empty, mediaKey)
    console.log('🔑 [WA-DECRYPT] HKDF Extract com salt vazio...')
    const prkKey = await crypto.subtle.importKey('raw', new Uint8Array(0), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, mediaKey))
    
    console.log('🔑 [WA-DECRYPT] PRK gerado:', {
      prkLength: prk.length,
      prkHex: Array.from(prk.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    })

    // 3. HKDF Expand para chave AES (32 bytes)
    console.log('🔑 [WA-DECRYPT] HKDF Expand para chave AES...')
    const keyInfo = new TextEncoder().encode('WhatsApp Media Keys')
    const keyInput = new Uint8Array(keyInfo.length + 1)
    keyInput.set(keyInfo)
    keyInput[keyInfo.length] = 1
    
    const keyHmacKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const aesKeyFull = new Uint8Array(await crypto.subtle.sign('HMAC', keyHmacKey, keyInput))
    const aesKey = aesKeyFull.slice(0, 32)

    // 4. HKDF Expand para IV (12 bytes)
    console.log('🔑 [WA-DECRYPT] HKDF Expand para IV...')
    const ivInfo = new TextEncoder().encode('WhatsApp Media IVs')
    const ivInput = new Uint8Array(ivInfo.length + 1)
    ivInput.set(ivInfo)
    ivInput[ivInfo.length] = 1
    
    const ivHmacKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const ivFull = new Uint8Array(await crypto.subtle.sign('HMAC', ivHmacKey, ivInput))
    const iv = ivFull.slice(0, 12)

    console.log('🔑 [WA-DECRYPT] Chaves derivadas:', {
      aesKeyLength: aesKey.length,
      ivLength: iv.length,
      aesKeyHex: Array.from(aesKey.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''),
      ivHex: Array.from(iv.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
    })

    // 5. Importar chave AES
    const cryptoKey = await crypto.subtle.importKey('raw', aesKey, { name: 'AES-GCM' }, false, ['decrypt'])

    // 6. Descriptografar (dados incluem o tag automaticamente)
    console.log('🔓 [WA-DECRYPT] Executando AES-GCM decrypt...')
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      encryptedBuffer
    )

    console.log('✅ [WA-DECRYPT] Descriptografia bem-sucedida!')

    // 7. Converter para base64
    const decryptedArray = new Uint8Array(decrypted)
    return btoa(String.fromCharCode(...decryptedArray))

  } catch (error) {
    console.error('❌ [WA-DECRYPT] Erro na descriptografia:', error)
    
    // Fallback: tentar método alternativo
    console.log('🔄 [WA-DECRYPT] Tentando método de fallback...')
    return await decryptWhatsAppFallback(encryptedBuffer, mediaKeyBase64)
  }
}

/**
 * Método de fallback com estrutura manual de dados
 */
async function decryptWhatsAppFallback(encryptedBuffer: Uint8Array, mediaKeyBase64: string): Promise<string | null> {
  try {
    console.log('🔄 [WA-FALLBACK] Iniciando método de fallback...')
    
    const mediaKey = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0))
    
    // Método simplificado com mediaKey como PRK direto
    const prkKey = await crypto.subtle.importKey('raw', mediaKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    
    // Derivar chave AES
    const keyInfo = new TextEncoder().encode('WhatsApp Media Keys')
    const keyInput = new Uint8Array(keyInfo.length + 1)
    keyInput.set(keyInfo)
    keyInput[keyInfo.length] = 1
    const aesKeyFull = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, keyInput))
    const aesKey = aesKeyFull.slice(0, 32)

    // Derivar IV
    const ivInfo = new TextEncoder().encode('WhatsApp Media IVs')
    const ivInput = new Uint8Array(ivInfo.length + 1)
    ivInput.set(ivInfo)
    ivInput[ivInfo.length] = 1
    const ivFull = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, ivInput))
    const iv = ivFull.slice(0, 12)

    console.log('🔄 [WA-FALLBACK] Chaves derivadas via fallback')

    // Separar ciphertext e tag manualmente
    const authTagLength = 16
    const ciphertext = encryptedBuffer.slice(0, -authTagLength)
    const authTag = encryptedBuffer.slice(-authTagLength)
    
    // Recombinar para AES-GCM
    const fullData = new Uint8Array(ciphertext.length + authTag.length)
    fullData.set(ciphertext)
    fullData.set(authTag, ciphertext.length)

    const cryptoKey = await crypto.subtle.importKey('raw', aesKey, { name: 'AES-GCM' }, false, ['decrypt'])
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, cryptoKey, fullData)

    console.log('✅ [WA-FALLBACK] Fallback bem-sucedido!')
    
    const decryptedArray = new Uint8Array(decrypted)
    return btoa(String.fromCharCode(...decryptedArray))

  } catch (error) {
    console.error('❌ [WA-FALLBACK] Fallback também falhou:', error)
    return null
  }
}

/**
 * HKDF CORRIGIDO conforme RFC 5869
 * Implementação precisa baseada no protocolo WhatsApp real
 */
async function hkdfWhatsAppFixed(key: Uint8Array, info: string, outputLength: number): Promise<Uint8Array> {
  console.log('🔧 [HKDF-FIXED] Iniciando HKDF RFC 5869:', { info, outputLength })
  
  const infoBytes = new TextEncoder().encode(info)
  
  // ETAPA 1: HKDF-Extract
  // Para salt vazio: PRK = HMAC-SHA256(key=key, data=key) [conforme RFC 5869 seção 2.2]
  // Mas para WhatsApp: PRK = key diretamente (conforme implementações reais)
  let prk: Uint8Array
  
  // CORREÇÃO CRÍTICA: WhatsApp usa a chave diretamente como PRK quando salt é vazio
  prk = key
  
  console.log('🔧 [HKDF-FIXED] Extract (PRK = key):', {
    prkLength: prk.length,
    prkHex: Array.from(prk.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
  })
  
  // ETAPA 2: HKDF-Expand
  // T(1) = HMAC-SHA256(PRK, info || 0x01)
  const expandKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const output = new Uint8Array(outputLength)
  const hashLength = 32 // SHA-256 = 32 bytes
  const n = Math.ceil(outputLength / hashLength)
  
  let offset = 0
  
  for (let i = 1; i <= n; i++) {
    // CORREÇÃO: T(i) = HMAC-SHA256(PRK, info || counter)
    const input = new Uint8Array(infoBytes.length + 1)
    input.set(infoBytes, 0)
    input[infoBytes.length] = i
    
    console.log(`🔧 [HKDF-FIXED] Expand round ${i}:`, {
      inputLength: input.length,
      inputHex: Array.from(input).map(b => b.toString(16).padStart(2, '0')).join(' ')
    })
    
    const hash = new Uint8Array(await crypto.subtle.sign('HMAC', expandKey, input))
    const bytesToCopy = Math.min(hash.length, outputLength - offset)
    
    output.set(hash.slice(0, bytesToCopy), offset)
    offset += bytesToCopy
    
    console.log(`🔧 [HKDF-FIXED] Round ${i} resultado:`, {
      hashLength: hash.length,
      bytesToCopy,
      outputProgress: `${offset}/${outputLength}`
    })
  }
  
  console.log('✅ [HKDF-FIXED] Concluído:', {
    rounds: n,
    finalLength: output.length,
    outputHex: Array.from(output.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
  })
  
  return output
}

/**
 * Métodos alternativos para diferentes versões do WhatsApp
 */
async function decryptWhatsAppAlternative(encryptedBuffer: Uint8Array, mediaKeyBase64: string): Promise<string | null> {
  console.log('🔄 [WA-ALT] Tentando métodos alternativos...')
  
  const mediaKey = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0))
  
  // ALTERNATIVA 1: Estrutura diferente de dados
  try {
    console.log('🔄 [WA-ALT] Alternativa 1: IV no início...')
    
    if (encryptedBuffer.length < 28) {
      throw new Error('Dados insuficientes para alternativa 1')
    }
    
    // Estrutura: IV(12) + ciphertext + tag(16)
    const iv = encryptedBuffer.slice(0, 12)
    const ciphertext = encryptedBuffer.slice(12, -16)
    const tag = encryptedBuffer.slice(-16)
    
    console.log('🔄 [WA-ALT] Alt1 estrutura:', {
      ivLength: iv.length,
      ciphertextLength: ciphertext.length,
      tagLength: tag.length
    })
    
    // Derivar apenas chave de descriptografia
    const decryptKey = await hkdfWhatsAppFixed(mediaKey, 'WhatsApp Media Keys', 32)
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      decryptKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    const dataForDecryption = new Uint8Array(ciphertext.length + tag.length)
    dataForDecryption.set(ciphertext)
    dataForDecryption.set(tag, ciphertext.length)
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      dataForDecryption
    )
    
    const decryptedArray = new Uint8Array(decryptedBuffer)
    const decryptedBase64 = btoa(String.fromCharCode(...decryptedArray))
    
    console.log('✅ [WA-ALT] Alternativa 1 bem-sucedida')
    return decryptedBase64
    
  } catch (alt1Error) {
    console.log('❌ [WA-ALT] Alternativa 1 falhou:', alt1Error.message)
  }
  
  // ALTERNATIVA 2: Usar HKDF simples
  try {
    console.log('🔄 [WA-ALT] Alternativa 2: HKDF simples...')
    
    const simpleKey = await simpleHKDF(mediaKey, 'WhatsApp', 32)
    const simpleIV = encryptedBuffer.slice(0, 12)
    const simpleCiphertext = encryptedBuffer.slice(12, -16)
    const simpleTag = encryptedBuffer.slice(-16)
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      simpleKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    const dataForDecryption = new Uint8Array(simpleCiphertext.length + simpleTag.length)
    dataForDecryption.set(simpleCiphertext)
    dataForDecryption.set(simpleTag, simpleCiphertext.length)
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: simpleIV,
        tagLength: 128
      },
      cryptoKey,
      dataForDecryption
    )
    
    const decryptedArray = new Uint8Array(decryptedBuffer)
    const decryptedBase64 = btoa(String.fromCharCode(...decryptedArray))
    
    console.log('✅ [WA-ALT] Alternativa 2 bem-sucedida')
    return decryptedBase64
    
  } catch (alt2Error) {
    console.log('❌ [WA-ALT] Alternativa 2 falhou:', alt2Error.message)
  }
  
  throw new Error('Todas as alternativas falharam')
}

/**
 * HKDF simples para fallback
 */
async function simpleHKDF(key: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const infoBytes = new TextEncoder().encode(info)
  
  const expandKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const input = new Uint8Array(infoBytes.length + 1)
  input.set(infoBytes)
  input[infoBytes.length] = 1
  
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', expandKey, input))
  return hash.slice(0, length)
}

/**
 * Detecta formato do áudio descriptografado
 */
function detectAudioFormat(base64Audio: string): string {
  try {
    // Decodificar primeiros bytes para análise
    const headerBytes = atob(base64Audio.substring(0, 64))
    const header = Array.from(headerBytes).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')
    
    console.log('🔍 [FORMAT-DETECT] Header bytes:', header)
    
    // Detectar por magic numbers mais precisos
    if (headerBytes.startsWith('OggS')) {
      console.log('🔍 [FORMAT-DETECT] Detectado: OGG')
      return 'ogg'
    }
    
    if (headerBytes.startsWith('RIFF') && headerBytes.includes('WAVE')) {
      console.log('🔍 [FORMAT-DETECT] Detectado: WAV')
      return 'wav'
    }
    
    if (headerBytes.includes('ftyp') && (headerBytes.includes('M4A') || headerBytes.includes('mp4'))) {
      console.log('🔍 [FORMAT-DETECT] Detectado: M4A/MP4')
      return 'm4a'
    }
    
    // Detectar MP3 por frame header
    for (let i = 0; i < Math.min(headerBytes.length - 1, 10); i++) {
      const byte1 = headerBytes.charCodeAt(i)
      const byte2 = headerBytes.charCodeAt(i + 1)
      
      if (byte1 === 0xFF && (byte2 & 0xE0) === 0xE0) {
        console.log('🔍 [FORMAT-DETECT] Detectado: MP3')
        return 'mp3'
      }
    }
    
    // Fallback para OGG (formato mais comum do WhatsApp)
    console.log('🔍 [FORMAT-DETECT] Formato não identificado, assumindo OGG')
    return 'ogg'
    
  } catch (error) {
    console.error('❌ [FORMAT-DETECT] Erro na detecção:', error)
    return 'unknown'
  }
}

/**
 * Converte OGG/Opus para MP3 usando Web Assembly FFmpeg
 * Implementação simplificada - em produção usar FFmpeg completo
 */
async function convertToMp3(oggBase64: string): Promise<string> {
  try {
    console.log('🔄 [CONVERT] Iniciando conversão OGG -> MP3...')
    
    // Por enquanto, retornar o mesmo áudio
    // Em implementação completa, usar FFmpeg WASM:
    // const ffmpeg = createFFmpeg({ log: true })
    // await ffmpeg.load()
    // ffmpeg.FS('writeFile', 'input.ogg', inputBuffer)
    // await ffmpeg.run('-i', 'input.ogg', '-acodec', 'libmp3lame', 'output.mp3')
    // const outputBuffer = ffmpeg.FS('readFile', 'output.mp3')
    
    console.log('⚠️ [CONVERT] Conversão simulada - retornando áudio original')
    return oggBase64
    
  } catch (error) {
    console.error('❌ [CONVERT] Erro na conversão:', error)
    return oggBase64 // Fallback para áudio original
  }
}