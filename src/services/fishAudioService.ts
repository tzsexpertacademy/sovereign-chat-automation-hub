import { supabase } from '@/integrations/supabase/client';

export interface FishAudioModel {
  _id: string;
  type: string;
  title: string;
  description: string;
  state: string;
  languages: string[];
  visibility?: string; // 'public' | 'private' | outros
  samples?: any[];
  voices?: Array<{
    _id: string;
    title: string;
    description: string;
    gender: string;
    language: string;
    preview_url?: string;
  }>;
}

export interface FishAudioVoice {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;
  modelId: string;
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
    if (!apiKey) {
      console.log('🔑 API Key Fish.Audio não fornecida');
      return false;
    }
    
    // Verificar se não é uma URL de documentação
    if (apiKey.startsWith('http')) {
      console.log('🔑 API Key Fish.Audio inválida (URL detectada em vez de chave)');
      return false;
    }
    
    // Verificar formato esperado (FSK_xxx)
    if (!apiKey.startsWith('fsk_')) {
      console.log('🔑 API Key Fish.Audio inválida (formato incorreto - deve começar com fsk_)');
      return false;
    }
    
    try {
      console.log('🔑 Validando API Key Fish.Audio...');
      
      const { data, error } = await supabase.functions.invoke('fish-audio-models', {
        body: { apiKey, action: 'validate' }
      });

      if (error) {
        console.error('❌ Erro na validação:', error);
        return false;
      }

      const isValid = data?.valid || false;
      console.log('✅ Validação Fish.Audio:', { isValid });
      
      return isValid;
    } catch (error) {
      console.error('💥 Erro crítico na validação Fish.Audio:', error);
      return false;
    }
  }

  /**
   * Lista todos os modelos e vozes disponíveis
   */
  async listModels(apiKey: string): Promise<FishAudioModel[]> {
    if (!apiKey) return [];
    
    try {
      console.log('📋 Buscando modelos Fish.Audio...');
      
      const { data, error } = await supabase.functions.invoke('fish-audio-models', {
        body: { apiKey, action: 'list' }
      });

      if (error) {
        console.error('❌ Erro ao buscar modelos:', error);
        return [];
      }

      const models = data?.models || [];
      
      // Filtrar apenas modelos tipo 'tts' que estão treinados
      const ttsModels = models.filter((model: any) => 
        model.type === 'tts' && model.state === 'trained'
      );
      
      console.log('✅ Modelos Fish.Audio TTS carregados:', {
        total: models.length,
        ttsOnly: ttsModels.length
      });
      
      return ttsModels;
    } catch (error) {
      console.error('💥 Erro crítico ao buscar modelos Fish.Audio:', error);
      return [];
    }
  }

  /**
   * Lista todas as vozes de forma plana
   */
  async listVoices(apiKey: string): Promise<FishAudioVoice[]> {
    const models = await this.listModels(apiKey);
    
    const voices: FishAudioVoice[] = [];
    
    for (const model of models) {
      // Determinar categoria baseada na visibilidade
      let category = 'custom';
      let namePrefix = '';
      
      if (model.visibility === 'public') {
        category = 'public';
        namePrefix = '🌐 ';
      } else {
        category = 'personal';
        namePrefix = '👤 ';
      }
      
      // Para Fish.Audio, cada modelo treinado representa uma voz utilizável
      const voice: FishAudioVoice = {
        id: model._id,
        name: namePrefix + model.title,
        description: model.description || `Voz ${category === 'personal' ? 'pessoal' : 'pública'} - ${model.title}`,
        language: model.languages?.[0] || 'pt',
        category,
        modelId: model._id
      };
      
      voices.push(voice);
    }
    
    const personalVoices = voices.filter(v => v.category === 'personal');
    const publicVoices = voices.filter(v => v.category === 'public');
    
    console.log('🎤 Vozes Fish.Audio processadas:', {
      totalModelos: models.length,
      totalVozes: voices.length,
      vozesPersonais: personalVoices.length,
      vozesPublicas: publicVoices.length
    });
    
    return voices;
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
      return voices.find(voice => voice.id === referenceId) || null;
    } catch (error) {
      console.error('🐟 Fish.Audio: Erro ao buscar info da voz:', error);
      return null;
    }
  }
}

export const fishAudioService = new FishAudioService();