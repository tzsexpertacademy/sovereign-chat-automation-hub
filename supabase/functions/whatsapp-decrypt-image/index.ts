import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { mediaUrl, mediaKey, fileEncSha256, messageId } = requestBody;

    console.log('🖼️ [DECRYPT-IMAGE] Dados recebidos:', {
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
      console.error('❌ [DECRYPT-IMAGE] mediaKey inválido:', { mediaKey: mediaKey?.substring(0, 20) });
      return new Response(JSON.stringify({ 
        error: 'mediaKey é obrigatório e deve ser uma string válida',
        received: typeof mediaKey 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!mediaUrl && !messageId) {
      return new Response(
        JSON.stringify({ success: false, error: 'mediaUrl ou messageId são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar cache primeiro (se messageId foi fornecido)
    if (messageId) {
      console.log('🔍 [DECRYPT-IMAGE] Verificando cache para messageId:', messageId);
      
      const { data: cachedImage } = await supabase
        .from('decrypted_image_cache')
        .select('decrypted_data, image_format')
        .eq('message_id', messageId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cachedImage) {
        console.log('✅ [DECRYPT-IMAGE] Imagem encontrada no cache');
        return new Response(
          JSON.stringify({
            success: true,
            decryptedImage: cachedImage.decrypted_data,
            format: cachedImage.image_format,
            cached: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar dados criptografados
    let encryptedBuffer: Uint8Array;

    if (mediaUrl) {
      console.log('📥 [DECRYPT-IMAGE] Baixando imagem criptografada de URL');
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`Falha ao baixar imagem: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      encryptedBuffer = new Uint8Array(arrayBuffer);
    } else {
      throw new Error('URL da mídia não fornecida');
    }

    console.log('🔓 [DECRYPT-IMAGE] Iniciando descriptografia AES-GCM');

    // Descriptografar imagem
    const decryptedData = await decryptWhatsAppImage(encryptedBuffer, mediaKey);

    if (!decryptedData) {
      throw new Error('Falha na descriptografia da imagem');
    }

    // Detectar formato da imagem
    const imageFormat = detectImageFormat(decryptedData);
    console.log('🎨 [DECRYPT-IMAGE] Formato detectado:', imageFormat);

    // Salvar no cache se messageId foi fornecido
    if (messageId) {
      console.log('💾 [DECRYPT-IMAGE] Salvando no cache');
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Cache por 24 horas

      await supabase
        .from('decrypted_image_cache')
        .upsert({
          message_id: messageId,
          decrypted_data: decryptedData,
          image_format: imageFormat,
          expires_at: expiresAt.toISOString()
        });
    }

    console.log('✅ [DECRYPT-IMAGE] Descriptografia concluída com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        decryptedImage: decryptedData,
        format: imageFormat,
        cached: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [DECRYPT-IMAGE] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});

/**
 * Descriptografa imagem do WhatsApp usando AES-GCM
 */
async function decryptWhatsAppImage(encryptedBuffer: Uint8Array, mediaKeyBase64: string): Promise<string | null> {
  try {
    console.log('🔓 [DECRYPT-IMAGE] Iniciando descriptografia:', {
      encryptedSize: encryptedBuffer.length,
      mediaKeyLength: mediaKeyBase64.length,
      mediaKeyPrefix: mediaKeyBase64.substring(0, 20)
    });

    // Decodificar mediaKey de Base64
    let mediaKey: Uint8Array;
    try {
      const decoded = atob(mediaKeyBase64.trim());
      mediaKey = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
      console.log('🔑 [DECRYPT-IMAGE] MediaKey decodificada:', { 
        length: mediaKey.length,
        firstBytes: Array.from(mediaKey.slice(0, 8))
      });
    } catch (error) {
      console.error('❌ [DECRYPT-IMAGE] Erro decodificando mediaKey:', error);
      throw new Error('Falha ao decodificar mediaKey');
    }

    // Derivar chaves usando HKDF-like com HMAC-SHA256
    const aesKey = await deriveHKDFKey(mediaKey, "WhatsApp Image Keys", 32);
    const iv = await deriveHKDFKey(mediaKey, "WhatsApp Image IV", 16);
    
    console.log('🔑 [DECRYPT-IMAGE] Chaves derivadas:', {
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
    console.log('🔓 [DECRYPT-IMAGE] Iniciando AES-GCM decrypt...');
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      encryptedBuffer
    );

    console.log('✅ [DECRYPT-IMAGE] Descriptografia bem-sucedida:', {
      decryptedSize: decryptedBuffer.byteLength
    });

    // Converter para base64
    const decryptedArray = new Uint8Array(decryptedBuffer);
    const base64String = btoa(String.fromCharCode.apply(null, Array.from(decryptedArray)));
    
    console.log('📦 [DECRYPT-IMAGE] Conversão para base64 concluída:', {
      base64Length: base64String.length,
      base64Prefix: base64String.substring(0, 50)
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ [DECRYPT-IMAGE] Erro na descriptografia:', {
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
    console.error('❌ [DECRYPT-IMAGE] Erro na derivação de chave:', error);
    throw error;
  }
}

/**
 * Detecta formato da imagem pelos magic numbers
 */
function detectImageFormat(base64Image: string): string {
  try {
    if (!base64Image || base64Image.length < 20) {
      return 'jpeg';
    }
    
    // Decodificar primeiros bytes para análise
    const sampleChunk = base64Image.substring(0, 32);
    const decoded = atob(sampleChunk);
    const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
    
    console.log('🔍 [DECRYPT-IMAGE] Analisando header:', 
      Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    );
    
    // JPEG: FF D8 FF
    if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'jpeg';
    }
    
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes.length >= 8 && 
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
        bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
      return 'png';
    }
    
    // GIF: 47 49 46 (GIF)
    if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return 'gif';
    }
    
    // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF...WEBP)
    if (bytes.length >= 12 && 
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'webp';
    }
    
    // BMP: 42 4D (BM)
    if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4D) {
      return 'bmp';
    }
    
    // Fallback para JPEG (mais comum no WhatsApp)
    return 'jpeg';
    
  } catch (error) {
    console.warn('⚠️ [DECRYPT-IMAGE] Erro na detecção de formato:', error);
    return 'jpeg';
  }
}