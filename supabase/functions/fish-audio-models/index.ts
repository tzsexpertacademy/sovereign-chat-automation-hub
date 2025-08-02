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
      
      // Primeiro, buscar modelos públicos
      const publicResponse = await fetch('https://api.fish.audio/model?page_size=50', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!publicResponse.ok) {
        const errorText = await publicResponse.text();
        console.error('🐟 [FISH-AUDIO-MODELS] Erro da API pública:', {
          status: publicResponse.status,
          statusText: publicResponse.statusText,
          error: errorText
        });
        
        throw new Error(`Fish.Audio API Error (${publicResponse.status}): ${errorText}`);
      }

      const publicData = await publicResponse.json();
      const publicModels = publicData.items || [];
      
      // Buscar modelos pessoais do usuário
      let userModels = [];
      try {
        console.log('👤 [FISH-AUDIO-MODELS] Buscando modelos pessoais...');
        
        const userResponse = await fetch('https://api.fish.audio/model?created_by=me&page_size=50', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          userModels = userData.items || [];
          
          console.log('👤 [FISH-AUDIO-MODELS] Modelos pessoais encontrados:', {
            personalCount: userModels.length,
            personalTitles: userModels.map((m: any) => m.title).slice(0, 5)
          });
        } else {
          console.log('⚠️ [FISH-AUDIO-MODELS] Não foi possível buscar modelos pessoais:', userResponse.status);
        }
      } catch (error) {
        console.log('⚠️ [FISH-AUDIO-MODELS] Erro ao buscar modelos pessoais:', error);
      }

      // Filtrar apenas modelos TTS treinados
      const publicTTSModels = publicModels.filter((model: any) => 
        model.type === 'tts' && 
        model.state === 'trained' && 
        model.visibility === 'public'
      );

      const personalTTSModels = userModels.filter((model: any) => 
        model.type === 'tts' && 
        model.state === 'trained'
      );

      // Dar prioridade aos modelos pessoais
      const combinedModels = [...personalTTSModels, ...publicTTSModels];

      console.log('📊 [FISH-AUDIO-MODELS] Análise completa:', {
        publicTotal: publicModels.length,
        publicTTS: publicTTSModels.length,
        personalTotal: userModels.length,
        personalTTS: personalTTSModels.length,
        finalCombined: combinedModels.length
      });

      console.log('✅ [FISH-AUDIO-MODELS] Modelos finais:', {
        personalVoices: personalTTSModels.map((m: any) => ({ id: m._id, title: m.title })),
        topPublicVoices: publicTTSModels.slice(0, 3).map((m: any) => ({ id: m._id, title: m.title }))
      });

      return new Response(JSON.stringify({ models: combinedModels }), {
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