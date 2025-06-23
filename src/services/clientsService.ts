
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ClientData = Tables<"clients">;
export type ClientInsert = TablesInsert<"clients">;
export type ClientUpdate = TablesUpdate<"clients">;
export type CreateClientData = ClientInsert; // Adicionar tipo que estava faltando

export class ClientsService {
  async getAllClients(): Promise<ClientData[]> {
    console.log('🔍 Buscando todos os clientes...');
    
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar clientes:', error);
      throw error;
    }

    console.log('✅ Clientes encontrados:', data?.length || 0);
    return data || [];
  }

  async getClientById(id: string): Promise<ClientData | null> {
    console.log('🔍 Buscando cliente por ID:', id);
    
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar cliente:', error);
      throw error;
    }

    console.log('✅ Cliente encontrado:', !!data);
    return data || null;
  }

  async createClient(client: ClientInsert): Promise<ClientData> {
    console.log('🚀 Criando novo cliente:', client);
    
    const { data, error } = await supabase
      .from("clients")
      .insert(client)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar cliente:', error);
      throw error;
    }

    console.log('✅ Cliente criado:', data);
    return data;
  }

  async updateClient(id: string, updates: ClientUpdate): Promise<ClientData> {
    console.log('🔄 Atualizando cliente:', { id, updates });
    
    const { data, error } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
      throw error;
    }

    console.log('✅ Cliente atualizado:', data);
    return data;
  }

  async updateClientInstance(clientId: string, instanceId: string, status: string): Promise<ClientData> {
    console.log('🔄 Atualizando instância do cliente:', { clientId, instanceId, status });
    
    const { data, error } = await supabase
      .from("clients")
      .update({
        instance_id: instanceId,
        instance_status: status,
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", clientId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar instância do cliente:', error);
      throw error;
    }

    console.log('✅ Instância do cliente atualizada:', data);
    return data;
  }

  async deleteClient(id: string): Promise<void> {
    console.log('🗑️ Removendo cliente:', id);
    
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) {
      console.error('❌ Erro ao remover cliente:', error);
      throw error;
    }

    console.log('✅ Cliente removido com sucesso');
  }

  async canCreateInstance(clientId: string): Promise<boolean> {
    console.log('🔍 Verificando se pode criar instância para cliente:', clientId);
    
    try {
      const client = await this.getClientById(clientId);
      if (!client) {
        console.log('❌ Cliente não encontrado');
        return false;
      }

      const currentInstances = client.current_instances || 0;
      const maxInstances = client.max_instances || 1;
      
      console.log('📊 Verificação de limite:', { currentInstances, maxInstances });
      
      const canCreate = currentInstances < maxInstances;
      console.log('✅ Pode criar instância:', canCreate);
      
      return canCreate;
    } catch (error) {
      console.error('❌ Erro ao verificar limite de instâncias:', error);
      return false;
    }
  }

  async updateInstanceCount(clientId: string): Promise<void> {
    console.log('🔄 Atualizando contador de instâncias para cliente:', clientId);
    
    try {
      // Buscar quantidade atual de instâncias
      const { data: instances, error: instancesError } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("client_id", clientId);

      if (instancesError) {
        console.error('❌ Erro ao buscar instâncias:', instancesError);
        throw instancesError;
      }

      const currentCount = instances?.length || 0;
      
      // Atualizar contador no cliente
      await this.updateClient(clientId, {
        current_instances: currentCount,
        updated_at: new Date().toISOString()
      });

      console.log('✅ Contador de instâncias atualizado:', currentCount);
    } catch (error) {
      console.error('❌ Erro ao atualizar contador de instâncias:', error);
      throw error;
    }
  }

  async getClientStats(clientId: string) {
    console.log('📊 Buscando estatísticas do cliente:', clientId);
    
    try {
      const client = await this.getClientById(clientId);
      if (!client) return null;

      // Buscar estatísticas adicionais se necessário
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("status")
        .eq("client_id", clientId);

      const connectedInstances = instances?.filter(i => i.status === 'connected').length || 0;
      const totalInstances = instances?.length || 0;

      return {
        ...client,
        connected_instances: connectedInstances,
        total_instances: totalInstances
      };
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return null;
    }
  }
}

export const clientsService = new ClientsService();
