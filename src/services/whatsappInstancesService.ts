
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

  async updateInstance(instanceId: string, updates: WhatsAppInstanceUpdate): Promise<WhatsAppInstanceData | null> {
    console.log('🔄 Atualizando instância por instance_id:', { instanceId, updates });
    
    // Verificar se a instância existe antes de tentar atualizar
    const existing = await this.getInstanceByInstanceId(instanceId);
    if (!existing) {
      console.warn(`⚠️ Instância não encontrada no BD: ${instanceId}`);
      return null;
    }
    
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .update(updates)
      .eq("instance_id", instanceId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao atualizar instância:', error);
      throw error;
    }

    if (!data) {
      console.warn('⚠️ Nenhuma instância foi atualizada');
      return null;
    }

    console.log('✅ Instância atualizada:', data);
    return data;
  }

  async saveInstanceJWT(instanceId: string, authJWT: string): Promise<WhatsAppInstanceData | null> {
    console.log('🔑 Salvando JWT da instância:', instanceId);
    
    return this.updateInstance(instanceId, {
      auth_jwt: authJWT,
      updated_at: new Date().toISOString()
    });
  }

  async updateInstanceById(id: string, updates: WhatsAppInstanceUpdate): Promise<WhatsAppInstanceData | null> {
    console.log('🔄 Atualizando instância por ID:', { id, updates });
    
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao atualizar instância por ID:', error);
      throw error;
    }

    if (!data) {
      console.warn('⚠️ Nenhuma instância foi atualizada por ID');
      return null;
    }

    console.log('✅ Instância atualizada por ID:', data);
    return data;
  }

  async updateCustomName(instanceId: string, customName: string): Promise<WhatsAppInstanceData> {
    console.log('📝 Atualizando nome personalizado:', { instanceId, customName });
    
    return this.updateInstance(instanceId, { 
      custom_name: customName,
      updated_at: new Date().toISOString()
    });
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
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar instância:', error);
      throw error;
    }

    return data || null;
  }

  async updateInstanceStatus(instanceId: string, status: string, additionalData?: Partial<WhatsAppInstanceUpdate>): Promise<void> {
    const updates: WhatsAppInstanceUpdate = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    const result = await this.updateInstance(instanceId, updates);
    if (!result) {
      console.warn(`⚠️ Falha ao atualizar status de ${instanceId} - instância pode ter sido removida`);
    }
  }

  async updateInstanceByInstanceId(instanceId: string, updates: WhatsAppInstanceUpdate): Promise<WhatsAppInstanceData> {
    console.log(`🔄 Atualizando instância por instance_id: ${instanceId}`, updates);
    
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
}

export const whatsappInstancesService = new WhatsAppInstancesService();
