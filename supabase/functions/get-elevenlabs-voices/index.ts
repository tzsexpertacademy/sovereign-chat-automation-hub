
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
    const { apiKey } = await req.json();

    if (!apiKey) {
      throw new Error('API key is required');
    }

    console.log('Fetching ElevenLabs voices...');

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Voices fetched successfully:', data.voices?.length || 0);

    // Organizar vozes por categoria
    const organizedVoices = {
      premade: [],
      cloned: [],
      professional: []
    };

    if (data.voices) {
      data.voices.forEach((voice: any) => {
        const voiceData = {
          voice_id: voice.voice_id,
          name: voice.name,
          category: voice.category || 'premade',
          description: voice.description || '',
          preview_url: voice.preview_url || null,
          labels: voice.labels || {},
          settings: voice.settings || null
        };

        if (voice.category === 'cloned') {
          organizedVoices.cloned.push(voiceData);
        } else if (voice.category === 'professional') {
          organizedVoices.professional.push(voiceData);
        } else {
          organizedVoices.premade.push(voiceData);
        }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      voices: organizedVoices,
      total: data.voices?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-elevenlabs-voices function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
