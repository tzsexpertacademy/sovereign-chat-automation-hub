
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, apiKey, model = "eleven_multilingual_v2" } = await req.json();

    if (!text || !voiceId || !apiKey) {
      throw new Error('Text, voice ID, and API key are required');
    }

    console.log(`Testing voice ${voiceId} with text: "${text.substring(0, 50)}..."`);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.5
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS API error:', response.status, errorText);
      
      // Parse error message for better user feedback
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.detail?.status === 'ivc_not_permitted') {
          throw new Error('Esta voz clonada requer uma assinatura premium do ElevenLabs. Por favor, faça upgrade da sua conta ou selecione uma voz pré-definida.');
        }
        throw new Error(`Erro da API ElevenLabs: ${errorData.detail?.message || errorText}`);
      } catch (parseError) {
        throw new Error(`Erro da API ElevenLabs (${response.status}): ${errorText}`);
      }
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    console.log('Voice test successful, audio generated');

    return new Response(JSON.stringify({ 
      success: true, 
      audioBase64: base64Audio 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-elevenlabs-voice function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
