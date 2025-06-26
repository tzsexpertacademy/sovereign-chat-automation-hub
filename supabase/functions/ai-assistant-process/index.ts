
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
    
    // Remover o padrão do texto - NÃO substituir por placeholder
    processedText = processedText.replace(fullMatch, '');
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
      
      processedText = processedText.replace(fullMatch, '');
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
    processedText: processedText.trim(),
    audioInstructions,
    hasAudio: audioInstructions.length > 0
  };
}

// FUNÇÃO COMPLETAMENTE REESCRITA PARA DETECÇÃO INTELIGENTE DO SERVIDOR
async function getWhatsAppServerUrl(): Promise<string> {
  console.log('🌐 ===== DETECÇÃO INTELIGENTE DO SERVIDOR WHATSAPP =====');
  
  const candidates = [
    'http://localhost:4000',    // Ambiente local
    'http://127.0.0.1:4000',   // Alternativa local
    'http://146.59.227.248:4000' // Servidor de produção
  ];
  
  for (const url of candidates) {
    try {
      console.log(`🔍 Testando conectividade: ${url}`);
      
      const healthResponse = await fetch(`${url}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5s timeout
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log(`✅ Servidor encontrado em: ${url}`, healthData);
        return url;
      }
      
      console.log(`❌ Servidor ${url} não respondeu: HTTP ${healthResponse.status}`);
    } catch (error) {
      console.log(`❌ Falha ao conectar ${url}:`, error.message);
    }
  }
  
  // Fallback para produção se nenhum servidor responder
  const fallbackUrl = 'http://146.59.227.248:4000';
  console.log(`⚠️ Usando fallback: ${fallbackUrl}`);
  return fallbackUrl;
}

// FUNÇÃO COMPLETAMENTE REESCRITA PARA CORRIGIR O PROBLEMA DE FORMATO DE ÁUDIO
async function sendAudioToWhatsApp(clientId: string, chatId: string, audioBase64: string, audioText: string) {
  try {
    console.log('🎵 ===== ENVIANDO ÁUDIO MP3 PARA WHATSAPP (VERSÃO INTELIGENTE) =====');
    
    const serverUrl = await getWhatsAppServerUrl();
    console.log('🌐 URL do servidor WhatsApp detectado:', serverUrl);
    
    console.log('📊 Parâmetros de envio:', {
      clientId: clientId.substring(0, 8) + '...',
      chatId: chatId.substring(0, 20) + '...',
      audioSize: audioBase64.length,
      textPreview: audioText.substring(0, 50),
      serverUrl
    });

    // FASE 1: VALIDAÇÃO COMPLETA DO SERVIDOR WHATSAPP
    console.log('🔍 FASE 1: Validando servidor WhatsApp...');
    try {
      const healthResponse = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      
      if (!healthResponse.ok) {
        throw new Error(`Servidor WhatsApp offline: HTTP ${healthResponse.status}`);
      }
      
      const healthData = await healthResponse.json();
      console.log('✅ Servidor WhatsApp online:', healthData);
    } catch (healthError) {
      console.error('❌ ERRO CRÍTICO: Servidor WhatsApp inacessível:', healthError.message);
      throw new Error(`Servidor WhatsApp não responde: ${healthError.message}`);
    }

    // FASE 2: VALIDAÇÃO DO STATUS DO CLIENTE
    console.log('🔍 FASE 2: Validando cliente WhatsApp...');
    try {
      const statusResponse = await fetch(`${serverUrl}/api/clients/${clientId}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!statusResponse.ok) {
        const statusError = await statusResponse.text();
        throw new Error(`Cliente inválido: HTTP ${statusResponse.status} - ${statusError}`);
      }
      
      const statusData = await statusResponse.json();
      console.log('📊 Status do cliente:', statusData);
      
      if (!statusData.success || statusData.status !== 'connected') {
        throw new Error(`Cliente não conectado. Status atual: ${statusData.status || 'desconhecido'}`);
      }
    } catch (statusError) {
      console.error('❌ ERRO: Cliente WhatsApp não conectado:', statusError.message);
      throw new Error(`Cliente WhatsApp falhou: ${statusError.message}`);
    }

    // FASE 3: PREPARAÇÃO CORRETA DO ÁUDIO MP3
    console.log('🔍 FASE 3: Preparando áudio MP3 corretamente...');
    
    // Validar se é base64 válido
    if (!/^[A-Za-z0-9+/=]+$/.test(audioBase64)) {
      throw new Error('Dados de áudio base64 inválidos');
    }
    
    // Converter base64 para bytes de forma robusta
    let audioBytes: Uint8Array;
    try {
      const binaryString = atob(audioBase64);
      audioBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        audioBytes[i] = binaryString.charCodeAt(i);
      }
      console.log('✅ Áudio convertido para bytes:', audioBytes.length, 'bytes');
    } catch (decodeError) {
      console.error('❌ Erro ao decodificar base64:', decodeError);
      throw new Error('Falha ao decodificar dados de áudio base64');
    }
    
    // CORREÇÃO CRÍTICA: Criar blob MP3 com mimetype correto
    const audioBlob = new Blob([audioBytes], { 
      type: 'audio/mpeg' // MP3 correto, não OGG
    });
    console.log('🎵 Blob MP3 criado:', {
      size: audioBlob.size,
      type: audioBlob.type,
      isValidSize: audioBlob.size > 1000 // Pelo menos 1KB
    });

    if (audioBlob.size < 100) {
      throw new Error('Arquivo de áudio muito pequeno (possível corrupção)');
    }

    // FASE 4: CRIAÇÃO DO FORMDATA COM FORMATO CORRETO
    console.log('🔍 FASE 4: Criando FormData para MP3...');
    const formData = new FormData();
    formData.append('to', chatId);
    formData.append('file', audioBlob, 'voice_message.mp3');
    
    // Adicionar caption se houver
    if (audioText && audioText.trim()) {
      formData.append('caption', audioText.trim());
      console.log('📝 Caption adicionada:', audioText.trim());
    }

    // LOGS DETALHADOS PARA DEBUG
    console.log('📤 FormData preparado:', {
      to: chatId,
      fileName: 'voice_message.mp3',
      fileSize: audioBlob.size,
      fileType: audioBlob.type,
      hasCaption: !!(audioText && audioText.trim())
    });

    // FASE 5: ENVIO COM TRATAMENTO ROBUSTO DE ERROS E RETRY
    console.log('🔍 FASE 5: Enviando para WhatsApp com retry...');
    
    const audioEndpointUrl = `${serverUrl}/api/clients/${clientId}/send-audio`;
    console.log('🎯 Endpoint completo:', audioEndpointUrl);

    let lastError: Error | null = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Tentativa ${attempt}/${maxRetries} de envio...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos

        const response = await fetch(audioEndpointUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log('📡 Resposta do servidor:', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          attempt: attempt
        });

        if (!response.ok) {
          let errorDetails;
          const contentType = response.headers.get('content-type') || '';
          
          try {
            if (contentType.includes('application/json')) {
              errorDetails = await response.json();
            } else {
              errorDetails = await response.text();
            }
          } catch {
            errorDetails = 'Erro desconhecido do servidor';
          }
          
          const errorMessage = `HTTP ${response.status}: ${JSON.stringify(errorDetails)}`;
          console.error(`❌ Tentativa ${attempt} falhou:`, errorMessage);
          
          if (attempt === maxRetries) {
            throw new Error(errorMessage);
          }
          
          // Aguardar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        // PROCESSAMENTO DA RESPOSTA DE SUCESSO
        let result;
        try {
          result = await response.json();
          console.log('📨 Resposta JSON do servidor:', result);
        } catch (jsonError) {
          console.error('❌ Erro ao processar JSON da resposta:', jsonError);
          throw new Error('Resposta do servidor não é JSON válido');
        }

        if (!result.success) {
          console.error('❌ API WhatsApp retornou falha:', result);
          throw new Error(result.error || result.message || 'Falha na API do WhatsApp');
        }

        console.log('✅ ===== ÁUDIO MP3 ENVIADO COM SUCESSO =====');
        console.log('🎉 Detalhes do sucesso:', {
          messageId: result.messageId || result.id || result.data?.id,
          status: result.status,
          success: result.success,
          timestamp: new Date().toISOString(),
          audioFormat: 'MP3',
          audioSize: audioBlob.size,
          attempt: attempt
        });

        return {
          success: true,
          messageId: result.messageId || result.id || result.data?.id,
          status: result.status,
          audioFormat: 'MP3',
          audioSize: audioBlob.size,
          attempt: attempt,
          ...result
        };
        
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Tentativa ${attempt} falhou:`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`🔄 Aguardando ${attempt}s antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    throw lastError || new Error('Todas as tentativas de envio falharam');
    
  } catch (error) {
    console.error('❌ ===== ERRO CRÍTICO NO ENVIO DE ÁUDIO MP3 =====');
    console.error('💥 Detalhes completos do erro:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Categorização detalhada de erros para debugging
    if (error.name === 'AbortError') {
      console.error('⏰ TIMEOUT: Servidor demorou mais que 2 minutos');
      throw new Error('Timeout: Servidor WhatsApp não respondeu em tempo hábil');
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      console.error('🔌 REDE: Problema de conectividade');
      throw new Error('Erro de rede: Não foi possível conectar ao servidor WhatsApp');
    } else if (error.message.includes('não conectado') || error.message.includes('not connected')) {
      console.error('📱 CLIENTE: WhatsApp desconectado');
      throw new Error('Cliente WhatsApp não está conectado ou autenticado');
    } else if (error.message.includes('HTTP') || error.message.includes('servidor')) {
      console.error('🌐 SERVIDOR: Problema na API WhatsApp');
      throw new Error(`Erro no servidor WhatsApp: ${error.message}`);
    } else {
      console.error('❓ ERRO DESCONHECIDO:', error.message);
      throw new Error(`Erro inesperado: ${error.message}`);
    }
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
            console.log('🎤 GERANDO áudio MP3 com ElevenLabs:', instruction.text);
            
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
              console.log('✅ Áudio MP3 ElevenLabs gerado:', {
                audioSizeBytes: ttsResult.audioSizeBytes,
                base64Length: ttsResult.audioBase64?.length || 0,
                format: 'MP3'
              });
              
              // ENVIAR ÁUDIO PARA WHATSAPP COM FUNÇÃO CORRIGIDA
              try {
                console.log('📤 Enviando áudio MP3 para WhatsApp...');
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
                  audioFormat: 'MP3',
                  whatsappMessageId: whatsappResult.messageId,
                  whatsappResult: whatsappResult
                });
                
                console.log('✅ Áudio MP3 enviado com sucesso para WhatsApp:', whatsappResult.messageId);
              } catch (whatsappError) {
                console.error('❌ Falha ao enviar áudio MP3 para WhatsApp:', {
                  error: whatsappError.message,
                  instruction: instruction.text.substring(0, 50),
                  clientId: assistant.client_id,
                  audioFormat: 'MP3'
                });
                
                // NÃO adicionar erro ao texto final se é especificamente para áudio
                audioResponses.push({
                  type: 'elevenlabs',
                  text: instruction.text,
                  sent: false,
                  error: whatsappError.message,
                  sentAt: new Date().toISOString(),
                  audioFormat: 'MP3',
                  audioSizeBytes: ttsResult.audioSizeBytes
                });
              }
            } else {
              console.error('❌ Erro ao gerar áudio ElevenLabs:', ttsResult.error);
              audioResponses.push({
                type: 'elevenlabs',
                text: instruction.text,
                sent: false,
                error: ttsResult.error,
                sentAt: new Date().toISOString()
              });
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
          audioResponses.push({
            type: 'error',
            error: audioError.message,
            sentAt: new Date().toISOString()
          });
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
      audiosWithError: audioResponses.filter(a => !a.sent && a.error).length,
      audioFormat: 'MP3'
    });

    // Se há instruções de áudio mas o texto está vazio, não enviar texto
    const shouldSendText = finalResponse.trim().length > 0;

    return new Response(JSON.stringify({ 
      response: shouldSendText ? finalResponse : '',
      audioResponses: audioResponses,
      hasAudio: audioResponses.length > 0,
      processed: true,
      audioFormat: 'MP3',
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
