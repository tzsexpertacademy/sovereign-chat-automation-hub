
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Queue = Tables<"queues">;
export type QueueInsert = TablesInsert<"queues">;
export type QueueUpdate = TablesUpdate<"queues">;

export interface QueueWithAssistant extends Queue {
  assistants?: Tables<"assistants"> | null;
  instance_queue_connections?: Tables<"instance_queue_connections">[];
  tags?: Tables<"funnel_tags">[];
}

export const queuesService = {
  async getClientQueues(clientId: string): Promise<QueueWithAssistant[]> {
    const { data, error } = await supabase
      .from("queues")
      .select(`
        *,
        assistants(*),
        instance_queue_connections(*)
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createQueue(queue: QueueInsert): Promise<Queue> {
    const { data, error } = await supabase
      .from("queues")
      .insert(queue)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateQueue(id: string, updates: QueueUpdate): Promise<Queue> {
    const { data, error } = await supabase
      .from("queues")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteQueue(id: string): Promise<void> {
    // First disconnect all instances from this queue
    await this.disconnectAllInstancesFromQueue(id);
    
    const { error } = await supabase
      .from("queues")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async connectInstanceToQueue(instanceId: string, queueId: string): Promise<void> {
    // First, disconnect instance from all other queues to ensure only one connection
    await this.disconnectInstanceFromAllQueues(instanceId);
    
    const { error } = await supabase
      .from("instance_queue_connections")
      .upsert({ 
        instance_id: instanceId, 
        queue_id: queueId,
        is_active: true 
      }, { 
        onConflict: "instance_id,queue_id" 
      });

    if (error) throw error;
  },

  async disconnectInstanceFromQueue(instanceId: string, queueId: string): Promise<void> {
    const { error } = await supabase
      .from("instance_queue_connections")
      .delete()
      .eq("instance_id", instanceId)
      .eq("queue_id", queueId);

    if (error) throw error;
  },

  async disconnectInstanceFromAllQueues(instanceId: string): Promise<void> {
    const { error } = await supabase
      .from("instance_queue_connections")
      .delete()
      .eq("instance_id", instanceId);

    if (error) throw error;
  },

  async disconnectAllInstancesFromQueue(queueId: string): Promise<void> {
    const { error } = await supabase
      .from("instance_queue_connections")
      .delete()
      .eq("queue_id", queueId);

    if (error) throw error;
  },

  async getInstanceConnections(instanceId: string): Promise<QueueWithAssistant[]> {
    const { data, error } = await supabase
      .from("instance_queue_connections")
      .select(`
        queue_id,
        queues!inner(
          *,
          assistants(*)
        )
      `)
      .eq("instance_id", instanceId)
      .eq("is_active", true);

    if (error) throw error;
    
    return (data || []).map(item => ({
      ...item.queues,
      instance_queue_connections: []
    })) as QueueWithAssistant[];
  },

  async getQueueConnections(queueId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("instance_queue_connections")
      .select("instance_id")
      .eq("queue_id", queueId)
      .eq("is_active", true);

    if (error) throw error;
    
    return (data || []).map(item => item.instance_id);
  },

  async isInstanceConnectedToQueue(instanceId: string, queueId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("instance_queue_connections")
      .select("id")
      .eq("instance_id", instanceId)
      .eq("queue_id", queueId)
      .eq("is_active", true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    return !!data;
  },

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
  },

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
  },

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
};
