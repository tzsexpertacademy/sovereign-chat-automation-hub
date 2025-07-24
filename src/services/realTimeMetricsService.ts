import { supabase } from "@/integrations/supabase/client";

export interface DashboardMetrics {
  totalConnections: number;
  activeConnections: number;
  totalTickets: number;
  openTickets: number;
  pendingTickets: number;
  closedTickets: number;
  totalQueues: number;
  activeQueues: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalAssistants: number;
  activeAssistants: number;
  messagesLast24h: number;
  responseRate: number;
  averageResponseTime: number;
}

export interface HourlyActivity {
  hour: string;
  messages: number;
  tickets: number;
  resolved: number;
}

export interface QueueMetrics {
  queueId: string;
  queueName: string;
  ticketsCount: number;
  averageResponseTime: number;
  resolutionRate: number;
  assistantName?: string;
}

export const realTimeMetricsService = {
  async getDashboardMetrics(clientId: string): Promise<DashboardMetrics> {
    try {
      // Buscar métricas das instâncias
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('status')
        .eq('client_id', clientId);

      // Buscar métricas dos tickets
      const { data: tickets } = await supabase
        .from('conversation_tickets')
        .select('status, created_at')
        .eq('client_id', clientId);

      // Buscar métricas das filas
      const { data: queues } = await supabase
        .from('queues')
        .select('is_active')
        .eq('client_id', clientId);

      // Buscar métricas das campanhas
      const { data: campaigns } = await supabase
        .from('automated_campaigns')
        .select('is_active')
        .eq('client_id', clientId);

      // Buscar métricas dos assistentes
      const { data: assistants } = await supabase
        .from('assistants')
        .select('is_active')
        .eq('client_id', clientId);

      // Calcular estatísticas
      const totalConnections = instances?.length || 0;
      const activeConnections = instances?.filter(i => i.status === 'connected').length || 0;
      
      const totalTickets = tickets?.length || 0;
      const openTickets = tickets?.filter(t => t.status === 'open').length || 0;
      const pendingTickets = tickets?.filter(t => t.status === 'pending').length || 0;
      const closedTickets = tickets?.filter(t => ['resolved', 'closed'].includes(t.status)).length || 0;

      const totalQueues = queues?.length || 0;
      const activeQueues = queues?.filter(q => q.is_active).length || 0;

      const totalCampaigns = campaigns?.length || 0;
      const activeCampaigns = campaigns?.filter(c => c.is_active).length || 0;

      const totalAssistants = assistants?.length || 0;
      const activeAssistants = assistants?.filter(a => a.is_active).length || 0;

      // Calcular mensagens das últimas 24h
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const messagesLast24h = tickets?.filter(t => 
        new Date(t.created_at) > last24h
      ).length || 0;

      return {
        totalConnections,
        activeConnections,
        totalTickets,
        openTickets,
        pendingTickets,
        closedTickets,
        totalQueues,
        activeQueues,
        totalCampaigns,
        activeCampaigns,
        totalAssistants,
        activeAssistants,
        messagesLast24h,
        responseRate: totalTickets > 0 ? (closedTickets / totalTickets) * 100 : 0,
        averageResponseTime: 15 // Mock por enquanto
      };
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      throw error;
    }
  },

  async getHourlyActivity(clientId: string): Promise<HourlyActivity[]> {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const { data: tickets } = await supabase
        .from('conversation_tickets')
        .select('created_at, status')
        .eq('client_id', clientId)
        .gte('created_at', last24h.toISOString());

      // Agrupar por hora
      const hourlyData: { [key: string]: HourlyActivity } = {};
      
      for (let i = 0; i < 24; i++) {
        const hour = new Date(Date.now() - i * 60 * 60 * 1000);
        const hourKey = hour.getHours().toString().padStart(2, '0') + ':00';
        hourlyData[hourKey] = {
          hour: hourKey,
          messages: 0,
          tickets: 0,
          resolved: 0
        };
      }

      tickets?.forEach(ticket => {
        const hour = new Date(ticket.created_at).getHours();
        const hourKey = hour.toString().padStart(2, '0') + ':00';
        
        if (hourlyData[hourKey]) {
          hourlyData[hourKey].tickets++;
          hourlyData[hourKey].messages++;
          if (['resolved', 'closed'].includes(ticket.status)) {
            hourlyData[hourKey].resolved++;
          }
        }
      });

      return Object.values(hourlyData).reverse();
    } catch (error) {
      console.error('Erro ao buscar atividade por hora:', error);
      return [];
    }
  },

  async getQueueMetrics(clientId: string): Promise<QueueMetrics[]> {
    try {
      const { data: queues } = await supabase
        .from('queues')
        .select(`
          id,
          name,
          assistants (name)
        `)
        .eq('client_id', clientId)
        .eq('is_active', true);

      const queueMetrics: QueueMetrics[] = [];

      for (const queue of queues || []) {
        const { data: tickets } = await supabase
          .from('conversation_tickets')
          .select('status, created_at')
          .eq('assigned_queue_id', queue.id);

        const ticketsCount = tickets?.length || 0;
        const resolvedCount = tickets?.filter(t => 
          ['resolved', 'closed'].includes(t.status)
        ).length || 0;

        queueMetrics.push({
          queueId: queue.id,
          queueName: queue.name,
          ticketsCount,
          averageResponseTime: 15, // Mock
          resolutionRate: ticketsCount > 0 ? (resolvedCount / ticketsCount) * 100 : 0,
          assistantName: queue.assistants?.name
        });
      }

      return queueMetrics;
    } catch (error) {
      console.error('Erro ao buscar métricas das filas:', error);
      return [];
    }
  },

  subscribeToMetrics(clientId: string, callback: () => void) {
    const channels = [
      supabase
        .channel('metrics-instances')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'whatsapp_instances', filter: `client_id=eq.${clientId}` },
          callback
        ),
      supabase
        .channel('metrics-tickets')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'conversation_tickets', filter: `client_id=eq.${clientId}` },
          callback
        ),
      supabase
        .channel('metrics-queues')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'queues', filter: `client_id=eq.${clientId}` },
          callback
        )
    ];

    channels.forEach(channel => channel.subscribe());

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }
};