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
    const { apiKey, action = 'list' } = await req.json();

    if (!apiKey) {
      throw new Error('API Key do Fish.Audio é obrigatória');
    }

    console.log('🐟 [FISH-AUDIO-MODELS] Processando:', { action });

    // Validar API Key
    if (action === 'validate') {
      console.log('🔑 [FISH-AUDIO-MODELS] Validando API Key...');
      
      const validateResponse = await fetch('https://api.fish.audio/v1/tts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const isValid = validateResponse.ok;
      
      console.log('🔑 [FISH-AUDIO-MODELS] Validação resultado:', { isValid, status: validateResponse.status });

      return new Response(JSON.stringify({ valid: isValid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Listar modelos e vozes
    if (action === 'list') {
      console.log('📋 [FISH-AUDIO-MODELS] Buscando modelos...');
      
      const response = await fetch('https://api.fish.audio/model', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🐟 [FISH-AUDIO-MODELS] Erro da API:', {
          status: response.status,
          error: errorText
        });
        
        throw new Error(`Fish.Audio API Error (${response.status}): ${errorText}`);
      }

      const models = await response.json();
      
      console.log('✅ [FISH-AUDIO-MODELS] Modelos carregados:', {
        totalModels: models.length,
        modelIds: models.map((m: any) => m._id).slice(0, 5)
      });

      return new Response(JSON.stringify({ models }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Ação não reconhecida: ${action}`);

  } catch (error) {
    console.error('💥 [FISH-AUDIO-MODELS] Erro crítico:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Erro ao processar modelos do Fish.Audio'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});