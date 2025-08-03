
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
    console.log('🎵 ===== INICIANDO TEXT-TO-SPEECH =====');
    
    const { text, voiceId, apiKey, model = "eleven_multilingual_v2", voiceSettings } = await req.json();

    if (!text || !voiceId || !apiKey) {
      throw new Error('Text, voice ID, and API key are required');
    }

    console.log(`🎤 Gerando áudio com ElevenLabs:`, {
      textLength: text.length,
      voiceId: voiceId.substring(0, 8) + '...',
      model,
      hasVoiceSettings: !!voiceSettings
    });

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
        voice_settings: voiceSettings || {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.5
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ElevenLabs TTS API error:', response.status, errorText);
      
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
    
    // 🔧 CONVERSÃO 100% SEGURA PARA BASE64 (sem apply/spread operators)
    const uint8Array = new Uint8Array(audioBuffer);
    let binaryString = '';
    const chunkSize = 1024; // 1KB chunks para máxima segurança
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunkEnd = Math.min(i + chunkSize, uint8Array.length);
      let chunkString = '';
      
      // Iterar byte por byte sem apply() para evitar stack overflow
      for (let j = i; j < chunkEnd; j++) {
        chunkString += String.fromCharCode(uint8Array[j]);
      }
      
      binaryString += chunkString;
    }
    
    const base64Audio = btoa(binaryString);

    console.log('✅ Áudio gerado com sucesso:', {
      audioSizeBytes: audioBuffer.byteLength,
      base64Length: base64Audio.length
    });

    return new Response(JSON.stringify({ 
      success: true,
      audioBase64: base64Audio,
      audioSizeBytes: audioBuffer.byteLength
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na função text-to-speech:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
