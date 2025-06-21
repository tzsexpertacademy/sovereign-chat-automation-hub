
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type WhatsAppInstanceData = Tables<"whatsapp_instances"> & {
  custom_name?: string;
};
export type WhatsAppInstanceInsert = TablesInsert<"whatsapp_instances"> & {
  custom_name?: string;
};
export type WhatsAppInstanceUpdate = TablesUpdate<"whatsapp_instances"> & {
  custom_name?: string;
};

export class WhatsAppInstancesService {
  async getInstancesByClientId(clientId: string): Promise<WhatsAppInstanceData[]> {
    console.log('🔍 Buscando instâncias para cliente:', clientId);
    
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar instâncias:', error);
      throw error;
    }

    console.log('✅ Instâncias encontradas:', data?.length || 0);
    return data || [];
  }

  async createInstance(instance: WhatsAppInstanceInsert): Promise<WhatsAppInstanceData> {
    console.log('🚀 Criando nova instância:', instance);
    
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .insert(instance)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar instância:', error);
      throw error;
    }

    console.log('✅ Instância criada:', data);
    return data;
  }

  async updateInstance(instanceId: string, updates: WhatsAppInstanceUpdate): Promise<WhatsAppInstanceData> {
    console.log('🔄 Atualizando instância:', { instanceId, updates });
    
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .update(updates)
      .eq("instance_id", instanceId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar instância:', error);
      throw error;
    }

    console.log('✅ Instância atualizada:', data);
    return data;
  }

  async deleteInstance(instanceId: string): Promise<void> {
    console.log('🗑️ Removendo instância:', instanceId);
    
    const { error } = await supabase
      .from("whatsapp_instances")
      .delete()
      .eq("instance_id", instanceId);

    if (error) {
      console.error('❌ Erro ao remover instância:', error);
      throw error;
    }

    console.log('✅ Instância removida com sucesso');
  }

  async getInstanceByInstanceId(instanceId: string): Promise<WhatsAppInstanceData | null> {
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("instance_id", instanceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar instância:', error);
      throw error;
    }

    return data || null;
  }

  async updateInstanceStatus(instanceId: string, status: string, additionalData?: Partial<WhatsAppInstanceUpdate>): Promise<void> {
    const updates: WhatsAppInstanceUpdate = {
      status,
      ...additionalData
    };

    await this.updateInstance(instanceId, updates);
  }
}

export const whatsappInstancesService = new WhatsAppInstancesService();
