import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { messageId, mediaUrl, mediaKey, fileEncSha256 } = requestBody;

    console.log('🎥 [DECRYPT-VIDEO] Dados recebidos:', {
      messageId,
      hasMediaUrl: !!mediaUrl,
      hasMediaKey: !!mediaKey,
      mediaKeyLength: mediaKey ? mediaKey.length : 0,
      mediaKeyPreview: mediaKey ? mediaKey.substring(0, 20) + '...' : 'null',
      mediaUrlPreview: mediaUrl ? mediaUrl.substring(0, 100) + '...' : null,
      requestKeys: Object.keys(requestBody)
    });

    // Validação mais flexível
    if (!mediaKey || typeof mediaKey !== 'string' || mediaKey.trim() === '') {
      console.error('❌ [DECRYPT-VIDEO] mediaKey inválido:', { mediaKey: mediaKey?.substring(0, 20) });
      return new Response(JSON.stringify({ 
        error: 'mediaKey é obrigatório e deve ser uma string válida',
        received: typeof mediaKey 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first
    if (messageId) {
      console.log('🔍 [DECRYPT-VIDEO] Verificando cache para messageId:', messageId);
      
      const { data: cached } = await supabase
        .rpc('get_decrypted_video', { p_message_id: messageId });
      
      if (cached && cached.length > 0) {
        console.log('📹 [DECRYPT-VIDEO] Vídeo encontrado no cache');
        return new Response(JSON.stringify({
          decryptedData: cached[0].decrypted_data,
          videoFormat: cached[0].video_format
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    let encryptedBuffer: Uint8Array;

    // Get encrypted data from URL if not provided
    if (mediaUrl) {
      console.log('📥 [DECRYPT-VIDEO] Baixando vídeo criptografado de URL');
      const mediaResponse = await fetch(mediaUrl);
      if (!mediaResponse.ok) {
        throw new Error(`Falha ao baixar mídia: ${mediaResponse.statusText}`);
      }
      encryptedBuffer = new Uint8Array(await mediaResponse.arrayBuffer());
    } else {
      throw new Error('mediaUrl é obrigatório');
    }

    console.log('🔐 [DECRYPT-VIDEO] Processando descriptografia:', {
      encryptedSize: encryptedBuffer.length,
      mediaKeyLength: mediaKey.length
    });

    // Decrypt the video
    console.log('🔓 [DECRYPT-VIDEO] Iniciando descriptografia AES-GCM');
    const decryptedData = await decryptWhatsAppVideo(encryptedBuffer, mediaKey);
    
    if (!decryptedData) {
      throw new Error('Falha na descriptografia do vídeo');
    }

    // Detect video format
    const videoFormat = detectVideoFormat(decryptedData);
    console.log('🔍 [DECRYPT-VIDEO] Formato detectado:', videoFormat);

    // Cache the result if messageId is provided
    if (messageId) {
      console.log('💾 [DECRYPT-VIDEO] Salvando no cache');
      await supabase.from('decrypted_video_cache').upsert({
        message_id: messageId,
        decrypted_data: decryptedData,
        video_format: videoFormat,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
      });
    }

    console.log('✅ [DECRYPT-VIDEO] Descriptografia concluída com sucesso');
    
    return new Response(JSON.stringify({
      decryptedData,
      videoFormat
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [DECRYPT-VIDEO] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Descriptografa vídeo do WhatsApp usando AES-GCM
 */
async function decryptWhatsAppVideo(encryptedBuffer: Uint8Array, mediaKeyBase64: string): Promise<string | null> {
  try {
    console.log('🔓 [DECRYPT-VIDEO] Iniciando descriptografia:', {
      encryptedSize: encryptedBuffer.length,
      mediaKeyLength: mediaKeyBase64.length,
      mediaKeyPrefix: mediaKeyBase64.substring(0, 20)
    });

    // Decodificar mediaKey de Base64
    let mediaKey: Uint8Array;
    try {
      const decoded = atob(mediaKeyBase64.trim());
      mediaKey = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
      console.log('🔑 [DECRYPT-VIDEO] MediaKey decodificada:', { 
        length: mediaKey.length,
        firstBytes: Array.from(mediaKey.slice(0, 8))
      });
    } catch (error) {
      console.error('❌ [DECRYPT-VIDEO] Erro decodificando mediaKey:', error);
      throw new Error('Falha ao decodificar mediaKey');
    }

    // Derivar chaves usando HKDF-like com HMAC-SHA256
    const aesKey = await deriveHKDFKey(mediaKey, "WhatsApp Video Keys", 32);
    const iv = await deriveHKDFKey(mediaKey, "WhatsApp Video IV", 16);
    
    console.log('🔑 [DECRYPT-VIDEO] Chaves derivadas:', {
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

    // Verificar se há dados suficientes para AES-GCM
    if (encryptedBuffer.length < 16) {
      throw new Error(`Buffer muito pequeno para AES-GCM: ${encryptedBuffer.length} bytes`);
    }

    // Descriptografar usando AES-GCM
    console.log('🔓 [DECRYPT-VIDEO] Iniciando AES-GCM decrypt...');
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      encryptedBuffer
    );

    console.log('✅ [DECRYPT-VIDEO] Descriptografia bem-sucedida:', {
      decryptedSize: decryptedBuffer.byteLength
    });

    // Converter para base64
    const decryptedArray = new Uint8Array(decryptedBuffer);
    const base64String = btoa(String.fromCharCode.apply(null, Array.from(decryptedArray)));
    
    console.log('📦 [DECRYPT-VIDEO] Conversão para base64 concluída:', {
      base64Length: base64String.length,
      base64Prefix: base64String.substring(0, 50)
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ [DECRYPT-VIDEO] Erro na descriptografia:', {
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name
    });
    return null;
  }
}

/**
 * Função auxiliar para derivar chaves usando HKDF-like com HMAC-SHA256
 */
async function deriveHKDFKey(mediaKey: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  try {
    const encoder = new TextEncoder();
    const infoBytes = encoder.encode(info);
    
    // HKDF Extract: HMAC-SHA256(salt=0, ikm=mediaKey)
    const salt = new Uint8Array(32);
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
    console.error('❌ [DECRYPT-VIDEO] Erro na derivação de chave:', error);
    throw error;
  }
}

/**
 * Detecta o formato do vídeo baseado nos primeiros bytes
 */
function detectVideoFormat(base64Video: string): string {
  try {
    const binaryString = atob(base64Video.substring(0, 100)); // Primeiros bytes
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Verificar assinaturas de formato de vídeo
    const header = Array.from(bytes.slice(0, 20))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('🔍 [DECRYPT-VIDEO] Header do vídeo:', header.substring(0, 32));

    // MP4 (starts with ftyp box)
    if (header.includes('66747970') || header.includes('6d646174')) {
      return 'mp4';
    }
    
    // WebM (EBML header)
    if (header.startsWith('1a45dfa3')) {
      return 'webm';
    }
    
    // AVI (RIFF header)
    if (header.startsWith('52494646') && header.includes('41564920')) {
      return 'avi';
    }
    
    // MOV/QuickTime (starts with free or mdat)
    if (header.includes('6d6f6f76') || header.includes('66726565')) {
      return 'mov';
    }
    
    // 3GP
    if (header.includes('33677035') || header.includes('33677036')) {
      return '3gp';
    }

    console.log('⚠️ [DECRYPT-VIDEO] Formato não reconhecido, assumindo MP4');
    return 'mp4';
  } catch (error) {
    console.error('❌ [DECRYPT-VIDEO] Erro ao detectar formato:', error);
    return 'mp4';
  }
}