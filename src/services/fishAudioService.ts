import { supabase } from '@/integrations/supabase/client';

export interface FishAudioModel {
  _id: string;
  title: string;
  description: string;
  voices: Array<{
    _id: string;
    title: string;
    description: string;
    gender: string;
    language: string;
    preview_url?: string;
  }>;
}

export interface FishAudioVoice {
  _id: string;
  title: string;
  description: string;
  gender: string;
  language: string;
  preview_url?: string;
}

export interface FishAudioTTSOptions {
  text: string;
  reference_id: string;
  format?: 'mp3' | 'wav' | 'pcm';
  normalize?: boolean;
  mp3_bitrate?: number;
  opus_bitrate?: number;
  latency?: 'normal' | 'balanced';
}

class FishAudioService {
  /**
   * Valida a API key do Fish.Audio
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('fish-audio-models', {
        body: { apiKey, action: 'validate' }
      });

      if (error) {
        console.warn('🐟 Fish.Audio: Erro na validação da API key:', error);
        return false;
      }

      return data?.valid === true;
    } catch (error) {
      console.error('🐟 Fish.Audio: Erro na validação:', error);
      return false;
    }
  }

  /**
   * Lista todos os modelos e vozes disponíveis
   */
  async listModels(apiKey: string): Promise<FishAudioModel[]> {
    try {
      const { data, error } = await supabase.functions.invoke('fish-audio-models', {
        body: { apiKey, action: 'list' }
      });

      if (error) {
        console.error('🐟 Fish.Audio: Erro ao listar modelos:', error);
        return [];
      }

      return data?.models || [];
    } catch (error) {
      console.error('🐟 Fish.Audio: Erro ao buscar modelos:', error);
      return [];
    }
  }

  /**
   * Lista todas as vozes de forma plana
   */
  async listVoices(apiKey: string): Promise<FishAudioVoice[]> {
    try {
      const models = await this.listModels(apiKey);
      const voices: FishAudioVoice[] = [];

      models.forEach(model => {
        model.voices.forEach(voice => {
          voices.push({
            ...voice,
            title: `${model.title} - ${voice.title}`,
            description: voice.description || model.description
          });
        });
      });

      return voices;
    } catch (error) {
      console.error('🐟 Fish.Audio: Erro ao listar vozes:', error);
      return [];
    }
  }

  /**
   * Testa uma voz específica
   */
  async testVoice(
    apiKey: string, 
    referenceId: string, 
    text: string = "Olá! Esta é uma demonstração da voz clonada do Fish Audio."
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.functions.invoke('fish-audio-test', {
        body: { 
          apiKey, 
          referenceId, 
          text,
          format: 'mp3'
        }
      });

      if (error) {
        console.error('🐟 Fish.Audio: Erro no teste de voz:', error);
        return null;
      }

      return data?.audioBase64 || null;
    } catch (error) {
      console.error('🐟 Fish.Audio: Erro no teste:', error);
      return null;
    }
  }

  /**
   * Converte texto em áudio usando Fish.Audio
   */
  async textToSpeech(
    apiKey: string,
    options: FishAudioTTSOptions
  ): Promise<string | null> {
    try {
      console.log('🐟 Fish.Audio: Convertendo texto para áudio:', {
        textLength: options.text.length,
        referenceId: options.reference_id,
        format: options.format || 'mp3'
      });

      const { data, error } = await supabase.functions.invoke('fish-audio-tts', {
        body: { 
          apiKey, 
          ...options 
        }
      });

      if (error) {
        console.error('🐟 Fish.Audio: Erro na conversão TTS:', error);
        return null;
      }

      console.log('✅ Fish.Audio: TTS gerado com sucesso');
      return data?.audioBase64 || null;
    } catch (error) {
      console.error('🐟 Fish.Audio: Erro no TTS:', error);
      return null;
    }
  }

  /**
   * Busca informações de uma voz específica
   */
  async getVoiceInfo(apiKey: string, referenceId: string): Promise<FishAudioVoice | null> {
    try {
      const voices = await this.listVoices(apiKey);
      return voices.find(voice => voice._id === referenceId) || null;
    } catch (error) {
      console.error('🐟 Fish.Audio: Erro ao buscar info da voz:', error);
      return null;
    }
  }
}

export const fishAudioService = new FishAudioService();