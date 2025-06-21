
import { supabase } from "@/integrations/supabase/client";

export const audioService = {
  async convertSpeechToText(audioBase64: string, openaiApiKey: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('speech-to-text', {
      body: {
        audio: audioBase64,
        openaiApiKey
      }
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data.text;
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

  async processAssistantMessage(params: {
    messageText: string;
    assistantId: string;
    chatId: string;
    instanceId: string;
    messageId: string;
    isAudioMessage?: boolean;
  }) {
    const { data, error } = await supabase.functions.invoke('ai-assistant-process', {
      body: params
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);

    return data;
  },

  // Processar áudio com transcrição automática
  async processAudioMessage(audioBlob: Blob, clientId: string): Promise<string> {
    try {
      // Converter blob para base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Buscar configuração de IA do cliente
      const { data: aiConfig } = await supabase
        .from('ai_configs')
        .select('openai_api_key')
        .eq('client_id', clientId)
        .single();

      if (!aiConfig?.openai_api_key) {
        throw new Error('Configuração de IA não encontrada');
      }

      // Transcrever áudio
      const transcription = await this.convertSpeechToText(base64Audio, aiConfig.openai_api_key);
      
      return transcription;
    } catch (error) {
      console.error('Erro ao processar áudio:', error);
      throw error;
    }
  },

  // Processar imagem com visão da IA
  async processImageMessage(imageFile: File, prompt: string, clientId: string): Promise<string> {
    try {
      // Converter imagem para base64
      const base64Image = await this.fileToBase64(imageFile);
      
      // Buscar configuração de IA do cliente
      const { data: aiConfig } = await supabase
        .from('ai_configs')
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

  // Converter arquivo para base64
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Erro ao converter arquivo'));
      reader.readAsDataURL(file);
    });
  }
};
