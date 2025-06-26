import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Assistant = Tables<"assistants"> & {
  advanced_settings?: string | any; // JSON string or parsed object
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
}

// Vozes disponíveis do ElevenLabs
export const ELEVENLABS_VOICES = [
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/9BWtsMINqrJLrRacOk9x/df6788f9-5c96-470d-8312-aab3b3d8f50a.mp3' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/81911b5b-6c80-4f36-b4bf-29b9db5e0072.mp3' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/6d0b7668-bf60-4f48-a9a0-d15048129c04.mp3' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/b86ba105-9a7d-4843-b1a3-f2cf7d139fce.mp3' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/7b1f86e5-a4bf-4565-8101-6489f7f6d7f2.mp3' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/7b1f86e5-a4bf-4565-8101-6489f7f6d7f2.mp3' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/7b1f86e5-a4bf-4565-8101-6489f7f6d7f2.mp3' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/7b1f86e5-a4bf-4565-8101-6489f7f6d7f2.mp3' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/7b1f86e5-a4bf-4565-8101-6489f7f6d7f2.mp3' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', language: 'en', preview: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/f7c55b5e-7a5b-4ef0-9c30-1e7e4b7f1e7e.mp3' }
];

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

  async validateOpenAIConnection(apiKey: string, model: string = 'gpt-4o-mini'): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Test connection' }],
          max_tokens: 5,
          temperature: 0.1
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Erro ao validar conexão OpenAI:', error);
      return false;
    }
  },

  async validateElevenLabsConnection(apiKey: string, voiceId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Erro ao validar conexão ElevenLabs:', error);
      return false;
    }
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
