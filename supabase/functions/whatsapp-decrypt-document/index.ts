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

    console.log('📄 [DECRYPT-DOCUMENT] Dados recebidos:', {
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
      console.error('❌ [DECRYPT-DOCUMENT] mediaKey inválido:', { mediaKey: mediaKey?.substring(0, 20) });
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
      console.log('🔍 [DECRYPT-DOCUMENT] Verificando cache para messageId:', messageId);
      
      const { data: cached } = await supabase
        .rpc('get_decrypted_document', { p_message_id: messageId });
      
      if (cached && cached.length > 0) {
        console.log('📄 [DECRYPT-DOCUMENT] Documento encontrado no cache');
        return new Response(JSON.stringify({
          decryptedData: cached[0].decrypted_data,
          documentFormat: cached[0].document_format
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    let encryptedBuffer: Uint8Array;

    // Get encrypted data from URL if not provided
    if (mediaUrl) {
      console.log('📥 [DECRYPT-DOCUMENT] Baixando documento criptografado de URL');
      const mediaResponse = await fetch(mediaUrl);
      if (!mediaResponse.ok) {
        throw new Error(`Falha ao baixar mídia: ${mediaResponse.statusText}`);
      }
      encryptedBuffer = new Uint8Array(await mediaResponse.arrayBuffer());
    } else {
      throw new Error('mediaUrl é obrigatório');
    }

    console.log('🔐 [DECRYPT-DOCUMENT] Processando descriptografia:', {
      encryptedSize: encryptedBuffer.length,
      mediaKeyLength: mediaKey.length
    });

    // Decrypt the document
    console.log('🔓 [DECRYPT-DOCUMENT] Iniciando descriptografia AES-GCM');
    const decryptedData = await decryptWhatsAppDocument(encryptedBuffer, mediaKey);
    
    if (!decryptedData) {
      throw new Error('Falha na descriptografia do documento');
    }

    // Detect document format
    const documentFormat = detectDocumentFormat(decryptedData);
    console.log('🔍 [DECRYPT-DOCUMENT] Formato detectado:', documentFormat);

    // Cache the result if messageId is provided
    if (messageId) {
      console.log('💾 [DECRYPT-DOCUMENT] Salvando no cache');
      await supabase.from('decrypted_document_cache').upsert({
        message_id: messageId,
        decrypted_data: decryptedData,
        document_format: documentFormat,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
      });
    }

    console.log('✅ [DECRYPT-DOCUMENT] Descriptografia concluída com sucesso');
    
    return new Response(JSON.stringify({
      decryptedData,
      documentFormat
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [DECRYPT-DOCUMENT] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Descriptografa documento do WhatsApp usando AES-GCM
 */
async function decryptWhatsAppDocument(encryptedBuffer: Uint8Array, mediaKeyBase64: string): Promise<string | null> {
  try {
    console.log('🔓 [DECRYPT-DOCUMENT] Iniciando descriptografia:', {
      encryptedSize: encryptedBuffer.length,
      mediaKeyLength: mediaKeyBase64.length,
      mediaKeyPrefix: mediaKeyBase64.substring(0, 20)
    });

    // Decodificar mediaKey de Base64
    let mediaKey: Uint8Array;
    try {
      const decoded = atob(mediaKeyBase64.trim());
      mediaKey = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
      console.log('🔑 [DECRYPT-DOCUMENT] MediaKey decodificada:', { 
        length: mediaKey.length,
        firstBytes: Array.from(mediaKey.slice(0, 8))
      });
    } catch (error) {
      console.error('❌ [DECRYPT-DOCUMENT] Erro decodificando mediaKey:', error);
      throw new Error('Falha ao decodificar mediaKey');
    }

    // Derivar chaves usando HKDF-like com HMAC-SHA256
    const aesKey = await deriveHKDFKey(mediaKey, "WhatsApp Document Keys", 32);
    const iv = await deriveHKDFKey(mediaKey, "WhatsApp Document IV", 16);
    
    console.log('🔑 [DECRYPT-DOCUMENT] Chaves derivadas:', {
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
    console.log('🔓 [DECRYPT-DOCUMENT] Iniciando AES-GCM decrypt...');
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      encryptedBuffer
    );

    console.log('✅ [DECRYPT-DOCUMENT] Descriptografia bem-sucedida:', {
      decryptedSize: decryptedBuffer.byteLength
    });

    // Converter para base64
    const decryptedArray = new Uint8Array(decryptedBuffer);
    const base64String = btoa(String.fromCharCode.apply(null, Array.from(decryptedArray)));
    
    console.log('📦 [DECRYPT-DOCUMENT] Conversão para base64 concluída:', {
      base64Length: base64String.length,
      base64Prefix: base64String.substring(0, 50)
    });
    
    return base64String;
  } catch (error) {
    console.error('❌ [DECRYPT-DOCUMENT] Erro na descriptografia:', {
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
    console.error('❌ [DECRYPT-DOCUMENT] Erro na derivação de chave:', error);
    throw error;
  }
}

/**
 * Detecta o formato do documento baseado nos primeiros bytes
 */
function detectDocumentFormat(base64Document: string): string {
  try {
    const binaryString = atob(base64Document.substring(0, 100)); // Primeiros bytes
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Verificar assinaturas de formato de documento
    const header = Array.from(bytes.slice(0, 20))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('🔍 [DECRYPT-DOCUMENT] Header do documento:', header.substring(0, 32));

    // PDF
    if (header.startsWith('255044462d')) {
      return 'application/pdf';
    }
    
    // Microsoft Office (DOCX, XLSX, PPTX) - ZIP signature
    if (header.startsWith('504b0304')) {
      return 'application/vnd.openxmlformats-officedocument';
    }
    
    // Microsoft Office Legacy (DOC, XLS, PPT)
    if (header.startsWith('d0cf11e0a1b11ae1')) {
      return 'application/msoffice';
    }
    
    // Plain text
    if (header.includes('74657874') || bytes.every(b => b < 128 && b >= 32 || b === 10 || b === 13)) {
      return 'text/plain';
    }
    
    // JPEG
    if (header.startsWith('ffd8ff')) {
      return 'image/jpeg';
    }
    
    // PNG
    if (header.startsWith('89504e47')) {
      return 'image/png';
    }
    
    // ZIP
    if (header.startsWith('504b0304')) {
      return 'application/zip';
    }

    console.log('⚠️ [DECRYPT-DOCUMENT] Formato não reconhecido');
    return 'application/octet-stream';
  } catch (error) {
    console.error('❌ [DECRYPT-DOCUMENT] Erro ao detectar formato:', error);
    return 'application/octet-stream';
  }
}