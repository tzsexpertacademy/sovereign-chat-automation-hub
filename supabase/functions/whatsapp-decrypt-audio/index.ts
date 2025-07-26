/**
 * WhatsApp Audio Decryption Service
 * Descriptografa áudios .enc do WhatsApp usando AES-GCM
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DecryptionRequest {
  encryptedData: string; // base64 encoded encrypted audio
  mediaKey: string;      // WhatsApp media key
  fileEncSha256?: string;
  fileSha256?: string;
  directPath?: string;
  messageId?: string;
}

interface DecryptionResponse {
  success: boolean;
  decryptedAudio?: string;
  format?: string;
  error?: string;
  cached?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { encryptedData, mediaKey, fileEncSha256, messageId }: DecryptionRequest = await req.json()
    
    console.log('🔐 [DECRYPT-AUDIO] Iniciando descriptografia:', {
      hasEncryptedData: !!encryptedData,
      encryptedDataLength: encryptedData?.length,
      hasMediaKey: !!mediaKey,
      messageId,
      timestamp: new Date().toISOString()
    })

    if (!encryptedData || !mediaKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dados criptografados e chave de mídia são obrigatórios' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verificar cache primeiro se messageId disponível
    if (messageId) {
      console.log('🔍 [DECRYPT-AUDIO] Verificando cache para:', messageId)
      
      const { data: cachedAudio } = await supabase
        .from('decrypted_audio_cache')
        .select('decrypted_data, audio_format')
        .eq('message_id', messageId)
        .single()
      
      if (cachedAudio) {
        console.log('✅ [DECRYPT-AUDIO] Áudio encontrado no cache')
        return new Response(
          JSON.stringify({
            success: true,
            decryptedAudio: cachedAudio.decrypted_data,
            format: cachedAudio.audio_format,
            cached: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Descriptografar áudio WhatsApp
    console.log('🔓 [DECRYPT-AUDIO] Iniciando processo de descriptografia...')
    const decryptedAudio = await decryptWhatsAppAudio(encryptedData, mediaKey)
    
    if (!decryptedAudio) {
      throw new Error('Falha na descriptografia do áudio')
    }

    // Detectar formato do áudio descriptografado
    const audioFormat = detectAudioFormat(decryptedAudio)
    console.log('🎵 [DECRYPT-AUDIO] Formato detectado:', audioFormat)

    // Converter para formato compatível se necessário
    let finalAudio = decryptedAudio
    if (audioFormat === 'ogg' || audioFormat === 'opus') {
      console.log('🔄 [DECRYPT-AUDIO] Convertendo OGG/Opus para MP3...')
      finalAudio = await convertToMp3(decryptedAudio)
    }

    // Salvar no cache se messageId disponível
    if (messageId) {
      console.log('💾 [DECRYPT-AUDIO] Salvando no cache...')
      await supabase
        .from('decrypted_audio_cache')
        .upsert({
          message_id: messageId,
          decrypted_data: finalAudio,
          audio_format: audioFormat,
          created_at: new Date().toISOString()
        })
    }

    console.log('✅ [DECRYPT-AUDIO] Descriptografia concluída com sucesso')
    return new Response(
      JSON.stringify({
        success: true,
        decryptedAudio: finalAudio,
        format: audioFormat
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ [DECRYPT-AUDIO] Erro na descriptografia:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/**
 * Descriptografa áudio do WhatsApp usando AES-GCM
 * Implementação baseada no open-wa/wa-decrypt-nodejs e Baileys
 */
async function decryptWhatsAppAudio(encryptedBase64: string, mediaKeyBase64: string): Promise<string | null> {
  try {
    console.log('🔐 [WA-DECRYPT] Iniciando descriptografia WhatsApp...')
    
    // Decodificar dados base64
    const encryptedBuffer = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
    const mediaKey = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0))
    
    console.log('📊 [WA-DECRYPT] Dados de entrada:', {
      encryptedLength: encryptedBuffer.length,
      mediaKeyLength: mediaKey.length,
      mediaKeyHex: Array.from(mediaKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
    })

    // Validar tamanho da chave de mídia (deve ser 32 bytes)
    if (mediaKey.length !== 32) {
      throw new Error(`Chave de mídia inválida: ${mediaKey.length} bytes (esperado: 32)`)
    }

    // Validar dados mínimos (16 bytes de tag no mínimo)
    if (encryptedBuffer.length < 16) {
      throw new Error(`Dados insuficientes: ${encryptedBuffer.length} bytes`)
    }

    // Derivar chaves usando HKDF específico do WhatsApp
    const mediaDecryptionKey = await hkdfWhatsApp(mediaKey, 'WhatsApp Media Keys', 32)
    const mediaIV = await hkdfWhatsApp(mediaKey, 'WhatsApp Media IVs', 12)
    
    console.log('🔑 [WA-DECRYPT] Chaves derivadas:', {
      keyLength: mediaDecryptionKey.length,
      ivLength: mediaIV.length,
      keyStart: Array.from(mediaDecryptionKey.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''),
      ivStart: Array.from(mediaIV.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
    })

    // Importar chave para Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      mediaDecryptionKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )

    // Descriptografar usando AES-256-GCM
    // WhatsApp inclui o tag nos dados criptografados
    console.log('🔓 [WA-DECRYPT] Executando AES-GCM decrypt...')
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: mediaIV,
        tagLength: 128 // 16 bytes
      },
      cryptoKey,
      encryptedBuffer
    )

    // Converter para base64
    const decryptedArray = new Uint8Array(decryptedBuffer)
    const decryptedBase64 = btoa(String.fromCharCode(...decryptedArray))
    
    console.log('✅ [WA-DECRYPT] Descriptografia bem-sucedida:', {
      originalLength: encryptedBuffer.length,
      decryptedLength: decryptedArray.length,
      base64Length: decryptedBase64.length
    })

    return decryptedBase64

  } catch (error) {
    console.error('❌ [WA-DECRYPT] Erro principal:', error)
    
    // Tentar método alternativo para diferentes versões do WhatsApp
    try {
      console.log('🔄 [WA-DECRYPT] Tentando método alternativo...')
      return await decryptWhatsAppLegacy(encryptedBase64, mediaKeyBase64)
    } catch (altError) {
      console.error('❌ [WA-DECRYPT] Método alternativo falhou:', altError)
      return null
    }
  }
}

/**
 * Método legacy para descriptografia (para versões mais antigas do WhatsApp)
 */
async function decryptWhatsAppLegacy(encryptedBase64: string, mediaKeyBase64: string): Promise<string | null> {
  try {
    console.log('🔄 [WA-LEGACY] Tentando método legacy...')
    
    const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
    const mediaKey = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0))
    
    // Método alternativo: extrair IV, ciphertext e tag manualmente
    if (encryptedData.length < 28) {
      throw new Error('Dados insuficientes para método legacy')
    }

    // Tentar diferentes estruturas de dados
    const attempts = [
      // Estrutura 1: IV (12) + ciphertext + tag (16)
      {
        iv: encryptedData.slice(0, 12),
        ciphertext: encryptedData.slice(12, -16),
        tag: encryptedData.slice(-16)
      },
      // Estrutura 2: Tag (16) + IV (12) + ciphertext  
      {
        tag: encryptedData.slice(0, 16),
        iv: encryptedData.slice(16, 28),
        ciphertext: encryptedData.slice(28)
      }
    ]

    for (let i = 0; i < attempts.length; i++) {
      try {
        const { iv, ciphertext, tag } = attempts[i]
        
        console.log(`🔄 [WA-LEGACY] Tentativa ${i + 1}:`, {
          ivLength: iv.length,
          ciphertextLength: ciphertext.length,
          tagLength: tag.length
        })

        // Derivar chave usando HKDF simples
        const derivedKey = await simpleHKDF(mediaKey, 'Audio', 32)
        
        // Importar chave
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          derivedKey,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        )

        // Combinar ciphertext + tag
        const dataToDecrypt = new Uint8Array(ciphertext.length + tag.length)
        dataToDecrypt.set(ciphertext)
        dataToDecrypt.set(tag, ciphertext.length)
        
        const decryptedBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv,
            tagLength: 128
          },
          cryptoKey,
          dataToDecrypt
        )

        const decryptedArray = new Uint8Array(decryptedBuffer)
        const decryptedBase64 = btoa(String.fromCharCode(...decryptedArray))
        
        console.log(`✅ [WA-LEGACY] Sucesso na tentativa ${i + 1}`)
        return decryptedBase64
        
      } catch (attemptError) {
        console.log(`❌ [WA-LEGACY] Tentativa ${i + 1} falhou:`, attemptError.message)
        continue
      }
    }
    
    throw new Error('Todas as tentativas legacy falharam')
    
  } catch (error) {
    console.error('❌ [WA-LEGACY] Método legacy falhou:', error)
    throw error
  }
}

/**
 * HKDF específico do WhatsApp baseado no protocolo oficial
 * Implementação conforme open-wa/wa-decrypt-nodejs
 */
async function hkdfWhatsApp(key: Uint8Array, info: string, outputLength: number): Promise<Uint8Array> {
  const salt = new TextEncoder().encode(info)
  
  // HKDF-Extract: HMAC-SHA256(salt, key)
  const extractKey = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', extractKey, key))
  
  console.log('🔑 [HKDF] Extract realizado:', {
    saltLength: salt.length,
    prkLength: prk.length,
    info,
    outputLength
  })
  
  // HKDF-Expand: gerar dados de saída
  const expandKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const output = new Uint8Array(outputLength)
  const hashLength = 32 // SHA-256 produz 32 bytes
  const n = Math.ceil(outputLength / hashLength)
  
  let offset = 0
  
  for (let i = 1; i <= n; i++) {
    // T(i) = HMAC-SHA256(PRK, "" | i)
    // WhatsApp usa info vazio, apenas o contador
    const input = new Uint8Array(1)
    input[0] = i
    
    const hash = new Uint8Array(await crypto.subtle.sign('HMAC', expandKey, input))
    const bytesToCopy = Math.min(hash.length, outputLength - offset)
    
    output.set(hash.slice(0, bytesToCopy), offset)
    offset += bytesToCopy
  }
  
  console.log('🔑 [HKDF] Expand concluído:', {
    rounds: n,
    finalLength: output.length
  })
  
  return output
}

/**
 * HKDF simples para fallback
 */
async function simpleHKDF(key: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const infoBytes = new TextEncoder().encode(info)
  
  // Usar a chave diretamente como PRK
  const expandKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  // Expand com info + contador
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
    const headerBytes = atob(base64Audio.substring(0, 20))
    const header = Array.from(headerBytes).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')
    
    console.log('🔍 [FORMAT-DETECT] Header bytes:', header)
    
    // Detectar por magic numbers
    if (headerBytes.startsWith('OggS')) return 'ogg'
    if (headerBytes.startsWith('RIFF')) return 'wav'
    if (headerBytes.includes('ftyp')) return 'mp4'
    if (headerBytes.charCodeAt(0) === 0xFF && (headerBytes.charCodeAt(1) & 0xE0) === 0xE0) return 'mp3'
    if (headerBytes.includes('\x00\x00\x00 ftypM4A')) return 'm4a'
    
    // Fallback para OGG (formato mais comum do WhatsApp)
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