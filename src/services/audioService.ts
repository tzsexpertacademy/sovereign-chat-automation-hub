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

  // Processar mensagem de áudio do WhatsApp - VERSÃO CORRIGIDA
  async processWhatsAppAudio(message: any, clientId: string): Promise<{
    transcription: string;
    audioUrl?: string;
    audioBase64?: string;
  }> {
    try {
      console.log('🎵 ===== PROCESSANDO ÁUDIO WHATSAPP =====');
      
      // VALIDAÇÃO CRÍTICA: Verificar se message existe
      if (!message) {
        console.error('❌ ERRO CRÍTICO: Mensagem é undefined');
        throw new Error('Mensagem não fornecida para processamento de áudio');
      }

      console.log('📱 Estrutura da mensagem:', {
        messageExists: !!message,
        messageId: message.id || 'N/A',
        hasMedia: !!message.hasMedia,
        type: message.type,
        hasMediaData: !!message.mediaData,
        hasMediaUrl: !!message.mediaUrl,
        mediaDataLength: message.mediaData?.length || 0,
        bodyPreview: message.body?.substring(0, 50) || 'N/A',
        messageKeys: message ? Object.keys(message) : [],
        originalMessage: message.originalMessage ? Object.keys(message.originalMessage) : 'N/A'
      });

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

      console.log('🔑 Configuração OpenAI encontrada:', {
        hasKey: !!aiConfig.openai_api_key,
        keyPrefix: aiConfig.openai_api_key?.substring(0, 20) + '...'
      });

      let audioBase64 = '';
      let audioUrl = '';

      // ESTRATÉGIA 1: Tentar mediaData primeiro
      if (message.mediaData) {
        console.log('📱 ESTRATÉGIA 1: Usando mediaData direto');
        audioBase64 = message.mediaData;
      } else if (message.originalMessage?.mediaData) {
        console.log('📱 ESTRATÉGIA 2: Usando originalMessage.mediaData');
        audioBase64 = message.originalMessage.mediaData;
      } else if (message.mediaUrl) {
        console.log('🔄 ESTRATÉGIA 3: Baixando áudio da URL:', message.mediaUrl);
        try {
          const response = await fetch(message.mediaUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const contentType = response.headers.get('content-type');
          console.log('📁 Tipo de conteúdo da URL:', contentType);
          
          const arrayBuffer = await response.arrayBuffer();
          audioBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          audioUrl = message.mediaUrl;
          
          console.log('✅ Áudio baixado da URL:', {
            size: arrayBuffer.byteLength,
            base64Length: audioBase64.length
          });
          
        } catch (error) {
          console.error('❌ Erro ao baixar áudio da URL:', error);
          throw new Error(`Erro ao processar áudio da URL: ${error.message}`);
        }
      } else {
        // ESTRATÉGIA 4: Tentar outras propriedades da mensagem
        console.log('🔍 ESTRATÉGIA 4: Procurando dados de áudio em outras propriedades...');
        
        const possibleAudioProps = ['data', 'audioData', 'content', 'media'];
        for (const prop of possibleAudioProps) {
          if (message[prop] && typeof message[prop] === 'string' && message[prop].length > 100) {
            console.log(`📱 Encontrado dados em ${prop}`);
            audioBase64 = message[prop];
            break;
          }
          if (message.originalMessage?.[prop] && typeof message.originalMessage[prop] === 'string' && message.originalMessage[prop].length > 100) {
            console.log(`📱 Encontrado dados em originalMessage.${prop}`);
            audioBase64 = message.originalMessage[prop];
            break;
          }
        }
        
        if (!audioBase64) {
          console.error('❌ NENHUM dado de áudio encontrado');
          console.log('🔍 Estrutura completa da mensagem para debug:', JSON.stringify(message, null, 2));
          throw new Error('Dados de áudio não encontrados na mensagem');
        }
      }

      // Validar se temos dados de áudio
      if (!audioBase64) {
        throw new Error('Falha ao extrair dados de áudio');
      }

      // Limpar dados base64 se necessário
      let cleanAudioBase64 = audioBase64;
      if (audioBase64.includes(',')) {
        cleanAudioBase64 = audioBase64.split(',')[1];
        console.log('✂️ Removido prefixo data: dos dados de áudio');
      }

      // Validação final antes da transcrição
      console.log('🔍 VALIDAÇÃO FINAL:', {
        audioLength: cleanAudioBase64.length,
        isValidBase64: /^[A-Za-z0-9+/=]+$/.test(cleanAudioBase64),
        hasOpenAIKey: !!aiConfig.openai_api_key
      });

      // Transcrever áudio - COM RETRY
      console.log('🚀 ===== INICIANDO TRANSCRIÇÃO =====');
      
      let transcription = '';
      let lastError = null;
      
      // Tentar transcrição com retry
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔄 TENTATIVA DE TRANSCRIÇÃO ${attempt}/3`);
          transcription = await this.convertSpeechToText(cleanAudioBase64, aiConfig.openai_api_key);
          
          if (transcription && transcription.trim() !== '' && !transcription.includes('[Áudio não pôde ser transcrito]')) {
            console.log(`✅ TRANSCRIÇÃO SUCESSO na tentativa ${attempt}:`, transcription.substring(0, 100));
            break;
          } else {
            console.warn(`⚠️ Transcrição vazia na tentativa ${attempt}`);
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
        hasAudioUrl: !!audioUrl
      });

      return {
        transcription: transcription.trim(),
        audioUrl,
        audioBase64: cleanAudioBase64
      };
      
    } catch (error) {
      console.error('❌ ===== ERRO CRÍTICO NO PROCESSAMENTO =====');
      console.error('💥 Erro:', error);
      console.error('🔍 Stack:', error.stack);
      
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
