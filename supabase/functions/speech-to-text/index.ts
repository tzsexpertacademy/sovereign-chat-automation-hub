import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🎵 ===== TRANSCRIÇÃO SIMPLIFICADA =====');
    console.log('🔍 Request method:', req.method);
    
    const body = await req.json();
    const { audio, audioUrl, openaiApiKey, messageId } = body;
    
    console.log('📊 Dados recebidos:', {
      hasAudio: !!audio,
      hasAudioUrl: !!audioUrl,
      hasApiKey: !!openaiApiKey,
      audioLength: audio?.length || 0,
      messageId: messageId || 'N/A'
    });
    
    // Validações básicas
    if (!openaiApiKey) {
      console.error('❌ API Key OpenAI obrigatória');
      return new Response(JSON.stringify({ 
        error: 'API Key OpenAI obrigatória',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!audio && !audioUrl) {
      console.error('❌ Nenhum dado de áudio fornecido');
      return new Response(JSON.stringify({ 
        error: 'Dados de áudio obrigatórios',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let audioData: string = audio;
    
    // Se tem URL mas não tem base64, baixar
    if (!audio && audioUrl) {
      console.log('🔄 Baixando áudio da URL...');
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        audioData = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        console.log('✅ Áudio baixado, tamanho:', audioData.length);
      } catch (error) {
        console.error('❌ Erro ao baixar áudio:', error);
        throw new Error(`Falha ao baixar áudio: ${error.message}`);
      }
    }

    // Limpar base64
    let cleanBase64 = audioData;
    if (audioData.includes(',')) {
      cleanBase64 = audioData.split(',')[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    // Validar tamanho mínimo
    if (cleanBase64.length < 100) {
      console.error('❌ Dados de áudio muito pequenos');
      return new Response(JSON.stringify({ 
        error: 'Dados de áudio muito pequenos',
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔄 Processando áudio base64, tamanho:', cleanBase64.length);
    
    // Converter para bytes
    const binaryString = atob(cleanBase64);
    const audioBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioBytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('✅ Áudio convertido para bytes:', audioBytes.length);
    console.log('🔍 Primeiros 10 bytes:', Array.from(audioBytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' '));

    // Preparar FormData para OpenAI Whisper
    const formData = new FormData();
    const audioBlob = new Blob([audioBytes], { type: 'audio/ogg' });
    
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'verbose_json');

    console.log('📤 Enviando para OpenAI Whisper (formato OGG)...');

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
      statusText: response.statusText
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ERRO OpenAI:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ TRANSCRIÇÃO BEM-SUCEDIDA:', {
      hasText: !!result.text,
      textLength: result.text?.length || 0,
      language: result.language,
      duration: result.duration,
      preview: result.text?.substring(0, 100) || 'N/A'
    });

    if (!result.text || result.text.trim() === '') {
      console.warn('⚠️ Transcrição vazia recebida');
      return new Response(
        JSON.stringify({ 
          text: '[Áudio não pôde ser transcrito]',
          language: 'pt',
          duration: null,
          error: 'Transcrição vazia',
          success: false
        }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Sucesso
    console.log('🎉 SUCESSO - retornando transcrição');
    return new Response(
      JSON.stringify({ 
        text: result.text.trim(),
        language: result.language || 'pt',
        duration: result.duration || null,
        segments: result.segments || [],
        success: true,
        messageId: messageId,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error);
    console.error('📋 Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido',
        timestamp: new Date().toISOString(),
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});