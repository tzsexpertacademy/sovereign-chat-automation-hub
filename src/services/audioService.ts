
import { supabase } from "@/integrations/supabase/client";

export const audioService = {
  async convertSpeechToText(audioBase64: string, openaiApiKey: string): Promise<string> {
    console.log('🎵 Iniciando transcrição de áudio...');
    
    try {
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: audioBase64,
          openaiApiKey
        }
      });

      if (error) {
        console.error('❌ Erro na transcrição:', error);
        throw error;
      }
      if (data.error) {
        console.error('❌ Erro retornado pela API:', data.error);
        throw new Error(data.error);
      }

      console.log('✅ Áudio transcrito com sucesso:', data.text);
      return data.text;
    } catch (error) {
      console.error('❌ Erro crítico na transcrição:', error);
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

  // Processar mensagem de áudio do WhatsApp - VERSÃO MELHORADA
  async processWhatsAppAudio(message: any, clientId: string): Promise<{
    transcription: string;
    audioUrl?: string;
    audioBase64?: string;
  }> {
    try {
      console.log('🎵 ===== PROCESSANDO ÁUDIO DO WHATSAPP =====');
      console.log('📱 Dados da mensagem:', {
        messageId: message.id,
        hasMedia: !!message.hasMedia,
        type: message.type,
        hasMediaData: !!message.mediaData,
        hasMediaUrl: !!message.mediaUrl,
        mediaDataLength: message.mediaData?.length || 0
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

      let audioBase64 = '';
      let audioUrl = '';

      // Extrair dados de áudio da mensagem - MELHORADO
      if (message.hasMedia || message.type === 'audio' || message.type === 'ptt') {
        if (message.mediaData) {
          console.log('📱 Usando dados de mídia diretos');
          audioBase64 = message.mediaData;
          
          // Validar se é base64 válido
          if (!audioBase64 || audioBase64.length < 100) {
            throw new Error('Dados de áudio muito pequenos ou inválidos');
          }
          
          console.log('✅ Dados de áudio encontrados:', {
            length: audioBase64.length,
            hasPrefix: audioBase64.includes('data:'),
            preview: audioBase64.substring(0, 50)
          });
          
        } else if (message.mediaUrl) {
          console.log('🔄 Baixando áudio da URL:', message.mediaUrl);
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
            console.log('📁 Tipo de conteúdo:', contentType);
            
            const arrayBuffer = await response.arrayBuffer();
            audioBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            audioUrl = message.mediaUrl;
            
            console.log('✅ Áudio baixado com sucesso:', {
              size: arrayBuffer.byteLength,
              base64Length: audioBase64.length
            });
            
          } catch (error) {
            console.error('❌ Erro ao baixar áudio:', error);
            throw new Error(`Erro ao processar áudio: ${error.message}`);
          }
        } else {
          console.error('❌ Nenhum dado de áudio encontrado na mensagem');
          console.log('🔍 Estrutura da mensagem:', JSON.stringify(message, null, 2));
          throw new Error('Dados de áudio não encontrados na mensagem');
        }
      } else {
        console.error('❌ Mensagem não contém áudio');
        throw new Error('Mensagem não contém áudio');
      }

      // Validar se temos dados de áudio
      if (!audioBase64) {
        throw new Error('Falha ao extrair dados de áudio');
      }

      // Transcrever áudio - COM LOGS DETALHADOS
      console.log('🚀 ===== INICIANDO TRANSCRIÇÃO =====');
      console.log('🔑 Usando chave OpenAI:', aiConfig.openai_api_key.substring(0, 20) + '...');
      console.log('📊 Tamanho do áudio:', audioBase64.length, 'caracteres');
      
      const transcription = await this.convertSpeechToText(audioBase64, aiConfig.openai_api_key);
      
      if (!transcription || transcription.trim() === '') {
        console.warn('⚠️ Transcrição vazia recebida');
        return {
          transcription: '[Áudio não pôde ser transcrito]',
          audioUrl,
          audioBase64
        };
      }

      console.log('✅ ===== ÁUDIO PROCESSADO COM SUCESSO =====');
      console.log('📝 Transcrição:', transcription);
      console.log('📊 Estatísticas:', {
        transcriptionLength: transcription.length,
        hasAudioData: !!audioBase64,
        hasAudioUrl: !!audioUrl
      });

      return {
        transcription: transcription.trim(),
        audioUrl,
        audioBase64
      };
      
    } catch (error) {
      console.error('❌ ===== ERRO NO PROCESSAMENTO DE ÁUDIO =====');
      console.error('💥 Erro:', error);
      console.error('🔍 Stack:', error.stack);
      
      // Re-throw com contexto adicional
      throw new Error(`Falha no processamento de áudio: ${error.message}`);
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
