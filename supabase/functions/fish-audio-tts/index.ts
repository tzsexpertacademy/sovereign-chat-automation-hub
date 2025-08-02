import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    const { 
      apiKey, 
      text, 
      reference_id, 
      format = 'mp3',
      normalize = true,
      mp3_bitrate = 128,
      opus_bitrate = 32,
      latency = 'balanced'
    } = await req.json();

    if (!apiKey) {
      throw new Error('API Key do Fish.Audio é obrigatória');
    }

    if (!text) {
      throw new Error('Texto é obrigatório');
    }

    if (!reference_id) {
      throw new Error('Reference ID da voz é obrigatório');
    }

    console.log('🐟 [FISH-AUDIO-TTS] Iniciando conversão:', {
      textLength: text.length,
      referenceId: reference_id,
      format,
      latency
    });

    // Fazer requisição para Fish.Audio API usando endpoint correto
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'model': format === 'mp3' ? 'speech-1.5' : 'speech-1.6'
      },
      body: JSON.stringify({
        text,
        reference_id,
        format,
        normalize,
        mp3_bitrate,
        opus_bitrate,
        latency
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🐟 [FISH-AUDIO-TTS] Erro da API:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      throw new Error(`Fish.Audio API Error (${response.status}): ${errorText}`);
    }

    // Converter resposta de áudio para base64
    const audioArrayBuffer = await response.arrayBuffer();
    const audioBase64 = btoa(
      String.fromCharCode(...new Uint8Array(audioArrayBuffer))
    );

    console.log('✅ [FISH-AUDIO-TTS] TTS gerado com sucesso:', {
      audioSize: audioArrayBuffer.byteLength,
      base64Length: audioBase64.length,
      format
    });

    return new Response(JSON.stringify({ 
      audioBase64,
      format,
      size: audioArrayBuffer.byteLength
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 [FISH-AUDIO-TTS] Erro crítico:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Erro na conversão de texto para áudio com Fish.Audio'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});