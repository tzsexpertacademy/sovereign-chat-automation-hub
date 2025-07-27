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
    const { mediaUrl, mediaKey, fileEncSha256, messageId } = await req.json();

    console.log('🖼️ [DECRYPT-IMAGE] Iniciando descriptografia:', {
      messageId,
      hasMediaUrl: !!mediaUrl,
      hasMediaKey: !!mediaKey,
      mediaUrlPreview: mediaUrl?.substring(0, 100) + '...'
    });

    // Validar parâmetros obrigatórios
    if (!mediaKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'mediaKey é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
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
    console.log('🔐 [DECRYPT-IMAGE] Processando descriptografia:', {
      encryptedSize: encryptedBuffer.length,
      mediaKeyLength: mediaKeyBase64.length
    });

    // Decodificar chave base64
    const mediaKey = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0));
    
    // Derivar chaves AES e IV usando HMAC-SHA256
    const aesKey = await deriveKey(mediaKey, 'WhatsApp Image Keys', 32);
    const iv = await deriveKey(mediaKey, 'WhatsApp Image IVs', 16);

    console.log('🔑 [DECRYPT-IMAGE] Chaves derivadas:', {
      aesKeyLength: aesKey.length,
      ivLength: iv.length
    });

    // Importar chave AES
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      aesKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Descriptografar usando AES-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      encryptedBuffer
    );

    // Converter para base64
    const decryptedArray = new Uint8Array(decryptedBuffer);
    const base64String = btoa(String.fromCharCode(...decryptedArray));

    console.log('✅ [DECRYPT-IMAGE] Descriptografia concluída:', {
      decryptedSize: decryptedArray.length,
      base64Length: base64String.length
    });

    return base64String;

  } catch (error) {
    console.error('❌ [DECRYPT-IMAGE] Erro na descriptografia:', error);
    return null;
  }
}

/**
 * Deriva chave usando HMAC-SHA256
 */
async function deriveKey(mediaKey: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const infoBytes = encoder.encode(info);
  
  const key = await crypto.subtle.importKey(
    'raw',
    mediaKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, infoBytes);
  return new Uint8Array(signature).slice(0, length);
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