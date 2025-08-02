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

    // Validar API Key usando endpoint de modelos
    if (action === 'validate') {
      console.log('🔑 [FISH-AUDIO-MODELS] Validando API Key...');
      
      const validateResponse = await fetch('https://api.fish.audio/model?page_size=1', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const isValid = validateResponse.ok;
      
      if (!isValid) {
        const errorText = await validateResponse.text();
        console.log('🔑 [FISH-AUDIO-MODELS] Erro na validação:', { 
          status: validateResponse.status, 
          error: errorText 
        });
      }
      
      console.log('🔑 [FISH-AUDIO-MODELS] Validação resultado:', { isValid, status: validateResponse.status });

      return new Response(JSON.stringify({ valid: isValid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Listar modelos e vozes
    if (action === 'list') {
      console.log('📋 [FISH-AUDIO-MODELS] Buscando modelos...');
      
      const response = await fetch('https://api.fish.audio/model?page_size=50', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🐟 [FISH-AUDIO-MODELS] Erro da API:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        throw new Error(`Fish.Audio API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      console.log('📊 [FISH-AUDIO-MODELS] Resposta da API:', {
        hasItems: !!data.items,
        hasTotal: !!data.total,
        dataType: typeof data,
        dataKeys: Object.keys(data || {})
      });

      // Fish.Audio retorna { total, items } onde items é o array de modelos
      const models = data.items || [];
      
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