
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para detectar e processar diferentes formatos de áudio
function detectAudioFormat(base64Data: string): { format: string; mimeType: string } {
  const firstBytes = base64Data.substring(0, 20);
  
  // Decodificar primeira parte para verificar header
  try {
    const decoded = atob(firstBytes);
    const header = decoded.substring(0, 4);
    
    if (header.includes('OggS')) {
      return { format: 'ogg', mimeType: 'audio/ogg' };
    } else if (header.includes('RIFF')) {
      return { format: 'wav', mimeType: 'audio/wav' };
    } else if (header.includes('ID3') || decoded.charCodeAt(0) === 0xFF) {
      return { format: 'mp3', mimeType: 'audio/mpeg' };
    } else if (header.includes('ftyp')) {
      return { format: 'm4a', mimeType: 'audio/m4a' };
    }
  } catch (error) {
    console.log('Erro ao detectar formato, usando fallback');
  }
  
  // Fallback para OGG (formato comum do WhatsApp)
  return { format: 'ogg', mimeType: 'audio/ogg' };
}

function processBase64Audio(base64String: string) {
  try {
    console.log('🔄 Processando áudio base64, tamanho:', base64String.length);
    
    // Remover possíveis prefixos de data URL
    let cleanBase64 = base64String;
    if (base64String.includes(',')) {
      cleanBase64 = base64String.split(',')[1];
      console.log('✂️ Removido prefixo data URL');
    }
    
    // Validar se é base64 válido
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      throw new Error('Base64 inválido');
    }
    
    // Detectar formato do áudio
    const audioInfo = detectAudioFormat(cleanBase64);
    console.log('🎵 Formato detectado:', audioInfo);
    
    // Converter para binary
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('✅ Áudio convertido para bytes:', bytes.length, 'bytes');
    return { bytes, audioInfo };
    
  } catch (error) {
    console.error('❌ Erro ao processar base64:', error);
    throw new Error(`Erro no processamento do áudio: ${error.message}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio, openaiApiKey } = await req.json();
    
    console.log('🎵 INICIANDO transcrição de áudio...', {
      hasAudio: !!audio,
      hasApiKey: !!openaiApiKey,
      audioLength: audio?.length || 0
    });
    
    if (!audio || !openaiApiKey) {
      throw new Error('Áudio e chave da API OpenAI são obrigatórios');
    }

    // Processar áudio
    console.log('🔄 Processando dados de áudio...');
    const { bytes: audioBytes, audioInfo } = processBase64Audio(audio);
    
    if (audioBytes.length === 0) {
      throw new Error('Dados de áudio vazios após processamento');
    }

    console.log('📊 Informações do áudio:', {
      tamanho: audioBytes.length,
      formato: audioInfo.format,
      mimeType: audioInfo.mimeType
    });

    // Criar FormData para OpenAI Whisper
    const formData = new FormData();
    
    // Usar formato detectado
    const audioBlob = new Blob([audioBytes], { type: audioInfo.mimeType });
    const fileName = `audio.${audioInfo.format}`;
    formData.append('file', audioBlob, fileName);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0.0');

    console.log('🚀 Enviando para OpenAI Whisper...', {
      fileName,
      mimeType: audioInfo.mimeType,
      tamanho: audioBytes.length
    });

    // Chamar API OpenAI Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da OpenAI:', response.status, errorText);
      
      // Tentar com formato WAV como fallback
      if (audioInfo.format !== 'wav') {
        console.log('🔄 Tentando novamente com formato WAV...');
        const formData2 = new FormData();
        const audioBlob2 = new Blob([audioBytes], { type: 'audio/wav' });
        formData2.append('file', audioBlob2, 'audio.wav');
        formData2.append('model', 'whisper-1');
        formData2.append('language', 'pt');
        formData2.append('response_format', 'verbose_json');
        formData2.append('temperature', '0.0');
        
        const response2 = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData2,
        });
        
        if (!response2.ok) {
          const errorText2 = await response2.text();
          console.error('❌ Erro da OpenAI (2ª tentativa):', response2.status, errorText2);
          throw new Error(`Erro da API OpenAI após 2 tentativas: ${response2.status} - ${errorText2}`);
        }
        
        const result2 = await response2.json();
        console.log('✅ Transcrição bem-sucedida (2ª tentativa):', result2.text?.substring(0, 100));
        
        return new Response(
          JSON.stringify({ 
            text: result2.text || '',
            language: result2.language || 'pt',
            duration: result2.duration || null,
            segments: result2.segments || [],
            audioFormat: 'wav'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erro da API OpenAI: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Transcrição concluída com sucesso:', {
      hasText: !!result.text,
      textLength: result.text?.length || 0,
      language: result.language,
      duration: result.duration,
      preview: result.text?.substring(0, 100) || 'N/A'
    });

    if (!result.text || result.text.trim() === '') {
      console.warn('⚠️ Transcrição vazia recebida da OpenAI');
      return new Response(
        JSON.stringify({ 
          text: '[Áudio não pôde ser transcrito - sem conteúdo detectado]',
          language: 'pt',
          duration: null,
          error: 'Transcrição vazia',
          audioFormat: audioInfo.format
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
        audioFormat: audioInfo.format
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro CRÍTICO na função speech-to-text:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
        details: 'Erro no processamento de áudio para transcrição'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
