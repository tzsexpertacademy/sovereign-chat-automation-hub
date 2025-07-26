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
    const { encryptedData, mediaUrl, mediaKey, messageId } = await req.json();
    
    console.log('🔧 Requisição:', {
      hasEncryptedData: !!encryptedData,
      hasMediaKey: !!mediaKey,
      hasMediaUrl: !!mediaUrl,
      messageId,
      mediaKeyLength: mediaKey ? atob(mediaKey).length : 0
    });

    if (!mediaKey || (!encryptedData && !mediaUrl)) {
      return new Response(
        JSON.stringify({ success: false, error: 'mediaKey e (encryptedData ou mediaUrl) são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
 * Descriptografia ultra-simplificada do WhatsApp
 */
async function decryptWhatsAppAudio(encryptedBuffer: Uint8Array, mediaKeyBase64: string): Promise<string | null> {
  try {
    const mediaKey = new Uint8Array(atob(mediaKeyBase64).split('').map(c => c.charCodeAt(0)));
    
    console.log('🔐 Derivando chaves...');
    
    // Derivar chave AES (32 bytes) via HMAC-SHA256
    const aesKey = await deriveKey(mediaKey, 'WhatsApp Media Keys', 32);
    
    // Derivar IV (12 bytes) via HMAC-SHA256  
    const iv = await deriveKey(mediaKey, 'WhatsApp Media IVs', 12);
    
    console.log('🔑 Chaves derivadas:', { aesKeyLength: aesKey.length, ivLength: iv.length });

    // Importar chave AES
    const importedKey = await crypto.subtle.importKey(
      'raw',
      aesKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Descriptografar com AES-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      importedKey,
      encryptedBuffer
    );

    const decryptedArray = new Uint8Array(decryptedBuffer);
    const base64Audio = btoa(String.fromCharCode(...decryptedArray));
    
    console.log('✅ Descriptografia bem-sucedida:', decryptedArray.length, 'bytes');
    return base64Audio;

  } catch (error) {
    console.error('❌ Erro na descriptografia:', error);
    return null;
  }
}

/**
 * Derivar chave usando HMAC-SHA256
 */
async function deriveKey(mediaKey: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const infoBytes = new TextEncoder().encode(info);
  
  const importedKey = await crypto.subtle.importKey(
    'raw',
    mediaKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', importedKey, infoBytes);
  return new Uint8Array(signature).slice(0, length);
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