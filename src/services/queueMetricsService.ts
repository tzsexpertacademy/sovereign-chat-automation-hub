import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface QueueMetrics {
  queue_id: string;
  queue_name: string;
  active_tickets: number;
  pending_tickets: number;
  resolved_tickets: number;
  avg_response_time_minutes: number;
  avg_resolution_time_minutes: number;
  ai_success_rate: number;
  human_handoff_rate: number;
  customer_satisfaction_avg: number;
  last_24h_activity: number;
  total_conversations: number;
  escalation_rate: number;
  workload_score: number;
}

export interface QueueTransferRule {
  id: string;
  from_queue_id: string;
  to_queue_id: string;
  trigger_conditions: {
    keywords?: string[];
    wait_time_minutes?: number;
    failed_attempts?: number;
    customer_sentiment?: 'negative' | 'neutral' | 'positive';
    time_based?: {
      start_time: string;
      end_time: string;
      days_of_week: number[];
    };
  };
  is_active: boolean;
  priority: number;
}

export class QueueMetricsService {
  async getQueueMetrics(clientId: string): Promise<QueueMetrics[]> {
    console.log('📊 Buscando métricas das filas para cliente:', clientId);
    
    try {
      // Buscar filas do cliente
      const { data: queues, error: queuesError } = await supabase
        .from("queues")
        .select("id, name")
        .eq("client_id", clientId)
        .eq("is_active", true);

      if (queuesError) throw queuesError;

      const metrics: QueueMetrics[] = [];

      for (const queue of queues || []) {
        // Tickets ativos
        const { count: activeCount } = await supabase
          .from("conversation_tickets")
          .select("*", { count: 'exact', head: true })
          .eq("assigned_queue_id", queue.id)
          .in("status", ["open", "pending", "in_progress"]);

        // Tickets pendentes (sem resposta humana)
        const { count: pendingCount } = await supabase
          .from("conversation_tickets")
          .select("*", { count: 'exact', head: true })
          .eq("assigned_queue_id", queue.id)
          .eq("status", "pending");

        // Tickets resolvidos nas últimas 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: resolvedCount } = await supabase
          .from("conversation_tickets")
          .select("*", { count: 'exact', head: true })
          .eq("assigned_queue_id", queue.id)
          .eq("status", "resolved")
          .gte("updated_at", yesterday);

        // Atividade nas últimas 24h
        const { count: recentActivity } = await supabase
          .from("conversation_tickets")
          .select("*", { count: 'exact', head: true })
          .eq("assigned_queue_id", queue.id)
          .gte("last_activity_at", yesterday);

        // Total de conversas
        const { count: totalConversations } = await supabase
          .from("conversation_tickets")
          .select("*", { count: 'exact', head: true })
          .eq("assigned_queue_id", queue.id);

        // Buscar métricas detalhadas da tabela queue_metrics
        const { data: detailedMetrics } = await supabase
          .from("queue_metrics")
          .select("*")
          .eq("queue_id", queue.id)
          .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order("date", { ascending: false });

        // Calcular médias das métricas detalhadas
        const avgMetrics = this.calculateAverageMetrics(detailedMetrics || []);

        // Calcular score de carga de trabalho (0-100)
        const workloadScore = this.calculateWorkloadScore(activeCount || 0, pendingCount || 0);

        metrics.push({
          queue_id: queue.id,
          queue_name: queue.name,
          active_tickets: activeCount || 0,
          pending_tickets: pendingCount || 0,
          resolved_tickets: resolvedCount || 0,
          avg_response_time_minutes: avgMetrics.avg_response_time || 0,
          avg_resolution_time_minutes: avgMetrics.avg_resolution_time || 0,
          ai_success_rate: avgMetrics.ai_success_rate || 0,
          human_handoff_rate: avgMetrics.human_handoff_rate || 0,
          customer_satisfaction_avg: avgMetrics.customer_satisfaction || 0,
          last_24h_activity: recentActivity || 0,
          total_conversations: totalConversations || 0,
          escalation_rate: this.calculateEscalationRate(detailedMetrics || []),
          workload_score: workloadScore
        });
      }

      console.log('✅ Métricas calculadas:', metrics);
      return metrics;
    } catch (error) {
      console.error('❌ Erro ao buscar métricas:', error);
      throw error;
    }
  }

  async transferTicketBetweenQueues(
    ticketId: string,
    fromQueueId: string | null,
    toQueueId: string,
    reason: string,
    transferType: 'manual' | 'automatic' | 'escalation' = 'manual',
    initiatedBy?: string
  ): Promise<boolean> {
    try {
      console.log('🔄 Transferindo ticket:', { ticketId, fromQueueId, toQueueId, reason });

      // Atualizar ticket
      const { error: updateError } = await supabase
        .from("conversation_tickets")
        .update({
          assigned_queue_id: toQueueId,
          status: 'open',
          updated_at: new Date().toISOString()
        })
        .eq("id", ticketId);

      if (updateError) throw updateError;

      // Registrar transferência
      const { error: transferError } = await supabase
        .from("queue_transfers")
        .insert({
          ticket_id: ticketId,
          from_queue_id: fromQueueId,
          to_queue_id: toQueueId,
          transfer_reason: reason,
          transfer_type: transferType,
          initiated_by: initiatedBy
        });

      if (transferError) throw transferError;

      console.log('✅ Ticket transferido com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao transferir ticket:', error);
      return false;
    }
  }

  async checkAutomaticTransferRules(queueId: string, ticketId: string): Promise<{
    shouldTransfer: boolean;
    targetQueueId?: string;
    reason?: string;
  }> {
    try {
      // Buscar regras de transferência ativas para esta fila
      // Como não temos tabela de regras ainda, vamos simular algumas regras básicas
      
      // Verificar se a fila está sobrecarregada
      const { count: activeTickets } = await supabase
        .from("conversation_tickets")
        .select("*", { count: 'exact', head: true })
        .eq("assigned_queue_id", queueId)
        .in("status", ["open", "pending", "in_progress"]);

      // Se mais de 10 tickets ativos, procurar fila alternativa
      if (activeTickets && activeTickets > 10) {
        const { data: alternativeQueues } = await supabase
          .from("queues")
          .select("id, name")
          .neq("id", queueId)
          .eq("is_active", true)
          .limit(1);

        if (alternativeQueues && alternativeQueues.length > 0) {
          return {
            shouldTransfer: true,
            targetQueueId: alternativeQueues[0].id,
            reason: "Fila sobrecarregada - transferência automática"
          };
        }
      }

      return { shouldTransfer: false };
    } catch (error) {
      console.error('❌ Erro ao verificar regras de transferência:', error);
      return { shouldTransfer: false };
    }
  }

  private calculateAverageMetrics(metrics: Tables<"queue_metrics">[]) {
    if (metrics.length === 0) {
      return {
        avg_response_time: 0,
        avg_resolution_time: 0,
        ai_success_rate: 0,
        human_handoff_rate: 0,
        customer_satisfaction: 0
      };
    }

    const totals = metrics.reduce((acc, metric) => ({
      response_time: acc.response_time + (metric.avg_response_time_minutes || 0),
      resolution_time: acc.resolution_time + (metric.avg_resolution_time_minutes || 0),
      ai_success: acc.ai_success + (metric.ai_success_rate || 0),
      handoff_rate: acc.handoff_rate + (metric.human_handoff_rate || 0),
      satisfaction: acc.satisfaction + (metric.customer_satisfaction_avg || 0)
    }), {
      response_time: 0,
      resolution_time: 0,
      ai_success: 0,
      handoff_rate: 0,
      satisfaction: 0
    });

    return {
      avg_response_time: totals.response_time / metrics.length,
      avg_resolution_time: totals.resolution_time / metrics.length,
      ai_success_rate: totals.ai_success / metrics.length,
      human_handoff_rate: totals.handoff_rate / metrics.length,
      customer_satisfaction: totals.satisfaction / metrics.length
    };
  }

  private calculateWorkloadScore(activeTickets: number, pendingTickets: number): number {
    // Score de 0-100 baseado na carga de trabalho
    const totalTickets = activeTickets + pendingTickets;
    const maxRecommended = 15; // Número máximo recomendado de tickets
    
    if (totalTickets === 0) return 0;
    
    const score = Math.min((totalTickets / maxRecommended) * 100, 100);
    return Math.round(score);
  }

  private calculateEscalationRate(metrics: Tables<"queue_metrics">[]): number {
    if (metrics.length === 0) return 0;
    
    const totalReceived = metrics.reduce((sum, m) => sum + (m.tickets_received || 0), 0);
    const totalHandoffs = metrics.reduce((sum, m) => sum + (m.human_handoff_rate || 0), 0);
    
    return totalReceived > 0 ? (totalHandoffs / totalReceived) * 100 : 0;
  }
}

export const queueMetricsService = new QueueMetricsService();