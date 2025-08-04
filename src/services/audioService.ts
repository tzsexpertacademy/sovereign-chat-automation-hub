
import { supabase } from "@/integrations/supabase/client";

export const audioService = {
  async convertSpeechToText(audioBase64: string, openaiApiKey: string): Promise<string> {
    console.log('🎵 ===== INICIANDO TRANSCRIÇÃO =====');
    console.log('📊 Parâmetros:', {
      hasAudio: !!audioBase64,
      audioLength: audioBase64.length,
      hasApiKey: !!openaiApiKey,
      apiKeyPreview: openaiApiKey ? openaiApiKey.substring(0, 20) + '...' : 'N/A'
    });
    
    try {
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: audioBase64,
          openaiApiKey
        }
      });

      console.log('📡 Resposta do Supabase Functions:', {
        hasData: !!data,
        hasError: !!error,
        errorDetails: error
      });

      if (error) {
        console.error('❌ Erro na transcrição (Supabase):', error);
        throw error;
      }
      
      if (data?.error) {
        console.error('❌ Erro retornado pela API:', data.error);
        throw new Error(data.error);
      }

      const transcriptionText = data?.text || '';
      console.log('✅ TRANSCRIÇÃO CONCLUÍDA:', {
        text: transcriptionText.substring(0, 100) + (transcriptionText.length > 100 ? '...' : ''),
        length: transcriptionText.length,
        language: data?.language,
        duration: data?.duration,
        audioFormat: data?.audioFormat,
        success: data?.success
      });
      
      if (!transcriptionText || transcriptionText.trim() === '') {
        console.warn('⚠️ Transcrição vazia - retornando mensagem de fallback');
        return '[Áudio não pôde ser transcrito - tente falar mais claramente]';
      }
      
      return transcriptionText;
    } catch (error) {
      console.error('❌ ERRO CRÍTICO na transcrição:', error);
      console.error('📋 Stack trace:', error.stack);
      throw new Error(`Falha na transcrição: ${error.message}`);
    }
  },

  async convertTextToSpeech(text: string, voiceId: string, apiKey: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('text-to-speech', {
      body: {
        text,
        voiceId,
        apiKey
      }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.audioBase64;
  },

  // NOVA VERSÃO SUPER ROBUSTA - EXTRAÇÃO DE DADOS DE ÁUDIO
  extractAudioDataFromMessage(message: any): { audioBase64: string; audioUrl: string } {
    console.log('🔍 ===== EXTRAINDO DADOS DE ÁUDIO (DEBUG TOTAL) =====');
    console.log('📱 ESTRUTURA COMPLETA DA MENSAGEM:', JSON.stringify(message, null, 2));
    
    let audioBase64 = '';
    let audioUrl = '';

    // ESTRATÉGIA 1: Propriedades diretas mais comuns
    const directProps = [
      'mediaData', 'data', 'audioData', 'content', 'media', 'base64', 'body64',
      'audioBase64', 'mediaBase64', 'fileData', 'buffer', 'audioBuffer'
    ];
    
    console.log('🔍 ESTRATÉGIA 1: Verificando propriedades diretas...');
    for (const prop of directProps) {
      if (message[prop] && typeof message[prop] === 'string' && message[prop].length > 100) {
        console.log(`✅ ENCONTRADO dados em message.${prop} (tamanho: ${message[prop].length})`);
        audioBase64 = message[prop];
        break;
      } else if (message[prop]) {
        console.log(`⚠️ Campo message.${prop} existe mas não é válido:`, typeof message[prop], message[prop]?.length);
      }
    }

    // ESTRATÉGIA 2: OriginalMessage
    if (!audioBase64 && message.originalMessage) {
      console.log('🔍 ESTRATÉGIA 2: Verificando originalMessage...');
      console.log('📱 ESTRUTURA originalMessage:', JSON.stringify(message.originalMessage, null, 2));
      
      for (const prop of directProps) {
        if (message.originalMessage[prop] && typeof message.originalMessage[prop] === 'string' && message.originalMessage[prop].length > 100) {
          console.log(`✅ ENCONTRADO dados em originalMessage.${prop} (tamanho: ${message.originalMessage[prop].length})`);
          audioBase64 = message.originalMessage[prop];
          break;
        } else if (message.originalMessage[prop]) {
          console.log(`⚠️ Campo originalMessage.${prop} existe mas não é válido:`, typeof message.originalMessage[prop], message.originalMessage[prop]?.length);
        }
      }
    }

    // ESTRATÉGIA 3: Nested objects (media, attachment, file, audio, etc)
    if (!audioBase64) {
      console.log('🔍 ESTRATÉGIA 3: Verificando objetos aninhados...');
      const nestedObjects = ['media', 'attachment', 'file', 'audio', '_data', 'quotedMessage'];
      
      for (const obj of nestedObjects) {
        if (message[obj] && typeof message[obj] === 'object') {
          console.log(`🔍 Verificando message.${obj}:`, JSON.stringify(message[obj], null, 2));
          
          for (const prop of directProps) {
            if (message[obj][prop] && typeof message[obj][prop] === 'string' && message[obj][prop].length > 100) {
              console.log(`✅ ENCONTRADO dados em message.${obj}.${prop} (tamanho: ${message[obj][prop].length})`);
              audioBase64 = message[obj][prop];
              break;
            } else if (message[obj][prop]) {
              console.log(`⚠️ Campo message.${obj}.${prop} existe mas não é válido:`, typeof message[obj][prop], message[obj][prop]?.length);
            }
          }
          if (audioBase64) break;
        }
      }
    }

    // ESTRATÉGIA 4: URL de mídia (múltiplas variações)
    console.log('🔍 ESTRATÉGIA 4: Verificando URLs de mídia...');
    const urlProps = [
      'mediaUrl', 'url', 'audioUrl', 'fileUrl', 'downloadUrl', 'mediaLink',
      'attachmentUrl', 'src', 'href', 'link', 'path'
    ];
    
    for (const prop of urlProps) {
      if (message[prop] && typeof message[prop] === 'string' && message[prop].includes('http')) {
        console.log(`✅ ENCONTRADO URL em message.${prop}: ${message[prop]}`);
        audioUrl = message[prop];
        break;
      } else if (message.originalMessage?.[prop] && typeof message.originalMessage[prop] === 'string' && message.originalMessage[prop].includes('http')) {
        console.log(`✅ ENCONTRADO URL em originalMessage.${prop}: ${message.originalMessage[prop]}`);
        audioUrl = message.originalMessage[prop];
        break;
      }
    }

    // ESTRATÉGIA 5: Verificar propriedades com hasMedia ou isMedia
    if (!audioBase64 && (message.hasMedia || message.type === 'audio' || message.type === 'ptt')) {
      console.log('🔍 ESTRATÉGIA 5: Mensagem indica ter mídia, procurando em todas as propriedades...');
      
      const allProps = Object.keys(message);
      console.log('📝 TODAS as propriedades da mensagem:', allProps);
      
      for (const prop of allProps) {
        const value = message[prop];
        if (typeof value === 'string' && value.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value)) {
          console.log(`🔍 POSSÍVEL base64 encontrado em ${prop} (tamanho: ${value.length})`);
          // Verificar se parece com base64 de áudio (começar com dados de áudio)
          try {
            const firstBytes = atob(value.substring(0, 20));
            if (firstBytes.includes('OggS') || firstBytes.includes('RIFF') || firstBytes.charCodeAt(0) === 0xFF) {
              console.log(`✅ CONFIRMADO: ${prop} contém dados de áudio válidos`);
              audioBase64 = value;
              break;
            }
          } catch (e) {
            console.log(`⚠️ ${prop} não é base64 válido`);
          }
        }
      }
    }

    console.log('📊 ===== RESULTADO FINAL DA EXTRAÇÃO =====');
    console.log('📊 RESULTADO da extração:', {
      hasAudioBase64: !!audioBase64,
      audioBase64Length: audioBase64.length,
      audioBase64Preview: audioBase64.substring(0, 50),
      hasAudioUrl: !!audioUrl,
      audioUrlPreview: audioUrl.substring(0, 100),
      messageType: message.type,
      hasMedia: message.hasMedia
    });

    return { audioBase64, audioUrl };
  },

  // Processar mensagem de áudio do WhatsApp - INTEGRAÇÃO COM WHATSAPPAUDIOSERVICE
  async processWhatsAppAudio(message: any, clientId: string): Promise<{
    transcription: string;
    audioUrl?: string;
    audioBase64?: string;
  }> {
    try {
      console.log('🎵 ===== PROCESSANDO ÁUDIO WHATSAPP (INTEGRADO) =====');
      console.log('📱 MENSAGEM RECEBIDA:', {
        id: message.id,
        type: message.type,
        fromMe: message.fromMe,
        hasMedia: message.hasMedia
      });
      
      // VALIDAÇÃO CRÍTICA
      if (!message) {
        throw new Error('Mensagem não fornecida para processamento de áudio');
      }

      // 1. VERIFICAR SE PRECISA DE DESCRIPTOGRAFIA usando whatsappAudioService
      const { whatsappAudioService } = await import('@/services/whatsappAudioService');
      
      let audioBase64: string | undefined;
      let audioUrl: string | undefined;

      if (whatsappAudioService.hasEncryptedAudio(message) && whatsappAudioService.needsDecryption(message)) {
        console.log('🔐 ÁUDIO CRIPTOGRAFADO DETECTADO - INICIANDO DESCRIPTOGRAFIA...');
        
        // Extrair dados de áudio criptografado
        const audioData = whatsappAudioService.extractAudioData(message);
        if (!audioData) {
          throw new Error('Não foi possível extrair dados de áudio criptografado');
        }

        // Descriptografar áudio
        const decryptedResult = await whatsappAudioService.decryptAudio(audioData);
        if (!decryptedResult) {
          throw new Error('Falha na descriptografia do áudio');
        }

        audioBase64 = decryptedResult.decryptedData;
        console.log('✅ ÁUDIO DESCRIPTOGRAFADO COM SUCESSO');
        
      } else {
        console.log('📱 ÁUDIO NÃO CRIPTOGRAFADO - EXTRAINDO DADOS DIRETOS...');
        
        // Usar função de extração padrão para áudios não criptografados
        const extracted = this.extractAudioDataFromMessage(message);
        audioBase64 = extracted.audioBase64;
        audioUrl = extracted.audioUrl;

        // Se não encontrou base64 mas tem URL, tentar baixar
        if (!audioBase64 && audioUrl) {
          console.log('🔄 BAIXANDO áudio da URL:', audioUrl);
          try {
            const response = await fetch(audioUrl);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              audioBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
              console.log('✅ Áudio baixado da URL com sucesso');
            }
          } catch (error) {
            console.error('❌ Erro ao baixar áudio da URL:', error);
          }
        }
      }

      // VALIDAÇÃO FINAL
      if (!audioBase64) {
        console.error('❌ NENHUM DADO DE ÁUDIO ENCONTRADO');
        throw new Error('Dados de áudio não encontrados - verifique se a mensagem contém áudio válido');
      }

      console.log('✅ DADOS DE ÁUDIO PRONTOS - PROSSEGUINDO COM TRANSCRIÇÃO');

      // Buscar configuração de IA do cliente
      const { data: aiConfig, error: configError } = await supabase
        .from('client_ai_configs')
        .select('openai_api_key')
        .eq('client_id', clientId)
        .single();

      if (configError || !aiConfig?.openai_api_key) {
        console.error('❌ Configuração de IA não encontrada:', configError);
        throw new Error('Configuração de IA não encontrada para este cliente');
      }

      // Limpar dados base64 se necessário
      let cleanAudioBase64 = audioBase64;
      if (audioBase64.includes(',')) {
        cleanAudioBase64 = audioBase64.split(',')[1];
        console.log('✂️ Removido prefixo data: dos dados de áudio');
      }

      // Validação final antes da transcrição
      console.log('🔍 VALIDAÇÃO FINAL ANTES DA TRANSCRIÇÃO:', {
        audioLength: cleanAudioBase64.length,
        isValidBase64: /^[A-Za-z0-9+/=]+$/.test(cleanAudioBase64),
        hasOpenAIKey: !!aiConfig.openai_api_key,
        firstChars: cleanAudioBase64.substring(0, 50)
      });

      // Transcrever áudio - COM RETRY E LOGS DETALHADOS
      console.log('🚀 ===== INICIANDO TRANSCRIÇÃO COM EDGE FUNCTION =====');
      
      let transcription = '';
      let lastError = null;
      
      // Tentar transcrição com retry
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔄 TENTATIVA DE TRANSCRIÇÃO ${attempt}/3`);
          console.log(`📡 CHAMANDO EDGE FUNCTION speech-to-text...`);
          
          transcription = await this.convertSpeechToText(cleanAudioBase64, aiConfig.openai_api_key);
          
          if (transcription && transcription.trim() !== '' && !transcription.includes('[Áudio não pôde ser transcrito]')) {
            console.log(`✅ TRANSCRIÇÃO SUCESSO na tentativa ${attempt}:`, transcription.substring(0, 100));
            break;
          } else {
            console.warn(`⚠️ Transcrição vazia na tentativa ${attempt}:`, transcription);
            lastError = new Error('Transcrição vazia');
          }
        } catch (error) {
          console.error(`❌ ERRO na tentativa ${attempt}:`, error);
          lastError = error;
          
          if (attempt < 3) {
            console.log('⏳ Aguardando antes da próxima tentativa...');
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      if (!transcription || transcription.trim() === '' || transcription.includes('[Áudio não pôde ser transcrito]')) {
        console.warn('⚠️ TODAS as tentativas de transcrição falharam');
        console.error('💥 Último erro:', lastError);
        return {
          transcription: '[Áudio não pôde ser transcrito - verifique a qualidade do áudio]',
          audioUrl,
          audioBase64: cleanAudioBase64
        };
      }

      console.log('✅ ===== ÁUDIO PROCESSADO COM SUCESSO =====');
      console.log('📝 Transcrição final:', transcription);
      console.log('📊 Estatísticas finais:', {
        transcriptionLength: transcription.length,
        hasAudioData: !!cleanAudioBase64,
        audioDataLength: cleanAudioBase64.length,
        hasAudioUrl: !!audioUrl
      });

      return {
        transcription: transcription.trim(),
        audioUrl,
        audioBase64: cleanAudioBase64
      };
      
    } catch (error) {
      console.error('❌ ===== ERRO CRÍTICO NO PROCESSAMENTO DE ÁUDIO =====');
      console.error('💥 Erro:', error);
      console.error('🔍 Stack:', error.stack);
      console.error('📱 Mensagem que causou o erro:', JSON.stringify(message, null, 2));
      
      // Re-throw com contexto adicional
      throw new Error(`Falha crítica no processamento de áudio: ${error.message}`);
    }
  },

  // Converter arquivo de áudio para base64
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remover o prefixo data:audio/...;base64,
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Erro ao converter arquivo'));
      reader.readAsDataURL(file);
    });
  },

  // Processar imagem com visão da IA
  async processImageMessage(imageFile: File, prompt: string, clientId: string): Promise<string> {
    try {
      // Converter imagem para base64
      const base64Image = await this.fileToDataUrl(imageFile);
      
      // Buscar configuração de IA do cliente
      const { data: aiConfig } = await supabase
        .from('client_ai_configs')
        .select('openai_api_key')
        .eq('client_id', clientId)
        .single();

      if (!aiConfig?.openai_api_key) {
        throw new Error('Configuração de IA não encontrada');
      }

      // Processar imagem com GPT-4 Vision
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt || 'Descreva esta imagem detalhadamente.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64Image
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao processar imagem com IA');
      }

      const data = await response.json();
      return data.choices[0].message.content;
      
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      throw error;
    }
  },

  // Converter arquivo para data URL completo
  async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Erro ao converter arquivo'));
      reader.readAsDataURL(file);
    });
  }
};
