
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

// Função para processar padrões de áudio na resposta
function processAudioPatterns(text: string, audioLibrary: any[] = []) {
  console.log('🎵 ===== PROCESSANDO PADRÕES DE ÁUDIO =====');
  console.log('📝 Texto original:', text.substring(0, 200));
  console.log('📚 Biblioteca de áudios:', audioLibrary.length, 'itens');
  
  const patterns = {
    elevenlabs: /audio:\s*(.+?)(?=\n|$)/gi,
    library: /audiogeonomedoaudio:\s*(.+?)(?=\n|$)/gi
  };
  
  const audioInstructions = [];
  let processedText = text;
  
  // Detectar padrão ElevenLabs (audio:)
  const elevenLabsMatches = [...text.matchAll(patterns.elevenlabs)];
  console.log('🔍 Padrões ElevenLabs encontrados:', elevenLabsMatches.length);
  
  for (const match of elevenLabsMatches) {
    const fullMatch = match[0];
    const audioText = match[1].trim();
    
    console.log('🎤 Texto para ElevenLabs:', audioText);
    
    audioInstructions.push({
      type: 'elevenlabs',
      text: audioText,
      originalMatch: fullMatch
    });
    
    // Remover o padrão do texto
    processedText = processedText.replace(fullMatch, `[Áudio: ${audioText.substring(0, 50)}${audioText.length > 50 ? '...' : ''}]`);
  }
  
  // Detectar padrão biblioteca (audiogeonomedoaudio:)
  const libraryMatches = [...text.matchAll(patterns.library)];
  console.log('📚 Padrões de biblioteca encontrados:', libraryMatches.length);
  
  for (const match of libraryMatches) {
    const fullMatch = match[0];
    const trigger = match[1].trim();
    
    console.log('🔍 Procurando trigger na biblioteca:', trigger);
    
    // Buscar na biblioteca
    const audioItem = audioLibrary.find(item => 
      item.trigger === trigger || 
      item.trigger === `audiogeonomedoaudio${trigger}` ||
      item.name.toLowerCase().includes(trigger.toLowerCase())
    );
    
    if (audioItem) {
      console.log('✅ Áudio encontrado na biblioteca:', audioItem.name);
      audioInstructions.push({
        type: 'library',
        audioItem: audioItem,
        originalMatch: fullMatch
      });
      
      processedText = processedText.replace(fullMatch, `[Áudio da biblioteca: ${audioItem.name}]`);
    } else {
      console.log('❌ Áudio não encontrado na biblioteca para trigger:', trigger);
      processedText = processedText.replace(fullMatch, `[Áudio não encontrado: ${trigger}]`);
    }
  }
  
  console.log('📊 Resultado do processamento:', {
    audioInstructions: audioInstructions.length,
    processedText: processedText.substring(0, 200),
    hasElevenLabs: audioInstructions.some(a => a.type === 'elevenlabs'),
    hasLibrary: audioInstructions.some(a => a.type === 'library')
  });
  
  return {
    processedText,
    audioInstructions,
    hasAudio: audioInstructions.length > 0
  };
}

// Função para enviar áudio via WhatsApp
async function sendAudioToWhatsApp(clientId: string, chatId: string, audioBase64: string, audioText: string) {
  try {
    console.log('📤 ===== ENVIANDO ÁUDIO PARA WHATSAPP =====');
    console.log('📱 Parâmetros:', {
      clientId: clientId.substring(0, 8) + '...',
      chatId: chatId.substring(0, 20) + '...',
      audioSize: audioBase64.length,
      textPreview: audioText.substring(0, 50)
    });

    // Converter base64 para blob
    const byteCharacters = atob(audioBase64);
    const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
    const byteArray = new Uint8Array(byteNumbers);
    const audioBlob = new Blob([byteArray], { type: 'audio/mpeg' });

    // Criar FormData para envio
    const formData = new FormData();
    formData.append('to', chatId);
    formData.append('file', audioBlob, 'audio.mp3');
    
    // Adicionar caption se houver texto
    if (audioText && audioText.trim()) {
      formData.append('caption', audioText);
    }

    // URL CORRIGIDA: Usar porta 4000 ao invés de 3333
    const whatsappApiUrl = `http://localhost:4000/api/clients/${clientId}/send-audio`;
    console.log('🌐 URL da API WhatsApp (CORRIGIDA):', whatsappApiUrl);

    // Tentar enviar via API do WhatsApp Multi-Client com timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido');
      console.error('❌ Erro HTTP ao enviar áudio via WhatsApp API:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      console.error('❌ Erro na resposta da API WhatsApp:', result);
      throw new Error(result.error || 'Falha na API do WhatsApp');
    }

    console.log('✅ Áudio enviado com sucesso via WhatsApp:', {
      messageId: result.messageId,
      status: result.status
    });

    return result;
  } catch (error) {
    console.error('❌ ERRO CRÍTICO ao enviar áudio para WhatsApp:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Adicionar mais contexto para debugging
    if (error.name === 'AbortError') {
      console.error('❌ Timeout ao enviar áudio - servidor WhatsApp pode estar offline');
    } else if (error.message.includes('Failed to fetch')) {
      console.error('❌ Falha na conexão - verificar se servidor WhatsApp está rodando na porta 4000');
    }
    
    throw error;
  }
}

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

    console.log('🔍 ===== PROCESSAMENTO EDGE FUNCTION =====');
    console.log('📨 Dados recebidos:', {
      assistantId,
      chatId,
      instanceId,
      messageLength: messageText?.length,
      isAudio: isAudioMessage
    });

    // BUSCAR ASSISTENTE
    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .select('*, advanced_settings')
      .eq('id', assistantId)
      .single();

    if (assistantError || !assistant) {
      console.error('❌ ASSISTENTE não encontrado:', assistantError);
      throw new Error('Assistente não encontrado');
    }

    console.log('✅ ASSISTENTE encontrado:', assistant.name);

    // PARSE CONFIGURAÇÕES AVANÇADAS
    let settings: any = {};
    try {
      settings = assistant.advanced_settings ? 
        (typeof assistant.advanced_settings === 'string' ? 
          JSON.parse(assistant.advanced_settings) : assistant.advanced_settings) : {};
    } catch (error) {
      console.error('❌ ERRO ao fazer parse das configurações:', error);
      settings = {};
    }

    const temperature = settings.temperature ?? 0.7;
    const maxTokens = settings.max_tokens ?? 1000;
    const audioLibrary = settings.audio_library || [];
    
    console.log('🎛️ CONFIGURAÇÕES IA:', { 
      temperature, 
      maxTokens, 
      audioLibrarySize: audioLibrary.length,
      hasElevenLabsConfig: !!(settings.eleven_labs_api_key && settings.eleven_labs_voice_id)
    });
    
    // BUSCAR CONFIG AI DO CLIENTE
    const { data: aiConfig, error: configError } = await supabase
      .from('client_ai_configs')
      .select('*')
      .eq('client_id', assistant.client_id)
      .single();

    if (configError || !aiConfig) {
      console.error('❌ CONFIG IA não encontrada:', configError);
      throw new Error('Configuração de IA não encontrada para este cliente');
    }

    console.log('🔑 CONFIG API encontrada');

    let processedText = messageText;

    // PROCESSAMENTO DE ÁUDIO SE HABILITADO
    if (isAudioMessage && settings.audio_processing_enabled) {
      console.log('🎵 PROCESSANDO mensagem de áudio...');
      
      const speechResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/speech-to-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: messageText,
          openaiApiKey: aiConfig.openai_api_key
        })
      });

      const speechResult = await speechResponse.json();
      if (speechResult.error) {
        throw new Error(`Erro na transcrição: ${speechResult.error}`);
      }
      processedText = speechResult.text;
      console.log('🎵 ÁUDIO transcrito:', processedText);
    }

    // MARCAR INÍCIO DO PROCESSAMENTO
    if (messageId) {
      await supabase
        .from('whatsapp_messages')
        .update({
          processing_started_at: new Date().toISOString(),
          is_processed: false
        })
        .eq('message_id', messageId);
    }

    // DELAY DE RESPOSTA SE CONFIGURADO
    if (settings.response_delay_seconds > 0) {
      console.log(`⏳ AGUARDANDO ${settings.response_delay_seconds}s...`);
      await new Promise(resolve => setTimeout(resolve, settings.response_delay_seconds * 1000));
    }

    // INDICADOR DE DIGITAÇÃO
    if (settings.typing_indicator_enabled && chatId && instanceId) {
      console.log('⌨️ MOSTRANDO indicador de digitação...');
      await supabase
        .from('whatsapp_chats')
        .update({
          is_typing: true,
          typing_started_at: new Date().toISOString()
        })
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId);
    }

    // CONSTRUIR PROMPT DO SISTEMA
    let systemMessage = assistant.prompt;
    if (settings.custom_files?.length > 0) {
      systemMessage += `\n\nArquivos de referência disponíveis: ${settings.custom_files.map((f: any) => f.name).join(', ')}`;
    }

    // ADICIONAR INSTRUÇÕES DE ÁUDIO AO PROMPT
    if (settings.voice_cloning_enabled || audioLibrary.length > 0) {
      systemMessage += `\n\nINSTRUÇÕES DE ÁUDIO:`;
      
      if (settings.voice_cloning_enabled) {
        systemMessage += `\n- Para responder com áudio gerado por IA, use: audio: [sua resposta]`;
      }
      
      if (audioLibrary.length > 0) {
        systemMessage += `\n- Para usar áudios pré-gravados, use: audiogeonomedoaudio: [trigger]`;
        systemMessage += `\n- Áudios disponíveis: ${audioLibrary.map((a: any) => `${a.trigger} (${a.name})`).join(', ')}`;
      }
    }

    console.log('🤖 PROCESSANDO com OpenAI...');
    console.log('📊 PARÂMETROS:', {
      model: assistant.model || aiConfig.default_model || 'gpt-4o-mini',
      temperature,
      max_tokens: maxTokens,
      promptLength: systemMessage.length,
      messageLength: processedText.length
    });

    // CHAMAR OPENAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.openai_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: assistant.model || aiConfig.default_model || 'gpt-4o-mini',
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
      console.error('❌ ERRO da OpenAI:', aiResult.error);
      throw new Error(`Erro da OpenAI: ${aiResult.error.message}`);
    }

    console.log('✅ RESPOSTA da OpenAI recebida');

    const responseText = aiResult.choices[0].message.content;

    // PROCESSAR PADRÕES DE ÁUDIO NA RESPOSTA
    const audioProcessing = processAudioPatterns(responseText, audioLibrary);
    let finalResponse = audioProcessing.processedText;
    let audioResponses = [];

    // PROCESSAR INSTRUÇÕES DE ÁUDIO
    if (audioProcessing.hasAudio) {
      console.log('🎵 ===== PROCESSANDO INSTRUÇÕES DE ÁUDIO =====');
      
      for (const instruction of audioProcessing.audioInstructions) {
        try {
          if (instruction.type === 'elevenlabs' && settings.voice_cloning_enabled) {
            console.log('🎤 GERANDO áudio com ElevenLabs:', instruction.text);
            
            const ttsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/text-to-speech`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: instruction.text,
                voiceId: settings.eleven_labs_voice_id,
                apiKey: settings.eleven_labs_api_key,
                model: settings.eleven_labs_model || 'eleven_multilingual_v2',
                voiceSettings: settings.voice_settings
              })
            });

            const ttsResult = await ttsResponse.json();
            if (!ttsResult.error && ttsResult.success) {
              console.log('✅ Áudio ElevenLabs gerado com sucesso');
              console.log('📊 Detalhes do áudio:', {
                audioSizeBytes: ttsResult.audioSizeBytes,
                base64Length: ttsResult.audioBase64?.length || 0
              });
              
              // ENVIAR ÁUDIO PARA WHATSAPP COM MELHOR TRATAMENTO DE ERRO
              try {
                console.log('📤 Iniciando envio para WhatsApp...');
                await sendAudioToWhatsApp(
                  assistant.client_id, 
                  chatId, 
                  ttsResult.audioBase64, 
                  instruction.text
                );
                
                audioResponses.push({
                  type: 'elevenlabs',
                  text: instruction.text,
                  sent: true,
                  sentAt: new Date().toISOString(),
                  audioSizeBytes: ttsResult.audioSizeBytes
                });
                
                console.log('✅ Áudio enviado com sucesso para WhatsApp');
              } catch (whatsappError) {
                console.error('❌ Falha ao enviar áudio para WhatsApp:', {
                  error: whatsappError.message,
                  instruction: instruction.text.substring(0, 50),
                  clientId: assistant.client_id
                });
                
                // Fallback: salvar como resposta com erro
                audioResponses.push({
                  type: 'elevenlabs',
                  audioBase64: ttsResult.audioBase64,
                  text: instruction.text,
                  sent: false,
                  error: whatsappError.message,
                  sentAt: new Date().toISOString()
                });
                
                // Adicionar mensagem de erro ao texto final
                finalResponse += `\n\n⚠️ Erro ao enviar áudio: ${whatsappError.message}`;
              }
            } else {
              console.error('❌ Erro ao gerar áudio ElevenLabs:', ttsResult.error);
              finalResponse += `\n\n⚠️ Erro ao gerar áudio: ${ttsResult.error}`;
            }
            
          } else if (instruction.type === 'library' && instruction.audioItem) {
            console.log('📚 USANDO áudio da biblioteca:', instruction.audioItem.name);
            
            audioResponses.push({
              type: 'library',
              audioUrl: instruction.audioItem.url,
              audioName: instruction.audioItem.name,
              sent: false
            });
          }
        } catch (audioError) {
          console.error('❌ Erro no processamento de áudio:', audioError);
          finalResponse += `\n\n⚠️ Erro no processamento de áudio: ${audioError.message}`;
        }
      }
    }

    // REMOVER INDICADOR DE DIGITAÇÃO
    if (settings.typing_indicator_enabled && chatId && instanceId) {
      console.log('⌨️ REMOVENDO indicador de digitação...');
      await supabase
        .from('whatsapp_chats')
        .update({
          is_typing: false,
          typing_started_at: null
        })
        .eq('chat_id', chatId)
        .eq('instance_id', instanceId);
    }

    // MARCAR MENSAGEM COMO PROCESSADA
    if (messageId) {
      await supabase
        .from('whatsapp_messages')
        .update({
          is_processed: true
        })
        .eq('message_id', messageId);
    }

    console.log('✅ PROCESSAMENTO concluído');
    console.log('📤 RESPOSTA final:', {
      textLength: finalResponse.length,
      audioCount: audioResponses.length,
      hasText: !!finalResponse.trim(),
      hasAudio: audioResponses.length > 0,
      audiosSentToWhatsApp: audioResponses.filter(a => a.sent).length,
      audiosWithError: audioResponses.filter(a => !a.sent && a.error).length
    });

    return new Response(JSON.stringify({ 
      response: finalResponse,
      audioResponses: audioResponses,
      hasAudio: audioResponses.length > 0,
      processed: true,
      settings: {
        temperature,
        maxTokens,
        model: assistant.model || aiConfig.default_model || 'gpt-4o-mini'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ ERRO CRÍTICO na função edge:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
