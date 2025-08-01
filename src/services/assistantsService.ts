
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
  duration: number;
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
  audio_processing_enabled: boolean;
  voice_cloning_enabled: boolean;
  eleven_labs_voice_id: string;
  eleven_labs_api_key: string;
  eleven_labs_model: string;
  voice_settings: VoiceSettings;
  response_delay_seconds: number;
  message_processing_delay_seconds: number;
  message_batch_timeout_seconds: number;
  typing_indicator_enabled: boolean;
  recording_indicator_enabled: boolean;
  humanization_level: 'basic' | 'advanced' | 'maximum';
  temperature: number;
  max_tokens: number;
  custom_files: Array<{
    id: string;
    name: string;
    type: 'image' | 'pdf' | 'video';
    url: string;
    description?: string;
  }>;
  audio_library: AudioLibraryItem[];
  recording_settings: RecordingSettings;
  // Novas configurações
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
      // Simular upload - em produção, usar Supabase Storage
      const audioUrl = URL.createObjectURL(audioFile);
      
      const audioItem: AudioLibraryItem = {
        id: `audio_${Date.now()}`,
        name: audioFile.name,
        trigger: trigger,
        url: audioUrl,
        duration: 0, // Seria calculado em produção
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
      }

      return audioItem;
    } catch (error) {
      console.error('Erro ao fazer upload do áudio:', error);
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
  }
};
