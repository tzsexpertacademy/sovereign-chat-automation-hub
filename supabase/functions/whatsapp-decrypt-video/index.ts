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
    const { messageId, mediaUrl, mediaKey, fileEncSha256 } = await req.json();

    console.log('🎥 [DECRYPT-VIDEO] Iniciando descriptografia:', {
      messageId,
      hasMediaUrl: !!mediaUrl,
      hasMediaKey: !!mediaKey,
      mediaUrlPreview: mediaUrl ? mediaUrl.substring(0, 100) + '...' : null
    });

    if (!mediaKey) {
      return new Response(JSON.stringify({ error: 'mediaKey é obrigatório' }), {
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
    const mediaKey = new Uint8Array(atob(mediaKeyBase64).split('').map(c => c.charCodeAt(0)));
    
    // Derivar chaves AES e IV usando HMAC-SHA256
    const aesKey = await deriveKey(mediaKey, "WhatsApp Video Keys", 32);
    const iv = await deriveKey(mediaKey, "WhatsApp Video IV", 16);
    
    console.log('🔑 [DECRYPT-VIDEO] Chaves derivadas:', {
      aesKeyLength: aesKey.length,
      ivLength: iv.length
    });

    // Importar chave AES
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      aesKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Descriptografar usando AES-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      cryptoKey,
      encryptedBuffer
    );

    // Converter para base64
    const decryptedArray = new Uint8Array(decryptedBuffer);
    const base64String = btoa(String.fromCharCode(...decryptedArray));
    
    return base64String;
  } catch (error) {
    console.error('❌ [DECRYPT-VIDEO] Erro na descriptografia:', error);
    return null;
  }
}

/**
 * Função auxiliar para derivar chaves usando HMAC-SHA256
 */
async function deriveKey(mediaKey: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const infoBytes = encoder.encode(info);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    mediaKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, infoBytes);
  return new Uint8Array(signature.slice(0, length));
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