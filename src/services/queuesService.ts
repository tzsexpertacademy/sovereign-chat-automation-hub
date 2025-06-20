
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Queue = Tables<"queues">;
export type QueueInsert = TablesInsert<"queues">;
export type QueueUpdate = TablesUpdate<"queues">;

export interface QueueWithAssistant extends Queue {
  assistants?: Tables<"assistants"> | null;
  instance_queue_connections?: Tables<"instance_queue_connections">[];
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
    const { error } = await supabase
      .from("queues")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async connectInstanceToQueue(instanceId: string, queueId: string): Promise<void> {
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
  }
};
