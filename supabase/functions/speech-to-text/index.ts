
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para processar base64 em chunks - otimizada
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
    
    // Converter para binary
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('✅ Áudio convertido para bytes:', bytes.length, 'bytes');
    return bytes;
    
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
    const audioBytes = processBase64Audio(audio);
    
    if (audioBytes.length === 0) {
      throw new Error('Dados de áudio vazios após processamento');
    }

    // Criar FormData para OpenAI Whisper
    const formData = new FormData();
    
    // Testar diferentes tipos MIME para melhor compatibilidade
    const audioBlob = new Blob([audioBytes], { type: 'audio/ogg' });
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0.0');

    console.log('🚀 Enviando para OpenAI Whisper...');
    console.log('📊 Tamanho do arquivo:', audioBytes.length, 'bytes');

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
      
      // Tentar novamente com formato diferente
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
        throw new Error(`Erro da API OpenAI: ${response2.status} - ${errorText2}`);
      }
      
      const result2 = await response2.json();
      console.log('✅ Transcrição bem-sucedida (2ª tentativa):', {
        text: result2.text?.substring(0, 100),
        language: result2.language,
        duration: result2.duration
      });
      
      return new Response(
        JSON.stringify({ 
          text: result2.text || '',
          language: result2.language || 'pt',
          duration: result2.duration || null,
          segments: result2.segments || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          text: '[Áudio não pôde ser transcrito]',
          language: 'pt',
          duration: null,
          error: 'Transcrição vazia'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        text: result.text.trim(),
        language: result.language || 'pt',
        duration: result.duration || null,
        segments: result.segments || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro CRÍTICO na função speech-to-text:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
        details: 'Erro no processamento de áudio'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
