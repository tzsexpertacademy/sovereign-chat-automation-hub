
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

export interface AdvancedSettings {
  audio_processing_enabled: boolean;
  voice_cloning_enabled: boolean;
  eleven_labs_voice_id: string;
  eleven_labs_api_key: string;
  response_delay_seconds: number;
  message_processing_delay_seconds: number;
  message_batch_timeout_seconds: number;
  typing_indicator_enabled: boolean;
  recording_indicator_enabled: boolean;
  humanization_level: 'basic' | 'advanced' | 'maximum';
  temperature: number; // Parâmetro de criatividade da IA (0.0 - 2.0)
  max_tokens: number; // Limite máximo de tokens na resposta
  custom_files: Array<{
    id: string;
    name: string;
    type: 'image' | 'pdf' | 'video';
    url: string;
    description?: string;
  }>;
}

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
  }
};
