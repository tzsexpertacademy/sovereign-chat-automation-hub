
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type AIConfig = Tables<"client_ai_configs">;
export type AIConfigInsert = TablesInsert<"client_ai_configs">;
export type AIConfigUpdate = TablesUpdate<"client_ai_configs">;

export const aiConfigService = {
  async getClientConfig(clientId: string): Promise<AIConfig | null> {
    const { data, error } = await supabase
      .from("client_ai_configs")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createOrUpdateConfig(config: AIConfigInsert): Promise<AIConfig> {
    const { data, error } = await supabase
      .from("client_ai_configs")
      .upsert(config, { onConflict: "client_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateConfig(clientId: string, updates: AIConfigUpdate): Promise<AIConfig> {
    const { data, error } = await supabase
      .from("client_ai_configs")
      .update(updates)
      .eq("client_id", clientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async validateOpenAIKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return { valid: true };
      } else {
        const errorData = await response.json();
        return { valid: false, error: errorData.error?.message || 'Invalid API key' };
      }
    } catch (error) {
      return { valid: false, error: 'Network error during validation' };
    }
  }
};
