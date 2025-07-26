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
 */
async function decryptWhatsAppAudio(encryptedBase64: string, mediaKeyBase64: string): Promise<string | null> {
  try {
    console.log('🔐 [AES-DECRYPT] Iniciando descriptografia AES-GCM...')
    
    // Decodificar dados
    const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
    const mediaKey = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0))
    
    console.log('📊 [AES-DECRYPT] Dados decodificados:', {
      encryptedDataLength: encryptedData.length,
      mediaKeyLength: mediaKey.length
    })

    // Derivar chave usando HKDF
    const derivedKey = await deriveKey(mediaKey, 'WhatsApp Audio Keys', 32)
    const iv = encryptedData.slice(0, 12) // Primeiros 12 bytes como IV
    const ciphertext = encryptedData.slice(12, -16) // Dados criptografados
    const tag = encryptedData.slice(-16) // Últimos 16 bytes como tag de autenticação

    console.log('🔑 [AES-DECRYPT] Componentes extraídos:', {
      derivedKeyLength: derivedKey.length,
      ivLength: iv.length,
      ciphertextLength: ciphertext.length,
      tagLength: tag.length
    })

    // Importar chave para WebCrypto
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      derivedKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )

    // Descriptografar usando AES-GCM - método correto para WhatsApp
    const dataToDecrypt = new Uint8Array(ciphertext.length + tag.length);
    dataToDecrypt.set(ciphertext);
    dataToDecrypt.set(tag, ciphertext.length);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      dataToDecrypt
    )

    // Converter para base64
    const decryptedArray = new Uint8Array(decryptedBuffer)
    const decryptedBase64 = btoa(String.fromCharCode(...decryptedArray))
    
    console.log('✅ [AES-DECRYPT] Descriptografia concluída:', {
      decryptedLength: decryptedArray.length,
      base64Length: decryptedBase64.length
    })

    return decryptedBase64

  } catch (error) {
    console.error('❌ [AES-DECRYPT] Erro na descriptografia:', error)
    return null
  }
}

/**
 * Deriva chave usando HKDF (HMAC-based Key Derivation Function)
 */
async function deriveKey(key: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  
  // Importar chave para HMAC
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Extract (HKDF-Extract)
  const prk = await crypto.subtle.sign('HMAC', hmacKey, new Uint8Array(32))

  // Expand (HKDF-Expand)
  const prkArray = new Uint8Array(prk)
  const infoBytes = encoder.encode(info)
  const expandInput = new Uint8Array(infoBytes.length + 1)
  expandInput.set(infoBytes)
  expandInput[infoBytes.length] = 1

  const expandKey = await crypto.subtle.importKey(
    'raw',
    prkArray,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const expanded = await crypto.subtle.sign('HMAC', expandKey, expandInput)
  return new Uint8Array(expanded).slice(0, length)
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