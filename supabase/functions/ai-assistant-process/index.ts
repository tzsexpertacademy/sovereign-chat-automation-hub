
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

// Função para detectar URL do servidor WhatsApp baseado no ambiente
function getWhatsAppServerUrl(): string {
  // Tentar detectar se está em produção ou desenvolvimento
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  
  if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
    // Ambiente de desenvolvimento
    return 'http://localhost:4000';
  } else {
    // Ambiente de produção - usar IP fixo detectado nas imagens
    return 'http://146.59.227.248:4000';
  }
}

// Função CORRIGIDA para enviar áudio via WhatsApp
async function sendAudioToWhatsApp(clientId: string, chatId: string, audioBase64: string, audioText: string) {
  try {
    console.log('📤 ===== ENVIANDO ÁUDIO PARA WHATSAPP (VERSÃO CORRIGIDA) =====');
    
    const serverUrl = getWhatsAppServerUrl();
    console.log('🌐 URL do servidor WhatsApp detectada:', serverUrl);
    
    console.log('📱 Parâmetros de envio:', {
      clientId: clientId.substring(0, 8) + '...',
      chatId: chatId.substring(0, 20) + '...',
      audioSize: audioBase64.length,
      textPreview: audioText.substring(0, 50),
      serverUrl
    });

    // STEP 1: Verificar se o servidor WhatsApp está respondendo
    console.log('🔍 STEP 1: Testando conexão com servidor WhatsApp...');
    try {
      const healthResponse = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!healthResponse.ok) {
        throw new Error(`Servidor WhatsApp não está respondendo: ${healthResponse.status}`);
      }
      
      const healthData = await healthResponse.json();
      console.log('✅ Servidor WhatsApp está online:', healthData);
    } catch (healthError) {
      console.error('❌ ERRO: Servidor WhatsApp não está acessível:', healthError.message);
      throw new Error(`Servidor WhatsApp não está acessível: ${healthError.message}`);
    }

    // STEP 2: Verificar status do cliente
    console.log('🔍 STEP 2: Verificando status do cliente WhatsApp...');
    try {
      const statusResponse = await fetch(`${serverUrl}/api/clients/${clientId}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!statusResponse.ok) {
        const statusError = await statusResponse.text();
        throw new Error(`Status do cliente falhou: ${statusResponse.status} - ${statusError}`);
      }
      
      const statusData = await statusResponse.json();
      console.log('📊 Status do cliente:', statusData);
      
      if (!statusData.success || statusData.status !== 'connected') {
        throw new Error(`Cliente WhatsApp não está conectado. Status: ${statusData.status}`);
      }
    } catch (statusError) {
      console.error('❌ ERRO: Problema com status do cliente:', statusError.message);
      throw new Error(`Cliente não está conectado: ${statusError.message}`);
    }

    // STEP 3: Preparar e enviar áudio
    console.log('🔍 STEP 3: Preparando envio do áudio...');
    
    // Converter base64 para bytes
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Criar blob do áudio
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
    console.log('🎵 Áudio convertido para blob:', {
      size: audioBlob.size,
      type: audioBlob.type
    });

    // Criar FormData
    const formData = new FormData();
    formData.append('to', chatId);
    formData.append('file', audioBlob, 'audio_message.mp3');
    
    // Adicionar caption se houver texto
    if (audioText && audioText.trim()) {
      formData.append('caption', audioText.trim());
    }

    console.log('📤 Enviando FormData para endpoint send-audio...');
    
    // URL corrigida para o endpoint de áudio
    const audioEndpointUrl = `${serverUrl}/api/clients/${clientId}/send-audio`;
    console.log('🎯 URL do endpoint:', audioEndpointUrl);

    // Enviar com timeout aumentado
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos

    const response = await fetch(audioEndpointUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      // NÃO definir Content-Type - deixar o browser definir para FormData
    });

    clearTimeout(timeoutId);

    console.log('📡 Resposta do servidor WhatsApp:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido');
      console.error('❌ Erro HTTP ao enviar áudio:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: audioEndpointUrl
      });
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('📨 Resposta JSON do servidor:', result);

    if (!result.success) {
      console.error('❌ Erro na resposta da API WhatsApp:', result);
      throw new Error(result.error || 'Falha na API do WhatsApp');
    }

    console.log('✅ ===== ÁUDIO ENVIADO COM SUCESSO =====');
    console.log('🎉 Detalhes do sucesso:', {
      messageId: result.messageId || result.id,
      status: result.status,
      timestamp: new Date().toISOString()
    });

    return result;
    
  } catch (error) {
    console.error('❌ ===== ERRO CRÍTICO NO ENVIO DE ÁUDIO =====');
    console.error('💥 Detalhes do erro:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    // Categorizar tipos de erro para melhor debugging
    if (error.name === 'AbortError') {
      console.error('⏰ TIMEOUT: Servidor WhatsApp demorou para responder');
    } else if (error.message.includes('Failed to fetch')) {
      console.error('🔌 CONEXÃO: Não foi possível conectar ao servidor WhatsApp');
    } else if (error.message.includes('não está conectado')) {
      console.error('📱 CLIENTE: WhatsApp não está autenticado/conectado');
    } else if (error.message.includes('HTTP')) {
      console.error('🌐 API: Erro na API do servidor WhatsApp');
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
              
              // ENVIAR ÁUDIO PARA WHATSAPP COM VERSÃO CORRIGIDA
              try {
                console.log('📤 Iniciando envio para WhatsApp com versão corrigida...');
                const whatsappResult = await sendAudioToWhatsApp(
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
                  audioSizeBytes: ttsResult.audioSizeBytes,
                  whatsappMessageId: whatsappResult.messageId || whatsappResult.id
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
