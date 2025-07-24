/**
 * Serviço de Orquestração de Filas - FASE 2
 * Gerencia o fluxo: Conexão → Fila → Assistente
 */

import { supabase } from '@/integrations/supabase/client';

export interface QueueAssignmentResult {
  success: boolean;
  queueId?: string;
  queueName?: string;
  assistantId?: string;
  assistantName?: string;
  autoProcessing: boolean;
  error?: string;
}

export interface QueueMetrics {
  queueId: string;
  queueName: string;
  activeTickets: number;
  resolvedToday: number;
  avgResponseTime: number;
  aiSuccessRate: number;
  humanHandoffRate: number;
}

class QueueOrchestrationService {
  /**
   * Auto-atribuir fila para nova mensagem
   */
  async autoAssignQueue(
    clientId: string,
    instanceId: string,
    chatId: string,
    messageContent: string = ''
  ): Promise<QueueAssignmentResult> {
    try {
      console.log('🎯 [QUEUE-ORCHESTRATION] Auto-atribuindo fila:', {
        clientId,
        instanceId,
        chatId
      });

      // Usar função SQL para auto-atribuição
      const { data: queueId, error } = await supabase
        .rpc('auto_assign_queue', {
          p_client_id: clientId,
          p_instance_id: instanceId,
          p_message_content: messageContent
        });

      if (error || !queueId) {
        console.log('⚠️ [QUEUE-ORCHESTRATION] Nenhuma fila disponível');
        return {
          success: false,
          autoProcessing: false,
          error: 'Nenhuma fila disponível'
        };
      }

      // Buscar detalhes da fila atribuída
      const queueDetails = await this.getQueueDetails(queueId);
      
      console.log('✅ [QUEUE-ORCHESTRATION] Fila atribuída:', queueDetails);
      
      return {
        success: true,
        ...queueDetails,
        autoProcessing: queueDetails.assistantId ? true : false
      };

    } catch (error) {
      console.error('❌ [QUEUE-ORCHESTRATION] Erro na auto-atribuição:', error);
      return {
        success: false,
        autoProcessing: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Transferir ticket entre filas
   */
  async transferTicket(
    ticketId: string,
    fromQueueId: string | null,
    toQueueId: string,
    reason: string,
    transferType: 'manual' | 'automatic' | 'escalation' = 'manual',
    initiatedBy: string = 'system'
  ): Promise<boolean> {
    try {
      console.log('🔄 [QUEUE-ORCHESTRATION] Transferindo ticket:', {
        ticketId,
        fromQueueId,
        toQueueId,
        reason,
        transferType
      });

      // Atualizar ticket
      const { error: ticketError } = await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: toQueueId,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (ticketError) {
        throw ticketError;
      }

      // Registrar transferência
      const { error: transferError } = await supabase
        .from('queue_transfers')
        .insert({
          ticket_id: ticketId,
          from_queue_id: fromQueueId,
          to_queue_id: toQueueId,
          transfer_reason: reason,
          transfer_type: transferType,
          initiated_by: initiatedBy
        });

      if (transferError) {
        console.error('⚠️ Erro ao registrar transferência:', transferError);
        // Não falhar se o registro da transferência falhar
      }

      console.log('✅ [QUEUE-ORCHESTRATION] Ticket transferido com sucesso');
      return true;

    } catch (error) {
      console.error('❌ [QUEUE-ORCHESTRATION] Erro na transferência:', error);
      return false;
    }
  }

  /**
   * Obter métricas das filas de um cliente
   */
  async getClientQueueMetrics(clientId: string): Promise<QueueMetrics[]> {
    try {
      const { data: queues, error } = await supabase
        .from('queues')
        .select(`
          id,
          name,
          assistants:assistant_id (
            id,
            name
          )
        `)
        .eq('client_id', clientId)
        .eq('is_active', true);

      if (error || !queues) {
        throw error || new Error('Filas não encontradas');
      }

      const metrics: QueueMetrics[] = [];

      for (const queue of queues) {
        // Contar tickets ativos
        const { count: activeTickets } = await supabase
          .from('conversation_tickets')
          .select('*', { count: 'exact' })
          .eq('assigned_queue_id', queue.id)
          .in('status', ['open', 'pending']);

        // Buscar métricas do dia
        const { data: dayMetrics } = await supabase
          .from('queue_metrics')
          .select('*')
          .eq('queue_id', queue.id)
          .eq('date', new Date().toISOString().split('T')[0])
          .single();

        metrics.push({
          queueId: queue.id,
          queueName: queue.name,
          activeTickets: activeTickets || 0,
          resolvedToday: dayMetrics?.tickets_resolved || 0,
          avgResponseTime: dayMetrics?.avg_response_time_minutes || 0,
          aiSuccessRate: dayMetrics?.ai_success_rate || 0,
          humanHandoffRate: dayMetrics?.human_handoff_rate || 0
        });
      }

      return metrics;

    } catch (error) {
      console.error('❌ [QUEUE-ORCHESTRATION] Erro ao buscar métricas:', error);
      return [];
    }
  }

  /**
   * Verificar se fila precisa de escalation
   */
  async checkEscalationTriggers(queueId: string): Promise<{
    needsEscalation: boolean;
    reason?: string;
    suggestedQueue?: string;
  }> {
    try {
      // Buscar fila e suas configurações
      const { data: queue } = await supabase
        .from('queues')
        .select('*, handoff_triggers, max_concurrent_tickets')
        .eq('id', queueId)
        .single();

      if (!queue) {
        return { needsEscalation: false };
      }

      // Verificar carga da fila
      const { count: currentLoad } = await supabase
        .from('conversation_tickets')
        .select('*', { count: 'exact' })
        .eq('assigned_queue_id', queueId)
        .in('status', ['open', 'pending']);

      // Se exceder capacidade máxima
      if (currentLoad && currentLoad >= queue.max_concurrent_tickets) {
        return {
          needsEscalation: true,
          reason: `Fila sobrecarregada (${currentLoad}/${queue.max_concurrent_tickets})`,
          suggestedQueue: await this.findAlternativeQueue(queue.client_id, queueId)
        };
      }

      // Verificar gatilhos personalizados
      if (Array.isArray(queue.handoff_triggers)) {
        for (const trigger of queue.handoff_triggers) {
          // Implementar lógica de gatilhos personalizados aqui
          // Por enquanto, retorna false
        }
      }

      return { needsEscalation: false };

    } catch (error) {
      console.error('❌ [QUEUE-ORCHESTRATION] Erro ao verificar escalation:', error);
      return { needsEscalation: false };
    }
  }

  /**
   * Buscar detalhes de uma fila
   */
  private async getQueueDetails(queueId: string): Promise<Partial<QueueAssignmentResult>> {
    const { data: queue } = await supabase
      .from('queues')
      .select(`
        id,
        name,
        assistants:assistant_id (
          id,
          name
        )
      `)
      .eq('id', queueId)
      .single();

    if (!queue) {
      throw new Error('Fila não encontrada');
    }

    return {
      queueId: queue.id,
      queueName: queue.name,
      assistantId: queue.assistants?.id,
      assistantName: queue.assistants?.name
    };
  }

  /**
   * Encontrar fila alternativa para transferência
   */
  private async findAlternativeQueue(clientId: string, excludeQueueId: string): Promise<string | undefined> {
    const { data: queues } = await supabase
      .from('queues')
      .select('id')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .neq('id', excludeQueueId)
      .limit(1);

    return queues?.[0]?.id;
  }
}

// Instância singleton
export const queueOrchestrationService = new QueueOrchestrationService();
export default queueOrchestrationService;