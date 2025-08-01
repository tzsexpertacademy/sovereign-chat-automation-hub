import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { encryptedData, mediaUrl, mediaKey, messageId } = requestBody;
    
    console.log('🎵 [DECRYPT-AUDIO] Dados recebidos:', {
      messageId,
      hasEncryptedData: !!encryptedData,
      hasMediaUrl: !!mediaUrl,
      hasMediaKey: !!mediaKey,
      mediaKeyLength: mediaKey ? mediaKey.length : 0,
      mediaKeyPreview: mediaKey ? mediaKey.substring(0, 20) + '...' : 'null',
      requestKeys: Object.keys(requestBody)
    });

    // Validação mais flexível
    if (!mediaKey || typeof mediaKey !== 'string' || mediaKey.trim() === '') {
      console.error('❌ [DECRYPT-AUDIO] mediaKey inválido:', { mediaKey: mediaKey?.substring(0, 20) });
      return new Response(JSON.stringify({ 
        error: 'mediaKey é obrigatório e deve ser uma string válida',
        received: typeof mediaKey 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!encryptedData && !mediaUrl) {
      console.error('❌ [DECRYPT-AUDIO] Nem encryptedData nem mediaUrl fornecidos');
      return new Response(JSON.stringify({ 
        error: 'encryptedData ou mediaUrl é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar cache
    if (messageId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: cached } = await supabase
        .from('decrypted_audio_cache')
        .select('decrypted_data, audio_format')
        .eq('message_id', messageId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cached) {
        return new Response(
          JSON.stringify({
            success: true,
            decryptedAudio: cached.decrypted_data,
            format: cached.audio_format,
            cached: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Obter dados criptografados
    let encryptedBuffer: Uint8Array;
    if (encryptedData) {
      encryptedBuffer = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
    } else {
      const response = await fetch(mediaUrl);
      encryptedBuffer = new Uint8Array(await response.arrayBuffer());
    }

    console.log('📊 Dados:', { encryptedLength: encryptedBuffer.length });

    // Descriptografar
    const decryptedAudio = await decryptWhatsAppAudio(encryptedBuffer, mediaKey);
    
    if (!decryptedAudio) {
      return new Response(
        JSON.stringify({ success: false, error: 'Falha na descriptografia' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const format = detectAudioFormat(decryptedAudio);

    // Cachear resultado
    if (messageId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabase.from('decrypted_audio_cache').upsert({
        message_id: messageId,
        decrypted_data: decryptedAudio,
        audio_format: format,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    }

    return new Response(
      JSON.stringify({ success: true, decryptedAudio, format, cached: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Descriptografia WhatsApp com estrutura correta [ciphertext + tag] e IV derivado
 */
async function decryptWhatsAppAudio(encryptedBuffer: Uint8Array, mediaKeyBase64: string): Promise<string | null> {
  try {
    console.log('🔓 [DECRYPT-AUDIO] Iniciando descriptografia:', {
      encryptedSize: encryptedBuffer.length,
      mediaKeyLength: mediaKeyBase64.length,
      mediaKeyPrefix: mediaKeyBase64.substring(0, 20)
    });

    // Decodificar mediaKey de Base64
    let mediaKey: Uint8Array;
    try {
      const decoded = atob(mediaKeyBase64.trim());
      mediaKey = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
      console.log('🔑 [DECRYPT-AUDIO] MediaKey decodificada:', { 
        length: mediaKey.length,
        firstBytes: Array.from(mediaKey.slice(0, 8))
      });
    } catch (error) {
      console.error('❌ [DECRYPT-AUDIO] Erro decodificando mediaKey:', error);
      throw new Error('Falha ao decodificar mediaKey');
    }

    // Derivar chaves usando HKDF-like com HMAC-SHA256
    const aesKey = await deriveHKDFKey(mediaKey, "WhatsApp Audio Keys", 32);
    const iv = await deriveHKDFKey(mediaKey, "WhatsApp Audio IV", 16);
    
    console.log('🔑 [DECRYPT-AUDIO] Chaves derivadas:', {
      aesKeyLength: aesKey.length,
      ivLength: iv.length,
      aesKeyPrefix: Array.from(aesKey.slice(0, 8)),
      ivPrefix: Array.from(iv.slice(0, 8))
    });

    // Importar chave AES para descriptografia
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      aesKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Verificar se há dados suficientes para AES-GCM (mínimo 16 bytes de tag)
    if (encryptedBuffer.length < 16) {
      throw new Error(`Buffer muito pequeno para AES-GCM: ${encryptedBuffer.length} bytes`);
    }

    // Descriptografar usando AES-GCM
    console.log('🔓 [DECRYPT-AUDIO] Iniciando AES-GCM decrypt...');
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128 // 16 bytes
      },
      cryptoKey,
      encryptedBuffer
    );

    console.log('✅ [DECRYPT-AUDIO] Descriptografia bem-sucedida:', {
      decryptedSize: decryptedBuffer.byteLength
    });

    // Converter para base64
    const decryptedArray = new Uint8Array(decryptedBuffer);
    const base64String = btoa(String.fromCharCode.apply(null, Array.from(decryptedArray)));
    
    console.log('📦 [DECRYPT-AUDIO] Conversão para base64 concluída:', {
      base64Length: base64String.length,
      base64Prefix: base64String.substring(0, 50)
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ [DECRYPT-AUDIO] Erro na descriptografia:', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name
    });
    return null;
  }
}

/**
 * Função auxiliar para derivar chaves usando HKDF-like com HMAC-SHA256
 * Implementação mais robusta para WhatsApp
 */
async function deriveHKDFKey(mediaKey: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  try {
    const encoder = new TextEncoder();
    const infoBytes = encoder.encode(info);
    
    // HKDF Extract: HMAC-SHA256(salt=0, ikm=mediaKey)
    const salt = new Uint8Array(32); // 32 zeros para SHA-256
    const extractKey = await crypto.subtle.importKey(
      "raw",
      salt,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const prk = await crypto.subtle.sign("HMAC", extractKey, mediaKey);
    
    // HKDF Expand: HMAC-SHA256(prk, info + 0x01)
    const expandKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(prk),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const expandInput = new Uint8Array(infoBytes.length + 1);
    expandInput.set(infoBytes);
    expandInput[infoBytes.length] = 0x01;
    
    const okm = await crypto.subtle.sign("HMAC", expandKey, expandInput);
    return new Uint8Array(okm.slice(0, length));
  } catch (error) {
    console.error('❌ [DECRYPT-AUDIO] Erro na derivação de chave:', error);
    throw error;
  }
}

/**
 * Detectar formato de áudio pelos primeiros bytes
 */
function detectAudioFormat(base64Audio: string): string {
  try {
    const binaryString = atob(base64Audio.substring(0, 100));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    if (bytes.length >= 4) {
      // OGG: "OggS"
      if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
        return 'ogg';
      }
      // WAV: "RIFF"
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        return 'wav';
      }
      // MP3: Frame header
      if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
        return 'mp3';
      }
    }
    
    return 'ogg'; // Padrão WhatsApp
  } catch {
    return 'ogg';
  }
}