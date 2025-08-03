
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Assistant = Tables<"assistants"> & {
  advanced_settings?: string | any;
};
export type AssistantInsert = TablesInsert<"assistants"> & {
  advanced_settings?: string;
};
export type AssistantUpdate = TablesUpdate<"assistants"> & {
  advanced_settings?: string;
};

export interface AssistantWithQueues extends Assistant {
  queues?: Tables<"queues">[];
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
}

export interface AudioLibraryItem {
  id: string;
  name: string;
  trigger: string;
  url: string;
  audioBase64?: string; // ✅ Campo para armazenar áudio em base64
  duration: number;
  category: string;
  uploaded_at: string;
}

export interface ImageLibraryItem {
  id: string;
  name: string;
  trigger: string;
  url: string;
  imageBase64?: string; // Base64 da imagem
  format: 'jpg' | 'png' | 'gif' | 'webp';
  size: number; // tamanho em bytes
  category: string;
  uploaded_at: string;
}

export interface RecordingSettings {
  max_duration: number;
  quality: 'low' | 'medium' | 'high';
  auto_transcribe: boolean;
}

export interface MultimediaConfig {
  image_analysis_enabled: boolean;
  video_analysis_enabled: boolean;
  document_analysis_enabled: boolean;
  url_analysis_enabled: boolean;
  audio_transcription_enabled: boolean;
  image_model: string;
  audio_model: string;
}

export interface HumanizationConfig {
  personality_id: string;
  custom_personality: any;
  enabled: boolean;
}

export interface AdvancedSettings {
  // Audio Provider Selection
  audio_provider?: 'elevenlabs' | 'fishaudio' | 'both';
  
  // General Audio
  audio_processing_enabled: boolean;
  voice_cloning_enabled: boolean;
  
  // ElevenLabs TTS
  eleven_labs_voice_id: string;
  eleven_labs_api_key: string;
  eleven_labs_model: string;
  voice_settings: VoiceSettings;
  
  // Fish.Audio TTS
  fish_audio_enabled?: boolean;
  fish_audio_api_key?: string;
  fish_audio_voice_id?: string;
  fish_audio_format?: 'mp3' | 'wav' | 'pcm';
  fish_audio_quality?: 'normal' | 'balanced';
  
  // Behavior
  response_delay_seconds: number;
  typing_indicator_enabled: boolean;
  recording_indicator_enabled: boolean;
  humanization_level: 'basic' | 'advanced' | 'maximum';
  temperature: number;
  max_tokens: number;
  
  // Media & Files
  custom_files: Array<{
    id: string;
    name: string;
    type: 'image' | 'pdf' | 'video';
    url: string;
    description?: string;
  }>;
  audio_library: AudioLibraryItem[];
  image_library: ImageLibraryItem[];
  recording_settings: RecordingSettings;
  
  // Advanced Features
  multimedia_enabled?: boolean;
  multimedia_config?: MultimediaConfig;
  humanization_config?: HumanizationConfig;
}

export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Most life-like, emotionally rich in 29 languages' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'High quality, low latency in 32 languages' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2', description: 'English-only, low latency model' },
  { id: 'eleven_multilingual_v1', name: 'Multilingual v1', description: 'First multilingual model in 10 languages' }
];

export const assistantsService = {
  async getClientAssistants(clientId: string): Promise<AssistantWithQueues[]> {
    const { data, error } = await supabase
      .from("assistants")
      .select(`
        *,
        queues(*)
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createAssistant(assistant: AssistantInsert): Promise<Assistant> {
    const { data, error } = await supabase
      .from("assistants")
      .insert(assistant)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAssistant(id: string, updates: AssistantUpdate): Promise<Assistant> {
    const { data, error } = await supabase
      .from("assistants")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAssistant(id: string): Promise<void> {
    const { error } = await supabase
      .from("assistants")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async toggleAssistantStatus(id: string, isActive: boolean): Promise<Assistant> {
    return this.updateAssistant(id, { is_active: isActive });
  },

  async getAssistantAdvancedSettings(id: string): Promise<AdvancedSettings | null> {
    const { data, error } = await supabase
      .from("assistants")
      .select("advanced_settings")
      .eq("id", id)
      .single();

    if (error) throw error;
    
    if (!data?.advanced_settings) return null;
    
    try {
      return typeof data.advanced_settings === 'string' 
        ? JSON.parse(data.advanced_settings)
        : data.advanced_settings;
    } catch {
      return null;
    }
  },

  async updateAdvancedSettings(id: string, settings: AdvancedSettings): Promise<void> {
    const { error } = await supabase
      .from("assistants")
      .update({ advanced_settings: JSON.stringify(settings) })
      .eq("id", id);

    if (error) throw error;
  },

  async uploadAudioToLibrary(
    assistantId: string, 
    audioFile: File, 
    trigger: string, 
    category: string
  ): Promise<AudioLibraryItem> {
    try {
      console.log('📤 [UPLOAD-AUDIO] Iniciando upload para biblioteca:', {
        fileName: audioFile.name,
        trigger,
        category,
        size: audioFile.size
      });

      // ✅ CORREÇÃO CRÍTICA: Converter para base64 em vez de blob URL
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remover o prefixo data:audio/...;base64,
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioFile);
      });

      // Calcular duração real do áudio
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio();
        const url = URL.createObjectURL(audioFile);
        audio.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve(Math.round(audio.duration));
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(0);
        };
        audio.src = url;
      });

      console.log('✅ [UPLOAD-AUDIO] Conversão base64 concluída:', {
        base64Length: audioBase64.length,
        duration: duration + 's'
      });

      // ✅ Padronizar formato do trigger: audiogeono{nome}
      const normalizedTrigger = trigger.toLowerCase().startsWith('audiogeono') 
        ? trigger.toLowerCase()
        : `audiogeono${trigger.toLowerCase()}`;

      const audioItem: AudioLibraryItem = {
        id: `audio_${Date.now()}`,
        name: audioFile.name,
        trigger: normalizedTrigger,
        url: '', // Não precisamos mais de URL temporária
        audioBase64: audioBase64, // ✅ Salvar base64 permanentemente
        duration: duration,
        category: category,
        uploaded_at: new Date().toISOString()
      };

      // Adicionar à biblioteca do assistente
      const settings = await this.getAssistantAdvancedSettings(assistantId);
      if (settings) {
        const updatedSettings = {
          ...settings,
          audio_library: [...(settings.audio_library || []), audioItem]
        };
        await this.updateAdvancedSettings(assistantId, updatedSettings);
        
        console.log('✅ [UPLOAD-AUDIO] Áudio salvo na biblioteca:', {
          trigger: normalizedTrigger,
          duration: duration + 's',
          librarySize: updatedSettings.audio_library.length
        });
      }

      return audioItem;
    } catch (error) {
      console.error('❌ [UPLOAD-AUDIO] Erro ao fazer upload do áudio:', error);
      throw error;
    }
  },

  async removeAudioFromLibrary(assistantId: string, audioId: string): Promise<void> {
    try {
      const settings = await this.getAssistantAdvancedSettings(assistantId);
      if (settings) {
        const updatedSettings = {
          ...settings,
          audio_library: (settings.audio_library || []).filter(audio => audio.id !== audioId)
        };
        await this.updateAdvancedSettings(assistantId, updatedSettings);
      }
    } catch (error) {
      console.error('Erro ao remover áudio da biblioteca:', error);
      throw error;
    }
  },

  async uploadImageToLibrary(
    assistantId: string, 
    imageFile: File, 
    trigger: string, 
    category: string
  ): Promise<ImageLibraryItem> {
    try {
      console.log('📤 [UPLOAD-IMAGE] Iniciando upload para biblioteca:', {
        fileName: imageFile.name,
        trigger,
        category,
        size: imageFile.size
      });

      // Validar formato
      const validFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validFormats.includes(imageFile.type)) {
        throw new Error('Formato não suportado. Use JPG, PNG, GIF ou WebP.');
      }

      // Validar tamanho (10MB máximo)
      if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error('Imagem muito grande. Máximo 10MB.');
      }

      // Converter para base64
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      console.log('✅ [UPLOAD-IMAGE] Conversão base64 concluída:', {
        base64Length: imageBase64.length,
        format: imageFile.type
      });

      // Determinar formato
      let format: 'jpg' | 'png' | 'gif' | 'webp' = 'jpg';
      if (imageFile.type.includes('png')) format = 'png';
      else if (imageFile.type.includes('gif')) format = 'gif';
      else if (imageFile.type.includes('webp')) format = 'webp';

      const imageItem: ImageLibraryItem = {
        id: `image_${Date.now()}`,
        name: imageFile.name,
        trigger: trigger.toLowerCase(),
        url: '',
        imageBase64: imageBase64,
        format: format,
        size: imageFile.size,
        category: category,
        uploaded_at: new Date().toISOString()
      };

      // Verificar se trigger já existe
      const settings = await this.getAssistantAdvancedSettings(assistantId);
      if (settings?.image_library) {
        const existingTrigger = settings.image_library.find(img => img.trigger === trigger.toLowerCase());
        if (existingTrigger) {
          throw new Error(`Trigger "${trigger}" já existe na biblioteca.`);
        }
      }

      // Adicionar à biblioteca do assistente
      if (settings) {
        const updatedSettings = {
          ...settings,
          image_library: [...(settings.image_library || []), imageItem]
        };
        await this.updateAdvancedSettings(assistantId, updatedSettings);
        
        console.log('✅ [UPLOAD-IMAGE] Imagem salva na biblioteca:', {
          trigger: trigger.toLowerCase(),
          format,
          librarySize: updatedSettings.image_library.length
        });
      }

      return imageItem;
    } catch (error) {
      console.error('❌ [UPLOAD-IMAGE] Erro ao fazer upload da imagem:', error);
      throw error;
    }
  },

  async removeImageFromLibrary(assistantId: string, imageId: string): Promise<void> {
    try {
      const settings = await this.getAssistantAdvancedSettings(assistantId);
      if (settings) {
        const updatedSettings = {
          ...settings,
          image_library: (settings.image_library || []).filter(image => image.id !== imageId)
        };
        await this.updateAdvancedSettings(assistantId, updatedSettings);
      }
    } catch (error) {
      console.error('Erro ao remover imagem da biblioteca:', error);
      throw error;
    }
  }
};
