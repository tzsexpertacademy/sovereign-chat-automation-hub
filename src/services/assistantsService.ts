
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
  }
};
