
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para detectar e processar diferentes formatos de áudio
function detectAudioFormat(base64Data: string): { format: string; mimeType: string } {
  const firstBytes = base64Data.substring(0, 32);
  
  // Decodificar primeira parte para verificar header
  try {
    const decoded = atob(firstBytes);
    const bytes = new Uint8Array(decoded.split('').map(char => char.charCodeAt(0)));
    
    // OGG (WhatsApp comum): bytes começam com "OggS"
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      console.log('🎵 Detectado formato OGG Opus (WhatsApp)');
      return { format: 'ogg', mimeType: 'audio/ogg' };
    }
    
    // WAV: bytes começam com "RIFF"
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      console.log('🎵 Detectado formato WAV');
      return { format: 'wav', mimeType: 'audio/wav' };
    }
    
    // MP3: ID3 tag ou frame sync
    if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || 
        (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) {
      console.log('🎵 Detectado formato MP3');
      return { format: 'mp3', mimeType: 'audio/mpeg' };
    }
    
    // M4A/AAC: ftyp box
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      console.log('🎵 Detectado formato M4A');
      return { format: 'm4a', mimeType: 'audio/m4a' };
    }
    
    // WebM: EBML header
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      console.log('🎵 Detectado formato WebM');
      return { format: 'webm', mimeType: 'audio/webm' };
    }
    
  } catch (error) {
    console.log('🔍 Erro ao detectar formato, usando fallback para OGG:', error.message);
  }
  
  // Fallback para OGG (formato comum do WhatsApp)
  console.log('🎵 Usando formato fallback: OGG');
  return { format: 'ogg', mimeType: 'audio/ogg' };
}

function processBase64Audio(base64String: string) {
  try {
    console.log('🔄 PROCESSANDO áudio base64, tamanho:', base64String.length);
    
    // Remover possíveis prefixos de data URL
    let cleanBase64 = base64String;
    if (base64String.includes(',')) {
      cleanBase64 = base64String.split(',')[1];
      console.log('✂️ Removido prefixo data URL');
    }
    
    // Validar se é base64 válido
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      throw new Error('Base64 inválido detectado');
    }
    
    // Detectar formato do áudio
    const audioInfo = detectAudioFormat(cleanBase64);
    console.log('🎵 Formato de áudio detectado:', audioInfo);
    
    // Converter para binary
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('✅ Áudio convertido para bytes:', bytes.length, 'bytes');
    return { bytes, audioInfo };
    
  } catch (error) {
    console.error('❌ ERRO ao processar base64:', error);
    throw new Error(`Erro no processamento do áudio: ${error.message}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio, openaiApiKey } = await req.json();
    
    console.log('🎵 ===== INICIANDO TRANSCRIÇÃO DE ÁUDIO =====');
    console.log('📊 Dados recebidos:', {
      hasAudio: !!audio,
      hasApiKey: !!openaiApiKey,
      audioLength: audio?.length || 0,
      audioPrefixPreview: audio?.substring(0, 50) || 'N/A'
    });
    
    if (!audio || !openaiApiKey) {
      const errorMsg = 'Áudio e chave da API OpenAI são obrigatórios';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    // Processar áudio
    console.log('🔄 Processando dados de áudio...');
    const { bytes: audioBytes, audioInfo } = processBase64Audio(audio);
    
    if (audioBytes.length === 0) {
      console.error('❌ Dados de áudio vazios após processamento');
      throw new Error('Dados de áudio vazios após processamento');
    }

    console.log('📊 Informações do áudio processado:', {
      tamanho: audioBytes.length,
      formato: audioInfo.format,
      mimeType: audioInfo.mimeType,
      primeiros10Bytes: Array.from(audioBytes.slice(0, 10)).map(b => b.toString(16)).join(' ')
    });

    // Tentar múltiplos formatos para compatibilidade máxima (ordem otimizada para WhatsApp)
    const formatsToTry = [
      { format: audioInfo.format, mimeType: audioInfo.mimeType },
      { format: 'ogg', mimeType: 'audio/ogg' },
      { format: 'oga', mimeType: 'audio/oga' },
      { format: 'wav', mimeType: 'audio/wav' },
      { format: 'webm', mimeType: 'audio/webm' },
      { format: 'mp3', mimeType: 'audio/mpeg' },
      { format: 'm4a', mimeType: 'audio/m4a' }
    ];

    for (let i = 0; i < formatsToTry.length; i++) {
      const { format, mimeType } = formatsToTry[i];
      
      try {
        console.log(`🚀 TENTATIVA ${i + 1}: Enviando para OpenAI Whisper como ${format}...`);

        // Criar FormData para OpenAI Whisper
        const formData = new FormData();
        const audioBlob = new Blob([audioBytes], { type: mimeType });
        const fileName = `audio.${format}`;
        
        formData.append('file', audioBlob, fileName);
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');
        formData.append('response_format', 'verbose_json');
        formData.append('temperature', '0.0');

        console.log('📤 Enviando para OpenAI:', {
          fileName,
          mimeType,
          blobSize: audioBlob.size,
          tentativa: i + 1
        });

        // Chamar API OpenAI Whisper
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

        console.log('📡 Resposta da OpenAI:', {
          status: response.status,
          statusText: response.statusText,
          tentativa: i + 1
        });

        if (response.ok) {
          const result = await response.json();
          
          console.log('✅ TRANSCRIÇÃO BEM-SUCEDIDA:', {
            hasText: !!result.text,
            textLength: result.text?.length || 0,
            language: result.language,
            duration: result.duration,
            preview: result.text?.substring(0, 100) || 'N/A',
            formatUsado: format,
            tentativa: i + 1
          });

          if (!result.text || result.text.trim() === '') {
            console.warn('⚠️ Transcrição vazia recebida da OpenAI');
            return new Response(
              JSON.stringify({ 
                text: '[Áudio não pôde ser transcrito - conteúdo vazio]',
                language: 'pt',
                duration: null,
                error: 'Transcrição vazia',
                audioFormat: format,
                details: 'OpenAI retornou resposta vazia'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ 
              text: result.text.trim(),
              language: result.language || 'pt',
              duration: result.duration || null,
              segments: result.segments || [],
              audioFormat: format,
              success: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const errorText = await response.text();
          console.error(`❌ ERRO OpenAI tentativa ${i + 1}:`, response.status, errorText);
          
          // Se não é a última tentativa, continuar
          if (i < formatsToTry.length - 1) {
            console.log(`🔄 Tentando próximo formato...`);
            continue;
          } else {
            throw new Error(`Erro da API OpenAI após ${formatsToTry.length} tentativas: ${response.status} - ${errorText}`);
          }
        }
      } catch (error) {
        console.error(`❌ ERRO na tentativa ${i + 1} com formato ${format}:`, error);
        
        // Se não é a última tentativa, continuar
        if (i < formatsToTry.length - 1) {
          console.log(`🔄 Continuando para próximo formato...`);
          continue;
        } else {
          throw error;
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw new Error('Todas as tentativas de transcrição falharam');

  } catch (error) {
    console.error('❌ ERRO CRÍTICO na função speech-to-text:', error);
    console.error('📋 Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido',
        timestamp: new Date().toISOString(),
        details: 'Erro no processamento de áudio para transcrição',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
