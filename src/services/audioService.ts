
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

  // Processar mensagem de áudio do WhatsApp
  async processWhatsAppAudio(message: any, clientId: string): Promise<{
    transcription: string;
    audioUrl?: string;
    audioBase64?: string;
  }> {
    try {
      console.log('🎵 Processando áudio do WhatsApp:', {
        messageId: message.id,
        hasMedia: !!message.hasMedia,
        type: message.type,
        hasMediaData: !!message.mediaData,
        hasMediaUrl: !!message.mediaUrl
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

      // Extrair dados de áudio da mensagem
      if (message.hasMedia || message.type === 'audio' || message.type === 'ptt') {
        if (message.mediaData) {
          // Dados de mídia já em base64
          audioBase64 = message.mediaData;
          console.log('✅ Dados de áudio encontrados (base64):', audioBase64.length, 'chars');
        } else if (message.mediaUrl) {
          // URL da mídia - fazer download
          try {
            console.log('🔄 Baixando áudio da URL:', message.mediaUrl);
            const response = await fetch(message.mediaUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            audioBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            audioUrl = message.mediaUrl;
            console.log('✅ Áudio baixado com sucesso:', audioBase64.length, 'chars');
          } catch (error) {
            console.error('❌ Erro ao baixar áudio:', error);
            throw new Error(`Erro ao processar áudio: ${error.message}`);
          }
        } else {
          console.error('❌ Nenhum dado de áudio encontrado na mensagem');
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

      // Transcrever áudio
      console.log('🚀 Iniciando transcrição com OpenAI...');
      const transcription = await this.convertSpeechToText(audioBase64, aiConfig.openai_api_key);
      
      if (!transcription || transcription.trim() === '') {
        console.warn('⚠️ Transcrição vazia recebida');
        throw new Error('Transcrição vazia recebida');
      }

      console.log('✅ Áudio processado com sucesso:', {
        transcriptionLength: transcription.length,
        hasAudioData: !!audioBase64,
        preview: transcription.substring(0, 100)
      });

      return {
        transcription: transcription.trim(),
        audioUrl,
        audioBase64
      };
      
    } catch (error) {
      console.error('❌ Erro ao processar áudio do WhatsApp:', error);
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
