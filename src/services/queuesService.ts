
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Queue = Tables<"queues">;
export type QueueInsert = TablesInsert<"queues">;
export type QueueUpdate = TablesUpdate<"queues">;

export interface QueueWithAssistant extends Queue {
  assistants?: Tables<"assistants"> | null;
  instance_queue_connections?: Array<{
    id: string;
    instance_id: string;
    queue_id: string;
    is_active: boolean;
    created_at: string;
    whatsapp_instances?: {
      id: string;
      instance_id: string;
      phone_number?: string;
      status: string;
      custom_name?: string;
    };
  }>;
  tags?: Tables<"funnel_tags">[];
}

export class QueuesService {
  async getClientQueues(clientId: string): Promise<QueueWithAssistant[]> {
    console.log('🔍 Buscando filas para cliente:', clientId);
    
    const { data, error } = await supabase
      .from("queues")
      .select(`
        *,
        assistants(*),
        instance_queue_connections(
          *,
          whatsapp_instances(
            id,
            instance_id,
            phone_number,
            status,
            custom_name
          )
        )
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar filas:', error);
      throw error;
    }
    
    console.log('✅ Filas carregadas:', data);
    return data || [];
  }

  async createQueue(queue: QueueInsert): Promise<Queue> {
    const { data, error } = await supabase
      .from("queues")
      .insert(queue)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateQueue(id: string, updates: QueueUpdate): Promise<Queue> {
    const { data, error } = await supabase
      .from("queues")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteQueue(id: string): Promise<void> {
    // First disconnect all instances from this queue
    await this.disconnectAllInstancesFromQueue(id);
    
    const { data, error } = await supabase
      .from("queues")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  async connectInstanceToQueue(instanceId: string, queueId: string): Promise<void> {
    console.log('🔗 Conectando instância à fila:', { instanceId, queueId });
    
    // Buscar a instância pelo instance_id
    const { data: instanceData, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("instance_id", instanceId)
      .single();

    if (instanceError || !instanceData) {
      console.error('❌ Instância não encontrada:', instanceError);
      throw new Error(`Instância ${instanceId} não encontrada`);
    }

    const instanceUuid = instanceData.id;

    // Desconectar de todas as outras filas primeiro
    await this.disconnectInstanceFromAllQueues(instanceUuid);
    
    // Se é "human", não criar conexão
    if (queueId === "human") {
      console.log('👥 Configurando para interação humana (sem fila)');
      return;
    }

    // Conectar à nova fila
    const { error } = await supabase
      .from("instance_queue_connections")
      .upsert({ 
        instance_id: instanceUuid, 
        queue_id: queueId,
        is_active: true 
      }, { 
        onConflict: "instance_id,queue_id" 
      });

    if (error) {
      console.error('❌ Erro ao conectar à fila:', error);
      throw error;
    }

    console.log('✅ Instância conectada à fila com sucesso');
  }

  async disconnectInstanceFromQueue(instanceId: string, queueId: string): Promise<void> {
    console.log('🔌 Desconectando instância da fila:', { instanceId, queueId });
    
    // Buscar a instância pelo instance_id
    const { data: instanceData, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("instance_id", instanceId)
      .single();

    if (instanceError || !instanceData) {
      throw new Error(`Instância ${instanceId} não encontrada`);
    }

    const instanceUuid = instanceData.id;

    const { error } = await supabase
      .from("instance_queue_connections")
      .delete()
      .eq("instance_id", instanceUuid)
      .eq("queue_id", queueId);

    if (error) {
      console.error('❌ Erro ao desconectar:', error);
      throw error;
    }
    
    console.log('✅ Instância desconectada da fila');
  }

  async disconnectInstanceFromAllQueues(instanceUuid: string): Promise<void> {
    console.log('🔄 Desconectando instância de todas as filas:', instanceUuid);
    
    const { error } = await supabase
      .from("instance_queue_connections")
      .delete()
      .eq("instance_id", instanceUuid);

    if (error) {
      console.error('❌ Erro ao desconectar de todas as filas:', error);
      throw error;
    }
    
    console.log('✅ Instância desconectada de todas as filas');
  }

  async disconnectAllInstancesFromQueue(queueId: string): Promise<void> {
    const { error } = await supabase
      .from("instance_queue_connections")
      .delete()
      .eq("queue_id", queueId);

    if (error) throw error;
  }

  async getInstanceConnections(instanceId: string): Promise<QueueWithAssistant[]> {
    console.log('🔍 Buscando conexões da instância:', instanceId);
    
    // Buscar a instância pelo instance_id
    const { data: instanceData, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("instance_id", instanceId)
      .single();

    if (instanceError || !instanceData) {
      console.log('❌ Instância não encontrada para conexões:', instanceId);
      return [];
    }

    const instanceUuid = instanceData.id;

    const { data, error } = await supabase
      .from("instance_queue_connections")
      .select(`
        queue_id,
        queues!inner(
          *,
          assistants(*)
        )
      `)
      .eq("instance_id", instanceUuid)
      .eq("is_active", true);

    if (error) {
      console.error('❌ Erro ao buscar conexões:', error);
      throw error;
    }
    
    console.log('✅ Conexões encontradas:', data?.length || 0);
    return (data || []).map(item => ({
      ...item.queues,
      instance_queue_connections: []
    })) as QueueWithAssistant[];
  }

  async getQueueConnections(queueId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("instance_queue_connections")
      .select(`
        whatsapp_instances!inner(
          instance_id
        )
      `)
      .eq("queue_id", queueId)
      .eq("is_active", true);

    if (error) throw error;
    
    return (data || []).map(item => item.whatsapp_instances.instance_id);
  }

  async isInstanceConnectedToQueue(instanceId: string, queueId: string): Promise<boolean> {
    // Buscar a instância pelo instance_id
    const { data: instanceData, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("instance_id", instanceId)
      .single();

    if (instanceError || !instanceData) {
      return false;
    }

    const instanceUuid = instanceData.id;

    const { data, error } = await supabase
      .from("instance_queue_connections")
      .select("id")
      .eq("instance_id", instanceUuid)
      .eq("queue_id", queueId)
      .eq("is_active", true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    return !!data;
  }

  // Métodos para estatísticas e análise
  async getQueueStats(clientId: string) {
    const queues = await this.getClientQueues(clientId);
    
    return {
      total: queues.length,
      active: queues.filter(q => q.is_active).length,
      withAssistants: queues.filter(q => q.assistant_id).length,
      withConnections: queues.filter(q => 
        q.instance_queue_connections && q.instance_queue_connections.length > 0
      ).length
    };
  }

  // Métodos para busca e filtros
  async searchQueues(clientId: string, searchTerm: string): Promise<QueueWithAssistant[]> {
    const { data, error } = await supabase
      .from("queues")
      .select(`
        *,
        assistants(*),
        instance_queue_connections(*)
      `)
      .eq("client_id", clientId)
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getQueuesByAssistant(assistantId: string): Promise<QueueWithAssistant[]> {
    const { data, error } = await supabase
      .from("queues")
      .select(`
        *,
        assistants(*),
        instance_queue_connections(*)
      `)
      .eq("assistant_id", assistantId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  }
}

export const queuesService = new QueuesService();
