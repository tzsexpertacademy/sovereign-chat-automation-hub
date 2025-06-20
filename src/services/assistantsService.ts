
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
  }
};
