
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

export class QueuesServiceFixed {
  private logDebug(message: string, data?: any) {
    console.log(`🏗️ [QUEUES-SERVICE] ${message}`, data || '');
  }

  private logError(message: string, error: any) {
    console.error(`❌ [QUEUES-SERVICE] ${message}`, error);
  }

  async getClientQueues(clientId: string): Promise<QueueWithAssistant[]> {
    try {
      this.logDebug('Buscando filas para cliente:', clientId);
      
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
        this.logError('Erro ao buscar filas:', error);
        throw error;
      }
      
      this.logDebug('Filas carregadas:', {
        total: data?.length || 0,
        withAssistants: data?.filter(q => q.assistants).length || 0,
        withConnections: data?.filter(q => q.instance_queue_connections?.length > 0).length || 0
      });
      
      return data || [];
    } catch (error) {
      this.logError('Falha ao carregar filas:', error);
      throw error;
    }
  }

  async createQueue(queue: QueueInsert): Promise<Queue> {
    try {
      this.logDebug('Criando nova fila:', { name: queue.name, clientId: queue.client_id });
      
      const { data, error } = await supabase
        .from("queues")
        .insert(queue)
        .select()
        .single();

      if (error) {
        this.logError('Erro ao criar fila:', error);
        throw error;
      }
      
      this.logDebug('Fila criada com sucesso:', data.id);
      return data;
    } catch (error) {
      this.logError('Falha ao criar fila:', error);
      throw error;
    }
  }

  async updateQueue(id: string, updates: QueueUpdate): Promise<Queue> {
    try {
      this.logDebug('Atualizando fila:', { id, updates });
      
      const { data, error } = await supabase
        .from("queues")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        this.logError('Erro ao atualizar fila:', error);
        throw error;
      }
      
      this.logDebug('Fila atualizada com sucesso:', id);
      return data;
    } catch (error) {
      this.logError('Falha ao atualizar fila:', error);
      throw error;
    }
  }

  async deleteQueue(id: string): Promise<void> {
    try {
      this.logDebug('Deletando fila:', id);
      
      // First disconnect all instances from this queue
      await this.disconnectAllInstancesFromQueue(id);
      
      const { error } = await supabase
        .from("queues")
        .delete()
        .eq("id", id);

      if (error) {
        this.logError('Erro ao deletar fila:', error);
        throw error;
      }
      
      this.logDebug('Fila deletada com sucesso:', id);
    } catch (error) {
      this.logError('Falha ao deletar fila:', error);
      throw error;
    }
  }

  async connectInstanceToQueue(instanceId: string, queueId: string): Promise<void> {
    try {
      this.logDebug('Conectando instância à fila:', { instanceId, queueId });
      
      // Buscar a instância pelo instance_id
      const { data: instanceData, error: instanceError } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("instance_id", instanceId)
        .single();

      if (instanceError || !instanceData) {
        this.logError('Instância não encontrada:', { instanceId, error: instanceError });
        throw new Error(`Instância ${instanceId} não encontrada`);
      }

      const instanceUuid = instanceData.id;
      this.logDebug('UUID da instância encontrado:', instanceUuid);

      // Desconectar de todas as outras filas primeiro
      await this.disconnectInstanceFromAllQueues(instanceUuid);
      
      // Se é "human", não criar conexão
      if (queueId === "human") {
        this.logDebug('Configurando para interação humana (sem fila)');
        return;
      }

      // Verificar se já existe conexão
      const { data: existingConnection } = await supabase
        .from("instance_queue_connections")
        .select("id, is_active")
        .eq("instance_id", instanceUuid)
        .eq("queue_id", queueId)
        .maybeSingle();

      if (existingConnection) {
        if (!existingConnection.is_active) {
          // Reativar conexão existente
          const { error: updateError } = await supabase
            .from("instance_queue_connections")
            .update({ is_active: true })
            .eq("id", existingConnection.id);

          if (updateError) {
            this.logError('Erro ao reativar conexão:', updateError);
            throw updateError;
          }
          this.logDebug('Conexão reativada com sucesso');
        } else {
          this.logDebug('Conexão já ativa');
        }
      } else {
        // Criar nova conexão
        const { error: insertError } = await supabase
          .from("instance_queue_connections")
          .insert({ 
            instance_id: instanceUuid, 
            queue_id: queueId,
            is_active: true 
          });

        if (insertError) {
          this.logError('Erro ao criar conexão:', insertError);
          throw insertError;
        }
        this.logDebug('Nova conexão criada com sucesso');
      }

      this.logDebug('Instância conectada à fila com sucesso');
    } catch (error) {
      this.logError('Falha ao conectar instância à fila:', error);
      throw error;
    }
  }

  async disconnectInstanceFromQueue(instanceId: string, queueId: string): Promise<void> {
    try {
      this.logDebug('Desconectando instância da fila:', { instanceId, queueId });
      
      // Buscar a instância pelo instance_id
      const { data: instanceData, error: instanceError } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("instance_id", instanceId)
        .single();

      if (instanceError || !instanceData) {
        this.logError('Instância não encontrada para desconexão:', instanceError);
        throw new Error(`Instância ${instanceId} não encontrada`);
      }

      const instanceUuid = instanceData.id;

      const { error } = await supabase
        .from("instance_queue_connections")
        .delete()
        .eq("instance_id", instanceUuid)
        .eq("queue_id", queueId);

      if (error) {
        this.logError('Erro ao desconectar:', error);
        throw error;
      }
      
      this.logDebug('Instância desconectada da fila');
    } catch (error) {
      this.logError('Falha ao desconectar instância da fila:', error);
      throw error;
    }
  }

  async disconnectInstanceFromAllQueues(instanceUuid: string): Promise<void> {
    try {
      this.logDebug('Desconectando instância de todas as filas:', instanceUuid);
      
      const { error } = await supabase
        .from("instance_queue_connections")
        .delete()
        .eq("instance_id", instanceUuid);

      if (error) {
        this.logError('Erro ao desconectar de todas as filas:', error);
        throw error;
      }
      
      this.logDebug('Instância desconectada de todas as filas');
    } catch (error) {
      this.logError('Falha ao desconectar de todas as filas:', error);
      throw error;
    }
  }

  async disconnectAllInstancesFromQueue(queueId: string): Promise<void> {
    try {
      this.logDebug('Desconectando todas as instâncias da fila:', queueId);
      
      const { error } = await supabase
        .from("instance_queue_connections")
        .delete()
        .eq("queue_id", queueId);

      if (error) {
        this.logError('Erro ao desconectar todas as instâncias:', error);
        throw error;
      }
      
      this.logDebug('Todas as instâncias desconectadas da fila');
    } catch (error) {
      this.logError('Falha ao desconectar todas as instâncias:', error);
      throw error;
    }
  }

  async getInstanceConnections(instanceId: string): Promise<QueueWithAssistant[]> {
    try {
      this.logDebug('Buscando conexões da instância:', instanceId);
      
      // Buscar a instância pelo instance_id
      const { data: instanceData, error: instanceError } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("instance_id", instanceId)
        .single();

      if (instanceError || !instanceData) {
        this.logDebug('Instância não encontrada para conexões:', instanceId);
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
        this.logError('Erro ao buscar conexões:', error);
        throw error;
      }
      
      this.logDebug('Conexões encontradas:', data?.length || 0);
      return (data || []).map(item => ({
        ...item.queues,
        instance_queue_connections: []
      })) as QueueWithAssistant[];
    } catch (error) {
      this.logError('Falha ao buscar conexões da instância:', error);
      throw error;
    }
  }

  async getQueueConnections(queueId: string): Promise<string[]> {
    try {
      this.logDebug('Buscando conexões da fila:', queueId);
      
      const { data, error } = await supabase
        .from("instance_queue_connections")
        .select(`
          whatsapp_instances!inner(
            instance_id
          )
        `)
        .eq("queue_id", queueId)
        .eq("is_active", true);

      if (error) {
        this.logError('Erro ao buscar conexões da fila:', error);
        throw error;
      }
      
      const connections = (data || []).map(item => item.whatsapp_instances.instance_id);
      this.logDebug('Conexões da fila encontradas:', connections.length);
      
      return connections;
    } catch (error) {
      this.logError('Falha ao buscar conexões da fila:', error);
      throw error;
    }
  }

  async isInstanceConnectedToQueue(instanceId: string, queueId: string): Promise<boolean> {
    try {
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

      if (error && error.code !== 'PGRST116') {
        this.logError('Erro ao verificar conexão:', error);
        throw error;
      }
      
      const isConnected = !!data;
      this.logDebug('Verificação de conexão:', { instanceId, queueId, isConnected });
      
      return isConnected;
    } catch (error) {
      this.logError('Falha ao verificar conexão:', error);
      throw error;
    }
  }

  // Métodos para estatísticas e análise
  async getQueueStats(clientId: string) {
    try {
      const queues = await this.getClientQueues(clientId);
      
      const stats = {
        total: queues.length,
        active: queues.filter(q => q.is_active).length,
        withAssistants: queues.filter(q => q.assistant_id).length,
        withConnections: queues.filter(q => 
          q.instance_queue_connections && q.instance_queue_connections.length > 0
        ).length
      };
      
      this.logDebug('Estatísticas das filas:', stats);
      return stats;
    } catch (error) {
      this.logError('Falha ao obter estatísticas:', error);
      throw error;
    }
  }

  // Métodos para busca e filtros
  async searchQueues(clientId: string, searchTerm: string): Promise<QueueWithAssistant[]> {
    try {
      this.logDebug('Buscando filas com termo:', searchTerm);
      
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

      if (error) {
        this.logError('Erro na busca de filas:', error);
        throw error;
      }
      
      this.logDebug('Filas encontradas na busca:', data?.length || 0);
      return data || [];
    } catch (error) {
      this.logError('Falha na busca de filas:', error);
      throw error;
    }
  }

  async getQueuesByAssistant(assistantId: string): Promise<QueueWithAssistant[]> {
    try {
      this.logDebug('Buscando filas por assistente:', assistantId);
      
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

      if (error) {
        this.logError('Erro ao buscar filas por assistente:', error);
        throw error;
      }
      
      this.logDebug('Filas encontradas para assistente:', data?.length || 0);
      return data || [];
    } catch (error) {
      this.logError('Falha ao buscar filas por assistente:', error);
      throw error;
    }
  }
}

export const queuesServiceFixed = new QueuesServiceFixed();
