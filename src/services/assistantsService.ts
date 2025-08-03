
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

export interface VideoLibraryItem {
  id: string;
  name: string;
  trigger: string;
  url: string;
  videoBase64?: string; // Base64 do vídeo
  format: 'mp4' | 'avi' | 'mov' | 'webm';
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
  video_library: VideoLibraryItem[];
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
    console.log('🔍 [GET-SETTINGS] Buscando configurações para assistente:', id);
    
    // Primeiro verificar se é o assistente Yumer
    const { data: assistantData, error: assistantError } = await supabase
      .from("assistants")
      .select("name, advanced_settings")
      .eq("id", id)
      .single();

    if (assistantError) {
      console.error('❌ [GET-SETTINGS] Erro ao buscar assistente:', assistantError);
      throw assistantError;
    }
    
    const isYumerAssistant = assistantData?.name?.toLowerCase().includes('yumer') || false;
    console.log('🎯 [GET-SETTINGS] É assistente Yumer?', isYumerAssistant);
    console.log('📊 [GET-SETTINGS] Raw data:', assistantData?.advanced_settings);
    
    // Se não tem configurações, criar configurações padrão
    if (!assistantData?.advanced_settings) {
      console.log('🔧 [GET-SETTINGS] Criando configurações padrão para assistente:', id);
      
      const defaultSettings: AdvancedSettings = {
        audio_processing_enabled: isYumerAssistant, // ✅ Ativar automaticamente para Yumer
        voice_cloning_enabled: false,
        eleven_labs_voice_id: isYumerAssistant ? "qyyrdbONJUI3wBhef3EW" : "",
        eleven_labs_api_key: isYumerAssistant ? "sk_af614e2309cd80a10fad0d33b8057869f7c7e06c2d46fdda" : "",
        eleven_labs_model: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.6,
          style: 0.5
        },
        response_delay_seconds: 3,
        typing_indicator_enabled: true,
        recording_indicator_enabled: true,
        humanization_level: "advanced",
        temperature: 0.8,
        max_tokens: 1000,
        custom_files: [],
        audio_library: [],
        image_library: isYumerAssistant ? [{
          id: "image_lotetestet",
          name: "lotetestet.jpg",
          trigger: "lotetestet", 
          url: "",
          imageBase64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
          format: "jpg" as const,
          size: 1024,
          category: "teste",
          uploaded_at: new Date().toISOString()
        }] : [], // ✅ GARANTIR QUE EXISTE COM IMAGEM DE TESTE PARA YUMER
        video_library: [],
        recording_settings: {
          max_duration: 300,
          quality: 'medium',
          auto_transcribe: true
        }
      };
      
      // Salvar configurações padrão no banco
      await this.updateAdvancedSettings(id, defaultSettings);
      console.log('✅ [GET-SETTINGS] Configurações padrão criadas e salvas');
      
      return defaultSettings;
    }
    
    try {
      let rawSettings = assistantData.advanced_settings;
      
      // 🔧 CORREÇÃO CRÍTICA: Verificar se está "wrapeado" em array com índice "0"
      if (rawSettings && typeof rawSettings === 'object' && rawSettings["0"]) {
        console.log('🔧 [GET-SETTINGS] Detectado wrapper array com índice "0", extraindo...');
        rawSettings = rawSettings["0"];
      }
      
      const settings = typeof rawSettings === 'string' 
        ? JSON.parse(rawSettings)
        : rawSettings;
      
      console.log('🔍 [GET-SETTINGS] Settings após correção:', {
        rawType: typeof rawSettings,
        hasImageLibrary: !!settings.image_library,
        hasAudioLibrary: !!settings.audio_library,
        audioLibrarySize: settings.audio_library?.length || 0,
        imageLibrarySize: settings.image_library?.length || 0
      });
      
      // ✅ GARANTIR QUE image_library SEMPRE EXISTE - ESPECIAL PARA YUMER
      if (!settings.image_library) {
        settings.image_library = isYumerAssistant ? [{
          id: "image_lotetestet",
          name: "lotetestet.jpg",
          trigger: "lotetestet", 
          url: "",
          imageBase64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
          format: "jpg" as const,
          size: 1024,
          category: "teste",
          uploaded_at: new Date().toISOString()
        }] : [];
        console.log('🔧 [GET-SETTINGS] Adicionando image_library' + (isYumerAssistant ? ' com imagem de teste para Yumer' : ' vazia'));
        await this.updateAdvancedSettings(id, settings);
      }
      
      // ✅ GARANTIR QUE audio_library SEMPRE EXISTE
      if (!settings.audio_library) {
        settings.audio_library = [];
        console.log('🔧 [GET-SETTINGS] Adicionando audio_library ausente');
        await this.updateAdvancedSettings(id, settings);
      }
      
      // ✅ GARANTIR QUE video_library SEMPRE EXISTE
      if (!settings.video_library) {
        settings.video_library = [];
        console.log('🔧 [GET-SETTINGS] Adicionando video_library ausente');
        await this.updateAdvancedSettings(id, settings);
      }
      
      // ✅ CORREÇÃO ESPECÍFICA PARA YUMER: Ativar processamento de áudio se não estiver ativo
      if (isYumerAssistant && !settings.audio_processing_enabled) {
        console.log('🎯 [GET-SETTINGS] Ativando processamento de áudio para Yumer');
        settings.audio_processing_enabled = true;
        
        // Garantir que tem API key e voz configurados
        if (!settings.eleven_labs_api_key) {
          settings.eleven_labs_api_key = "sk_af614e2309cd80a10fad0d33b8057869f7c7e06c2d46fdda";
        }
        if (!settings.eleven_labs_voice_id) {
          settings.eleven_labs_voice_id = "qyyrdbONJUI3wBhef3EW";
        }
        
        await this.updateAdvancedSettings(id, settings);
        console.log('✅ [GET-SETTINGS] Processamento de áudio ativado para Yumer');
      }
      
      console.log('✅ [GET-SETTINGS] Configurações carregadas e corrigidas:', {
        audioLibrarySize: settings.audio_library?.length || 0,
        imageLibrarySize: settings.image_library?.length || 0,
        audioProcessingEnabled: settings.audio_processing_enabled
      });
      
      return settings;
    } catch (parseError) {
      console.error('❌ [GET-SETTINGS] Erro ao fazer parse das configurações:', parseError);
      return null;
    }
  },

  async updateAdvancedSettings(id: string, settings: AdvancedSettings): Promise<void> {
    console.log('💾 [UPDATE-SETTINGS] Salvando configurações:', {
      assistantId: id,
      audioLibrarySize: settings.audio_library?.length || 0,
      imageLibrarySize: settings.image_library?.length || 0
    });
    
    const { error } = await supabase
      .from("assistants")
      .update({ advanced_settings: JSON.stringify(settings) })
      .eq("id", id);

    if (error) {
      console.error('❌ [UPDATE-SETTINGS] Erro ao salvar configurações:', error);
      throw error;
    }
    
    console.log('✅ [UPDATE-SETTINGS] Configurações salvas com sucesso');
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

      // ✅ BUSCAR OU CRIAR CONFIGURAÇÕES
      const settings = await this.getAssistantAdvancedSettings(assistantId);
      if (!settings) {
        throw new Error('Não foi possível carregar ou criar configurações do assistente');
      }
      
      // Verificar se trigger já existe (usando || [] como fallback)
      const existingTrigger = (settings.image_library || []).find(img => img.trigger === trigger.toLowerCase());
      if (existingTrigger) {
        throw new Error(`Trigger "${trigger}" já existe na biblioteca.`);
      }

      // ✅ GARANTIR QUE image_library EXISTE
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
  },

  async uploadVideoToLibrary(
    assistantId: string, 
    videoFile: File, 
    trigger: string, 
    category: string
  ): Promise<VideoLibraryItem> {
    try {
      console.log('📤 [UPLOAD-VIDEO] Iniciando upload para biblioteca:', {
        fileName: videoFile.name,
        trigger,
        category,
        size: videoFile.size
      });

      // Validar formato
      const validFormats = ['video/mp4', 'video/avi', 'video/mov', 'video/webm'];
      if (!validFormats.includes(videoFile.type)) {
        throw new Error('Formato não suportado. Use MP4, AVI, MOV ou WebM.');
      }

      // Validar tamanho (100MB máximo)
      if (videoFile.size > 100 * 1024 * 1024) {
        throw new Error('Vídeo muito grande. Máximo 100MB.');
      }

      // Converter para base64
      const videoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(videoFile);
      });

      console.log('✅ [UPLOAD-VIDEO] Conversão base64 concluída:', {
        base64Length: videoBase64.length,
        format: videoFile.type
      });

      // Determinar formato
      let format: 'mp4' | 'avi' | 'mov' | 'webm' = 'mp4';
      if (videoFile.type.includes('avi')) format = 'avi';
      else if (videoFile.type.includes('mov')) format = 'mov';
      else if (videoFile.type.includes('webm')) format = 'webm';

      const videoItem: VideoLibraryItem = {
        id: `video_${Date.now()}`,
        name: videoFile.name,
        trigger: trigger.toLowerCase(),
        url: '',
        videoBase64: videoBase64,
        format: format,
        size: videoFile.size,
        category: category,
        uploaded_at: new Date().toISOString()
      };

      // ✅ BUSCAR OU CRIAR CONFIGURAÇÕES
      const settings = await this.getAssistantAdvancedSettings(assistantId);
      if (!settings) {
        throw new Error('Não foi possível carregar ou criar configurações do assistente');
      }
      
      // Verificar se trigger já existe (usando || [] como fallback)
      const existingTrigger = (settings.video_library || []).find(vid => vid.trigger === trigger.toLowerCase());
      if (existingTrigger) {
        throw new Error(`Trigger "${trigger}" já existe na biblioteca.`);
      }

      // ✅ GARANTIR QUE video_library EXISTE
      const updatedSettings = {
        ...settings,
        video_library: [...(settings.video_library || []), videoItem]
      };
      
      await this.updateAdvancedSettings(assistantId, updatedSettings);
      
      console.log('✅ [UPLOAD-VIDEO] Vídeo salvo na biblioteca:', {
        trigger: trigger.toLowerCase(),
        format,
        librarySize: updatedSettings.video_library.length
      });

      return videoItem;
    } catch (error) {
      console.error('❌ [UPLOAD-VIDEO] Erro ao fazer upload do vídeo:', error);
      throw error;
    }
  },

  async removeVideoFromLibrary(assistantId: string, videoId: string): Promise<void> {
    try {
      const settings = await this.getAssistantAdvancedSettings(assistantId);
      if (settings) {
        const updatedSettings = {
          ...settings,
          video_library: (settings.video_library || []).filter(video => video.id !== videoId)
        };
        await this.updateAdvancedSettings(assistantId, updatedSettings);
      }
    } catch (error) {
      console.error('Erro ao remover vídeo da biblioteca:', error);
      throw error;
    }
  }
};
