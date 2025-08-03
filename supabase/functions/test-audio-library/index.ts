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
    console.log('🧪 [TEST-AUDIO-LIB] Iniciando teste da biblioteca de áudio...');

    const { clientId, command } = await req.json();
    
    if (!clientId || !command) {
      throw new Error('clientId e command são obrigatórios');
    }

    console.log(`🔍 [TEST-AUDIO-LIB] Cliente: ${clientId}, Comando: ${command}`);

    // Conectar ao Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // === BUSCAR ASSISTENTE ===
    console.log('📋 [TEST-AUDIO-LIB] Buscando assistente...');
    const { data: assistants, error: assistantsError } = await supabase
      .from('assistants')
      .select('*')
      .eq('client_id', clientId)
      .limit(1);

    if (assistantsError) {
      throw new Error(`Erro ao buscar assistente: ${assistantsError.message}`);
    }

    if (!assistants || assistants.length === 0) {
      throw new Error('Nenhum assistente encontrado');
    }

    const assistant = assistants[0];
    console.log(`✅ [TEST-AUDIO-LIB] Assistente encontrado: ${assistant.name}`);

    // === EXTRAIR BIBLIOTECA ===
    let advancedSettings = assistant.advanced_settings;
    if (typeof advancedSettings === 'string') {
      advancedSettings = JSON.parse(advancedSettings);
    }

    const audioLibrary = (advancedSettings as any)?.audio_library;
    
    if (!Array.isArray(audioLibrary) || audioLibrary.length === 0) {
      throw new Error('Biblioteca de áudio não encontrada ou vazia');
    }

    console.log(`🎵 [TEST-AUDIO-LIB] Biblioteca carregada: ${audioLibrary.length} itens`);

    // === BUSCAR MATCH ===
    const commandClean = command.replace(':', '').trim();
    console.log(`🔍 [TEST-AUDIO-LIB] Comando limpo: "${commandClean}"`);

    const audioItem = audioLibrary.find((item: any) => 
      item.trigger === commandClean || 
      item.trigger.includes(commandClean) ||
      commandClean.includes(item.trigger)
    );

    if (!audioItem) {
      const availableTriggers = audioLibrary.map((item: any) => item.trigger).join(', ');
      throw new Error(`Comando "${commandClean}" não encontrado. Triggers disponíveis: ${availableTriggers}`);
    }

    console.log(`✅ [TEST-AUDIO-LIB] Match encontrado: ${audioItem.trigger}`);

    // === VERIFICAR ÁUDIO ===
    if (!audioItem.audioBase64) {
      throw new Error('Base64 do áudio não encontrado');
    }

    console.log(`🎵 [TEST-AUDIO-LIB] Áudio válido: ${audioItem.audioBase64.length} chars`);

    // === SIMULAR ENVIO ===
    const testResult = {
      success: true,
      assistantName: assistant.name,
      trigger: audioItem.trigger,
      audioName: audioItem.name,
      audioSize: audioItem.audioBase64.length,
      audioPreview: audioItem.audioBase64.substring(0, 50) + '...',
      message: `🎵 Áudio "${audioItem.name}" pronto para envio via trigger "${audioItem.trigger}"`
    };

    console.log('🎉 [TEST-AUDIO-LIB] Teste concluído com sucesso!');

    return new Response(JSON.stringify(testResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ [TEST-AUDIO-LIB] Erro:', error.message);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});