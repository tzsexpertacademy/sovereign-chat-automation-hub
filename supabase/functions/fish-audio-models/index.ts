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
      
      // Primeiro, buscar modelos pessoais do usuário (vozes clonadas)
      let userModels = [];
      try {
        console.log('👤 [FISH-AUDIO-MODELS] Buscando modelos pessoais com visibility=private...');
        
        const userResponse = await fetch('https://api.fish.audio/model?visibility=private&type=tts&state=trained&page_size=100', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        console.log('👤 [FISH-AUDIO-MODELS] Status da requisição pessoal:', userResponse.status);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          userModels = userData.items || [];
          
          console.log('👤 [FISH-AUDIO-MODELS] Resposta completa pessoal:', {
            total: userData.total || 0,
            page: userData.page || 0,
            pageSize: userData.page_size || 0,
            personalCount: userModels.length,
            personalTitles: userModels.map((m: any) => m.title),
            personalIds: userModels.map((m: any) => m._id)
          });
        } else {
          const errorText = await userResponse.text();
          console.log('⚠️ [FISH-AUDIO-MODELS] Erro ao buscar modelos pessoais:', {
            status: userResponse.status,
            error: errorText
          });
        }
      } catch (error) {
        console.log('⚠️ [FISH-AUDIO-MODELS] Erro ao buscar modelos pessoais:', error);
      }

      // Se não encontrou modelos pessoais, tentar sem filtro de visibilidade
      if (userModels.length === 0) {
        try {
          console.log('🔄 [FISH-AUDIO-MODELS] Tentando buscar todos os modelos para debug...');
          
          const allResponse = await fetch('https://api.fish.audio/model?type=tts&state=trained&page_size=100', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
          });

          if (allResponse.ok) {
            const allData = await allResponse.json();
            const allModels = allData.items || [];
            
            console.log('🔍 [FISH-AUDIO-MODELS] Análise de todos os modelos:', {
              totalModels: allModels.length,
              visibilityTypes: [...new Set(allModels.map((m: any) => m.visibility))],
              sampleModels: allModels.slice(0, 3).map((m: any) => ({
                id: m._id,
                title: m.title,
                visibility: m.visibility,
                type: m.type,
                state: m.state
              }))
            });
            
            // Filtrar manualmente por visibilidade privada
            userModels = allModels.filter((m: any) => m.visibility === 'private' || m.visibility === 'personal');
            
            console.log('🎯 [FISH-AUDIO-MODELS] Modelos pessoais filtrados manualmente:', {
              personalCount: userModels.length,
              personalTitles: userModels.map((m: any) => m.title)
            });
          }
        } catch (error) {
          console.log('⚠️ [FISH-AUDIO-MODELS] Erro na busca de debug:', error);
        }
      }
      
      // Buscar alguns modelos públicos para fallback
      let publicModels = [];
      try {
        console.log('🌍 [FISH-AUDIO-MODELS] Buscando modelos públicos...');
        
        const publicResponse = await fetch('https://api.fish.audio/model?visibility=public&type=tts&state=trained&page_size=20', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (publicResponse.ok) {
          const publicData = await publicResponse.json();
          publicModels = publicData.items || [];
          
          console.log('🌍 [FISH-AUDIO-MODELS] Modelos públicos encontrados:', {
            publicCount: publicModels.length
          });
        } else {
          const errorText = await publicResponse.text();
          console.error('🐟 [FISH-AUDIO-MODELS] Erro da API pública:', {
            status: publicResponse.status,
            statusText: publicResponse.statusText,
            error: errorText
          });
          
          throw new Error(`Fish.Audio API Error (${publicResponse.status}): ${errorText}`);
        }
      } catch (error) {
        console.log('⚠️ [FISH-AUDIO-MODELS] Erro ao buscar modelos públicos:', error);
        throw error;
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