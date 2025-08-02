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
      referenceId, 
      text = "Olá! Esta é uma demonstração da voz clonada do Fish Audio.",
      format = 'mp3'
    } = await req.json();

    if (!apiKey) {
      throw new Error('API Key do Fish.Audio é obrigatória');
    }

    if (!referenceId) {
      throw new Error('Reference ID da voz é obrigatório');
    }

    console.log('🐟 [FISH-AUDIO-TEST] Testando voz:', {
      referenceId,
      textLength: text.length,
      format
    });

    // Fazer requisição de teste para Fish.Audio API
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reference_id: referenceId,
        format,
        normalize: true,
        latency: 'balanced'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🐟 [FISH-AUDIO-TEST] Erro da API:', {
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

    console.log('✅ [FISH-AUDIO-TEST] Teste de voz concluído:', {
      audioSize: audioArrayBuffer.byteLength,
      base64Length: audioBase64.length
    });

    return new Response(JSON.stringify({ 
      audioBase64,
      format,
      size: audioArrayBuffer.byteLength,
      testText: text
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 [FISH-AUDIO-TEST] Erro crítico:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Erro no teste de voz do Fish.Audio'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});