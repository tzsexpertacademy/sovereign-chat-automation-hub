
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

    // Buscar configurações do assistente
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('*, advanced_settings')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      throw new Error('Assistente não encontrado');
    }

    const settings = assistant.advanced_settings || {};
    
    // Buscar configuração de API do cliente
    const { data: aiConfig, error: configError } = await supabase
      .from('client_ai_configs')
      .select('*')
      .eq('client_id', assistant.client_id)
      .single();

    if (configError || !aiConfig) {
      throw new Error('Configuração de IA não encontrada');
    }

    let processedText = messageText;

    // Se for mensagem de áudio e processamento de áudio estiver habilitado
    if (isAudioMessage && settings.audio_processing_enabled) {
      const speechResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/speech-to-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: messageText, // base64 audio
          openaiApiKey: aiConfig.openai_api_key
        })
      });

      const speechResult = await speechResponse.json();
      if (speechResult.error) {
        throw new Error(`Erro na transcrição: ${speechResult.error}`);
      }
      processedText = speechResult.text;
    }

    // Marcar início do processamento
    await supabase
      .from('whatsapp_messages')
      .update({
        processing_started_at: new Date().toISOString(),
        is_processed: false
      })
      .eq('message_id', messageId);

    // Simular delay de processamento
    if (settings.response_delay_seconds > 0) {
      await new Promise(resolve => setTimeout(resolve, settings.response_delay_seconds * 1000));
    }

    // Mostrar indicador de digitação se habilitado
    if (settings.typing_indicator_enabled) {
      await supabase
        .from('whatsapp_chats')
        .update({
          is_typing: true,
          typing_started_at: new Date().toISOString()
        })
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId);
    }

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
            content: assistant.prompt + (settings.custom_files?.length > 0 ? 
              `\n\nArquivos de referência: ${settings.custom_files.map((f: any) => f.name).join(', ')}` : '')
          },
          { role: 'user', content: processedText }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }),
    });

    const aiResult = await openaiResponse.json();
    if (aiResult.error) {
      throw new Error(`Erro da OpenAI: ${aiResult.error.message}`);
    }

    const responseText = aiResult.choices[0].message.content;

    // Remover indicador de digitação
    if (settings.typing_indicator_enabled) {
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

    // Se voz clonada estiver habilitada
    if (settings.voice_cloning_enabled && settings.eleven_labs_api_key && settings.eleven_labs_voice_id) {
      // Mostrar indicador de gravação se habilitado
      if (settings.recording_indicator_enabled) {
        await supabase
          .from('whatsapp_chats')
          .update({
            is_recording: true
          })
          .eq('chat_id', chatId)
          .eq('instance_id', instanceId);
      }

      const ttsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: responseText,
          voiceId: settings.eleven_labs_voice_id,
          apiKey: settings.eleven_labs_api_key
        })
      });

      const ttsResult = await ttsResponse.json();
      if (!ttsResult.error) {
        finalResponse = ttsResult.audioBase64;
        isAudioResponse = true;
      }

      // Remover indicador de gravação
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

    // Marcar mensagem como processada
    await supabase
      .from('whatsapp_messages')
      .update({
        is_processed: true
      })
      .eq('message_id', messageId);

    return new Response(JSON.stringify({ 
      response: finalResponse,
      isAudio: isAudioResponse,
      processed: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-assistant-process function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
