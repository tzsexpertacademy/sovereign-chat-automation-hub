import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 [AUDIO-LIBRARY-COMPLETE] Iniciando diagnóstico completo...');

    const { clientId, testCommand } = await req.json();
    
    if (!clientId || !testCommand) {
      throw new Error('clientId e testCommand são obrigatórios');
    }

    console.log(`🔍 [AUDIO-LIBRARY-COMPLETE] Cliente: ${clientId}, Comando: ${testCommand}`);

    // Conectar ao Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const diagnosticResults = {
      success: false,
      steps: [] as any[],
      finalResult: '',
      errors: [] as string[],
      recommendations: [] as string[]
    };

    // === ETAPA 1: BUSCAR ASSISTENTE ===
    console.log('📋 [STEP-1] Buscando assistente...');
    diagnosticResults.steps.push({
      step: 1,
      name: 'Buscar Assistente',
      status: 'running'
    });

    const { data: assistants, error: assistantsError } = await supabase
      .from('assistants')
      .select('*')
      .eq('client_id', clientId)
      .limit(1);

    if (assistantsError || !assistants || assistants.length === 0) {
      const error = assistantsError?.message || 'Nenhum assistente encontrado';
      diagnosticResults.errors.push(`Etapa 1 falhou: ${error}`);
      diagnosticResults.steps[0].status = 'failed';
      diagnosticResults.steps[0].error = error;
      throw new Error(error);
    }

    const assistant = assistants[0];
    diagnosticResults.steps[0].status = 'success';
    diagnosticResults.steps[0].result = `Assistente encontrado: ${assistant.name}`;
    console.log(`✅ [STEP-1] Assistente: ${assistant.name}`);

    // === ETAPA 2: VALIDAR ADVANCED_SETTINGS ===
    console.log('🔧 [STEP-2] Validando advanced_settings...');
    diagnosticResults.steps.push({
      step: 2,
      name: 'Validar Advanced Settings',
      status: 'running'
    });

    let advancedSettings;
    try {
      if (typeof assistant.advanced_settings === 'string') {
        advancedSettings = JSON.parse(assistant.advanced_settings);
      } else {
        advancedSettings = assistant.advanced_settings;
      }
      
      diagnosticResults.steps[1].status = 'success';
      diagnosticResults.steps[1].result = 'JSON válido';
      console.log('✅ [STEP-2] Advanced settings válido');
    } catch (parseError) {
      const error = `JSON inválido: ${parseError.message}`;
      diagnosticResults.errors.push(`Etapa 2 falhou: ${error}`);
      diagnosticResults.steps[1].status = 'failed';
      diagnosticResults.steps[1].error = error;
      diagnosticResults.recommendations.push('Recriar advanced_settings com JSON válido');
      throw new Error(error);
    }

    // === ETAPA 3: VERIFICAR AUDIO_LIBRARY ===
    console.log('🎵 [STEP-3] Verificando audio_library...');
    diagnosticResults.steps.push({
      step: 3,
      name: 'Verificar Audio Library',
      status: 'running'
    });

    const audioLibrary = advancedSettings?.audio_library;
    
    if (!Array.isArray(audioLibrary)) {
      const error = 'audio_library não é um array válido';
      diagnosticResults.errors.push(`Etapa 3 falhou: ${error}`);
      diagnosticResults.steps[2].status = 'failed';
      diagnosticResults.steps[2].error = error;
      diagnosticResults.recommendations.push('Criar audio_library como array no advanced_settings');
      throw new Error(error);
    }

    if (audioLibrary.length === 0) {
      const error = 'audio_library está vazia';
      diagnosticResults.errors.push(`Etapa 3 falhou: ${error}`);
      diagnosticResults.steps[2].status = 'failed';
      diagnosticResults.steps[2].error = error;
      diagnosticResults.recommendations.push('Adicionar itens na biblioteca de áudio');
      throw new Error(error);
    }

    diagnosticResults.steps[2].status = 'success';
    diagnosticResults.steps[2].result = `${audioLibrary.length} itens encontrados`;
    console.log(`✅ [STEP-3] Biblioteca: ${audioLibrary.length} itens`);

    // === ETAPA 4: TESTAR REGEX DE DETECÇÃO ===
    console.log('🔍 [STEP-4] Testando regex de detecção...');
    diagnosticResults.steps.push({
      step: 4,
      name: 'Testar Regex de Detecção',
      status: 'running'
    });

    const audioLibraryPattern = /audio\s*([^:\s\n]+)(?:\s*:|$)/gi;
    const match = audioLibraryPattern.exec(testCommand);
    audioLibraryPattern.lastIndex = 0; // Reset regex

    if (!match) {
      const error = `Comando "${testCommand}" não detectado pelo regex`;
      diagnosticResults.errors.push(`Etapa 4 falhou: ${error}`);
      diagnosticResults.steps[3].status = 'failed';
      diagnosticResults.steps[3].error = error;
      diagnosticResults.recommendations.push('Verificar formato do comando. Use: "audio nomeDoTrigger" ou "audio nomeDoTrigger:"');
      throw new Error(error);
    }

    const detectedTrigger = match[1].trim();
    diagnosticResults.steps[3].status = 'success';
    diagnosticResults.steps[3].result = `Trigger detectado: "${detectedTrigger}"`;
    console.log(`✅ [STEP-4] Trigger detectado: "${detectedTrigger}"`);

    // === ETAPA 5: BUSCAR MATCH NA BIBLIOTECA ===
    console.log('🎯 [STEP-5] Buscando match na biblioteca...');
    diagnosticResults.steps.push({
      step: 5,
      name: 'Buscar Match na Biblioteca',
      status: 'running'
    });

    const audioItem = audioLibrary.find((item: any) => {
      if (!item.trigger) return false;
      
      const itemTrigger = item.trigger.toString().toLowerCase().trim();
      const searchTrigger = detectedTrigger.toLowerCase().trim();
      
      return itemTrigger === searchTrigger || 
             itemTrigger.includes(searchTrigger) ||
             searchTrigger.includes(itemTrigger);
    });

    if (!audioItem) {
      const availableTriggers = audioLibrary.map((item: any) => item.trigger).join(', ');
      const error = `Trigger "${detectedTrigger}" não encontrado na biblioteca`;
      diagnosticResults.errors.push(`Etapa 5 falhou: ${error}`);
      diagnosticResults.steps[4].status = 'failed';
      diagnosticResults.steps[4].error = error;
      diagnosticResults.steps[4].availableTriggers = availableTriggers;
      diagnosticResults.recommendations.push(`Triggers disponíveis: ${availableTriggers}`);
      throw new Error(error);
    }

    diagnosticResults.steps[4].status = 'success';
    diagnosticResults.steps[4].result = `Match encontrado: ${audioItem.trigger}`;
    console.log(`✅ [STEP-5] Match: ${audioItem.trigger}`);

    // === ETAPA 6: VALIDAR ÁUDIO BASE64 ===
    console.log('🎼 [STEP-6] Validando áudio base64...');
    diagnosticResults.steps.push({
      step: 6,
      name: 'Validar Áudio Base64',
      status: 'running'
    });

    if (!audioItem.audioBase64) {
      const error = 'audioBase64 não encontrado no item';
      diagnosticResults.errors.push(`Etapa 6 falhou: ${error}`);
      diagnosticResults.steps[5].status = 'failed';
      diagnosticResults.steps[5].error = error;
      diagnosticResults.recommendations.push('Reupload do arquivo de áudio');
      throw new Error(error);
    }

    if (audioItem.audioBase64.length < 100) {
      const error = 'audioBase64 muito pequeno, pode estar corrompido';
      diagnosticResults.errors.push(`Etapa 6 falhou: ${error}`);
      diagnosticResults.steps[5].status = 'failed';
      diagnosticResults.steps[5].error = error;
      diagnosticResults.recommendations.push('Reupload do arquivo de áudio');
      throw new Error(error);
    }

    diagnosticResults.steps[5].status = 'success';
    diagnosticResults.steps[5].result = `Áudio válido: ${audioItem.audioBase64.length} chars`;
    console.log(`✅ [STEP-6] Áudio válido: ${audioItem.audioBase64.length} chars`);

    // === ETAPA 7: SIMULAR ENVIO ===
    console.log('📤 [STEP-7] Simulando envio...');
    diagnosticResults.steps.push({
      step: 7,
      name: 'Simular Envio',
      status: 'running'
    });

    // Simular todos os dados necessários para o envio
    const sendData = {
      audioName: audioItem.name,
      audioBase64: audioItem.audioBase64,
      trigger: audioItem.trigger,
      duration: audioItem.duration || 'não especificada',
      category: audioItem.category || 'sem categoria'
    };

    diagnosticResults.steps[6].status = 'success';
    diagnosticResults.steps[6].result = 'Dados prontos para envio';
    diagnosticResults.steps[6].sendData = sendData;
    console.log('✅ [STEP-7] Simulação concluída');

    // === RESULTADO FINAL ===
    diagnosticResults.success = true;
    diagnosticResults.finalResult = `🎉 Comando "${testCommand}" processado com sucesso! Áudio "${audioItem.name}" pronto para envio.`;
    diagnosticResults.recommendations.push('Sistema funcionando corretamente - comando deve funcionar no chat real');

    console.log('🎉 [AUDIO-LIBRARY-COMPLETE] Diagnóstico concluído com sucesso!');

    return new Response(JSON.stringify(diagnosticResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ [AUDIO-LIBRARY-COMPLETE] Erro:', error.message);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      steps: [],
      recommendations: ['Verificar logs para mais detalhes', 'Tentar reconfigurar a biblioteca de áudio']
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});