
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      messageText, 
      assistantId, 
      chatId, 
      instanceId,
      messageId,
      isAudioMessage = false 
    } = await req.json();

    console.log('🔍 Processando mensagem para assistente:', assistantId);
    console.log('📋 Dados recebidos:', {
      chatId,
      instanceId,
      messageId,
      messagePreview: messageText?.substring(0, 50)
    });

    // Buscar configurações do assistente
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('*, advanced_settings')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      console.error('❌ Assistente não encontrado:', assistantError);
      throw new Error('Assistente não encontrado');
    }

    console.log('✅ Assistente encontrado:', assistant.name);

    // Parse das configurações avançadas
    let settings: any = {};
    try {
      settings = assistant.advanced_settings ? 
        (typeof assistant.advanced_settings === 'string' ? 
          JSON.parse(assistant.advanced_settings) : assistant.advanced_settings) : {};
    } catch (error) {
      console.error('❌ Erro ao fazer parse das configurações avançadas:', error);
      settings = {};
    }

    // Configurações padrão
    const temperature = settings.temperature ?? 0.7;
    const maxTokens = settings.max_tokens ?? 1000;
    const responseDelay = settings.response_delay_seconds ?? 0;
    
    console.log('🎛️ Configurações de IA:', { temperature, maxTokens, responseDelay });
    
    // Buscar configuração de API do cliente
    const { data: aiConfig, error: configError } = await supabase
      .from('client_ai_configs')
      .select('*')
      .eq('client_id', assistant.client_id)
      .single();

    if (configError || !aiConfig) {
      console.error('❌ Configuração de IA não encontrada:', configError);
      throw new Error('Configuração de IA não encontrada para este cliente');
    }

    console.log('🔑 Configuração de API encontrada');

    let processedText = messageText;

    // Processar áudio se necessário
    if (isAudioMessage && settings.audio_processing_enabled) {
      console.log('🎵 Processando mensagem de áudio...');
      try {
        const speechResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/speech-to-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            audio: messageText,
            openaiApiKey: aiConfig.openai_api_key
          })
        });

        const speechResult = await speechResponse.json();
        if (speechResult.error) {
          console.error('❌ Erro na transcrição:', speechResult.error);
        } else {
          processedText = speechResult.text;
          console.log('🎵 Áudio transcrito:', processedText);
        }
      } catch (error) {
        console.error('❌ Erro ao processar áudio:', error);
      }
    }

    // Simular delay de processamento se configurado
    if (responseDelay > 0) {
      console.log(`⏳ Aguardando ${responseDelay}s antes de processar...`);
      await new Promise(resolve => setTimeout(resolve, responseDelay * 1000));
    }

    // Mostrar indicador de digitação
    if (settings.typing_indicator_enabled !== false) {
      console.log('⌨️ Mostrando indicador de digitação...');
      await supabase
        .from('whatsapp_chats')
        .upsert({
          chat_id: chatId,
          instance_id: instanceId,
          is_typing: true,
          typing_started_at: new Date().toISOString()
        }, {
          onConflict: 'chat_id,instance_id'
        });
    }

    // Construir prompt do sistema
    let systemMessage = assistant.prompt || 'Você é um assistente virtual útil e prestativo.';
    if (settings.custom_files?.length > 0) {
      systemMessage += `\n\nArquivos de referência disponíveis: ${settings.custom_files.map((f: any) => f.name).join(', ')}`;
    }

    console.log('🤖 Processando com OpenAI...');

    // Processar com OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.openai_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: assistant.model || 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: systemMessage
          },
          { role: 'user', content: processedText }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      }),
    });

    const aiResult = await openaiResponse.json();
    
    if (aiResult.error) {
      console.error('❌ Erro da OpenAI:', aiResult.error);
      throw new Error(`Erro da OpenAI: ${aiResult.error.message}`);
    }

    if (!aiResult.choices || !aiResult.choices[0]) {
      console.error('❌ Resposta inválida da OpenAI:', aiResult);
      throw new Error('Resposta inválida da OpenAI');
    }

    console.log('✅ Resposta da OpenAI recebida');

    const responseText = aiResult.choices[0].message.content;

    // Remover indicador de digitação
    if (settings.typing_indicator_enabled !== false) {
      console.log('⌨️ Removendo indicador de digitação...');
      await supabase
        .from('whatsapp_chats')
        .update({
          is_typing: false,
          typing_started_at: null
        })
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId);
    }

    let finalResponse = responseText;
    let isAudioResponse = false;

    // Processar voz clonada se habilitada
    if (settings.voice_cloning_enabled && settings.eleven_labs_api_key && settings.eleven_labs_voice_id) {
      console.log('🎤 Gerando resposta em áudio...');
      
      if (settings.recording_indicator_enabled) {
        await supabase
          .from('whatsapp_chats')
          .update({
            is_recording: true
          })
          .eq('chat_id', chatId)
          .eq('instance_id', instanceId);
      }

      try {
        const ttsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/text-to-speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            text: responseText,
            voiceId: settings.eleven_labs_voice_id,
            apiKey: settings.eleven_labs_api_key
          })
        });

        const ttsResult = await ttsResponse.json();
        if (!ttsResult.error && ttsResult.audioBase64) {
          finalResponse = ttsResult.audioBase64;
          isAudioResponse = true;
          console.log('🎤 Áudio gerado com sucesso');
        } else {
          console.error('❌ Erro ao gerar áudio:', ttsResult.error);
        }
      } catch (error) {
        console.error('❌ Erro ao processar TTS:', error);
      }

      if (settings.recording_indicator_enabled) {
        await supabase
          .from('whatsapp_chats')
          .update({
            is_recording: false
          })
          .eq('chat_id', chatId)
          .eq('instance_id', instanceId);
      }
    }

    console.log('✅ Processamento concluído com sucesso');

    return new Response(JSON.stringify({ 
      response: finalResponse,
      isAudio: isAudioResponse,
      processed: true,
      success: true,
      settings: {
        temperature,
        maxTokens,
        model: assistant.model || 'gpt-4o-mini'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in ai-assistant-process function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
