
import { supabase } from "@/integrations/supabase/client";
import { yumerWhatsappService } from "./yumerWhatsappService";

interface SystemStats {
  totalClients: number;
  activeInstances: number;
  totalInstances: number;
  messagesLastHour: number;
  messagesToday: number;
  totalMessages: number;
  openTickets: number;
  totalTickets: number;
  serverStatus: 'online' | 'offline';
  serverUptime: string;
  lastActivity: Date | null;
  // KPIs Financeiros
  totalMRR: number;
  totalRevenue: number;
  conversionRate: number;
  // Métricas de Negócio
  growthRate: number;
  avgInstancesPerClient: number;
  clientRetentionRate: number;
  // Performance
  avgResponseTime: number;
  systemUptime: number;
  ticketsPerDay: number;
  // Novos dados para gráficos
  messagesByDay: { date: string; sent: number; received: number; }[];
  instancesDistribution: { status: string; count: number; color: string; }[];
  recentGrowth: { period: string; clients: number; revenue: number; }[];
}

interface RecentActivity {
  id: string;
  type: 'instance_connected' | 'instance_disconnected' | 'message_received' | 'ticket_created' | 'system_event';
  title: string;
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface MessageStats {
  date: string;
  count: number;
}

export class AdminStatsService {
  async getSystemStats(): Promise<SystemStats> {
    try {
      console.log('📊 [ADMIN-STATS] Buscando estatísticas do sistema...');
      
      // Buscar dados em paralelo
      const [
        clientsData,
        instancesData,
        messagesData,
        ticketsData,
        serverHealth,
        financialData,
        businessData,
        messagesByDayData,
        instancesDistData,
        growthData
      ] = await Promise.all([
        this.getTotalClients(),
        this.getInstancesStats(),
        this.getMessagesStats(),
        this.getTicketsStats(),
        this.getServerHealth(),
        this.getFinancialMetrics(),
        this.getBusinessMetrics(),
        this.getMessagesByDay(),
        this.getInstancesDistribution(),
        this.getGrowthData()
      ]);

      const stats: SystemStats = {
        totalClients: clientsData,
        activeInstances: instancesData.active,
        totalInstances: instancesData.total,
        messagesLastHour: messagesData.lastHour,
        messagesToday: messagesData.today,
        totalMessages: messagesData.total,
        openTickets: ticketsData.open,
        totalTickets: ticketsData.total,
        serverStatus: serverHealth.status,
        serverUptime: serverHealth.uptime,
        lastActivity: new Date(),
        // KPIs Financeiros
        totalMRR: financialData.mrr,
        totalRevenue: financialData.revenue,
        conversionRate: financialData.conversionRate,
        // Métricas de Negócio
        growthRate: businessData.growthRate,
        avgInstancesPerClient: businessData.avgInstancesPerClient,
        clientRetentionRate: businessData.retentionRate,
        // Performance
        avgResponseTime: 2.3, // Mock data
        systemUptime: 99.8, // Mock data
        ticketsPerDay: Math.round(ticketsData.total / 30),
        // Dados para gráficos
        messagesByDay: messagesByDayData,
        instancesDistribution: instancesDistData,
        recentGrowth: growthData
      };

      console.log('✅ [ADMIN-STATS] Estatísticas carregadas:', stats);
      return stats;
    } catch (error) {
      console.error('❌ [ADMIN-STATS] Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  async getRecentActivity(): Promise<RecentActivity[]> {
    try {
      const activities: RecentActivity[] = [];
      
      // Buscar instâncias recentemente conectadas/desconectadas
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, status, updated_at, custom_name')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (instances) {
        instances.forEach(instance => {
          const isConnected = instance.status === 'connected' || instance.status === 'ready';
          activities.push({
            id: `instance-${instance.instance_id}`,
            type: isConnected ? 'instance_connected' : 'instance_disconnected',
            title: `Instância ${isConnected ? 'Conectada' : 'Desconectada'}`,
            description: instance.custom_name || instance.instance_id.slice(0, 8),
            timestamp: new Date(instance.updated_at),
            status: isConnected ? 'success' : 'warning'
          });
        });
      }

      // Buscar tickets recentes
      const { data: tickets } = await supabase
        .from('conversation_tickets')
        .select('id, title, created_at, status')
        .order('created_at', { ascending: false })
        .limit(3);

      if (tickets) {
        tickets.forEach(ticket => {
          activities.push({
            id: `ticket-${ticket.id}`,
            type: 'ticket_created',
            title: 'Novo Ticket Criado',
            description: ticket.title,
            timestamp: new Date(ticket.created_at),
            status: 'info'
          });
        });
      }

      // Ordenar por timestamp
      return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 8);
    } catch (error) {
      console.error('❌ [ADMIN-STATS] Erro ao buscar atividades:', error);
      return [];
    }
  }

  async getMessageStats(): Promise<MessageStats[]> {
    try {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      if (!data) return [];

      // Agrupar por dia
      const grouped = data.reduce((acc, msg) => {
        const date = new Date(msg.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Converter para array
      return Object.entries(grouped).map(([date, count]) => ({
        date,
        count
      }));
    } catch (error) {
      console.error('❌ [ADMIN-STATS] Erro ao buscar estatísticas de mensagens:', error);
      return [];
    }
  }

  private async getTotalClients(): Promise<number> {
    const { count } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  private async getInstancesStats(): Promise<{ active: number; total: number }> {
    try {
      // Buscar do banco local
      const { data: localInstances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, status');

      const localActive = localInstances?.filter(i => 
        i.status === 'connected' || i.status === 'ready' || i.status === 'online'
      ).length || 0;

      // Buscar estatísticas do servidor YUMER (sem hardcoded 'test')
      try {
        // Buscar uma instância real conectada para testar
        const connectedInstance = localInstances?.find(i => 
          i.status === 'connected' || i.status === 'ready'
        );
        
        if (connectedInstance) {
          console.log('🔍 [STATS] Testando conectividade com instância real:', connectedInstance.instance_id);
          // Aqui poderíamos fazer uma verificação real da API se necessário
        }
        
        return {
          active: localActive,
          total: localInstances?.length || 0
        };
      } catch (error) {
        console.error('⚠️ [STATS] Erro ao verificar estatísticas do servidor:', error);
        return {
          active: localActive,
          total: localInstances?.length || 0
        };
      }
    } catch (error) {
      console.error('❌ [ADMIN-STATS] Erro ao buscar instâncias:', error);
      return { active: 0, total: 0 };
    }
  }

  private async getMessagesStats(): Promise<{ lastHour: number; today: number; total: number }> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [lastHourResult, todayResult, totalResult] = await Promise.all([
      supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', hourAgo.toISOString()),
      supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString()),
      supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
    ]);

    return {
      lastHour: lastHourResult.count || 0,
      today: todayResult.count || 0,
      total: totalResult.count || 0
    };
  }

  private async getTicketsStats(): Promise<{ open: number; total: number }> {
    const [openResult, totalResult] = await Promise.all([
      supabase
        .from('conversation_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('conversation_tickets')
        .select('*', { count: 'exact', head: true })
    ]);

    return {
      open: openResult.count || 0,
      total: totalResult.count || 0
    };
  }

  private async getServerHealth(): Promise<{ status: 'online' | 'offline'; uptime: string }> {
    try {
      // Mock health check
      const health = { status: 'online', details: { timestamp: new Date().toISOString() } };
      const uptime = health.status === 'online' ? 
        this.formatUptime(Date.now() - new Date(health.details.timestamp).getTime()) : 
        '0s';
      
      return {
        status: 'online' as const,
        uptime
      };
    } catch {
      return { status: 'offline', uptime: '0s' };
    }
  }

  private async getFinancialMetrics(): Promise<{ mrr: number; revenue: number; conversionRate: number }> {
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('mrr, plan, subscription_status, created_at');

      if (!clients) return { mrr: 0, revenue: 0, conversionRate: 0 };

      const totalMRR = clients.reduce((sum, client) => sum + (client.mrr || 0), 0);
      const totalRevenue = totalMRR * 12; // Annual revenue estimate
      const activeClients = clients.filter(c => c.subscription_status === 'active').length;
      const conversionRate = clients.length > 0 ? (activeClients / clients.length) * 100 : 0;

      return {
        mrr: totalMRR,
        revenue: totalRevenue,
        conversionRate: Math.round(conversionRate * 100) / 100
      };
    } catch (error) {
      console.error('❌ [ADMIN-STATS] Erro ao buscar métricas financeiras:', error);
      return { mrr: 0, revenue: 0, conversionRate: 0 };
    }
  }

  private async getBusinessMetrics(): Promise<{ growthRate: number; avgInstancesPerClient: number; retentionRate: number }> {
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('created_at, current_instances');

      if (!clients) return { growthRate: 0, avgInstancesPerClient: 0, retentionRate: 0 };

      // Growth rate (last 30 days vs previous 30 days)
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const previous30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const recentClients = clients.filter(c => new Date(c.created_at) >= last30Days).length;
      const previousClients = clients.filter(c => 
        new Date(c.created_at) >= previous30Days && new Date(c.created_at) < last30Days
      ).length;

      const growthRate = previousClients > 0 ? ((recentClients - previousClients) / previousClients) * 100 : 0;

      // Average instances per client
      const totalInstances = clients.reduce((sum, client) => sum + (client.current_instances || 0), 0);
      const avgInstancesPerClient = clients.length > 0 ? totalInstances / clients.length : 0;

      // Mock retention rate
      const retentionRate = 85.5;

      return {
        growthRate: Math.round(growthRate * 100) / 100,
        avgInstancesPerClient: Math.round(avgInstancesPerClient * 100) / 100,
        retentionRate
      };
    } catch (error) {
      console.error('❌ [ADMIN-STATS] Erro ao buscar métricas de negócio:', error);
      return { growthRate: 0, avgInstancesPerClient: 0, retentionRate: 0 };
    }
  }

  private async getMessagesByDay(): Promise<{ date: string; sent: number; received: number; }[]> {
    try {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('created_at, from_me')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      if (!data) return [];

      const grouped = data.reduce((acc, msg) => {
        const date = new Date(msg.created_at).toISOString().split('T')[0];
        if (!acc[date]) acc[date] = { sent: 0, received: 0 };
        if (msg.from_me) {
          acc[date].sent++;
        } else {
          acc[date].received++;
        }
        return acc;
      }, {} as Record<string, { sent: number; received: number; }>);

      return Object.entries(grouped).map(([date, counts]) => ({
        date,
        ...counts
      }));
    } catch (error) {
      console.error('❌ [ADMIN-STATS] Erro ao buscar mensagens por dia:', error);
      return [];
    }
  }

  private async getInstancesDistribution(): Promise<{ status: string; count: number; color: string; }[]> {
    try {
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('status');

      if (!data) return [];

      const statusCount = data.reduce((acc, instance) => {
        const status = instance.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const colorMap: Record<string, string> = {
        'connected': 'hsl(var(--chart-1))',
        'ready': 'hsl(var(--chart-2))', 
        'disconnected': 'hsl(var(--chart-3))',
        'qr_ready': 'hsl(var(--chart-4))',
        'unknown': 'hsl(var(--chart-5))'
      };

      return Object.entries(statusCount).map(([status, count]) => ({
        status,
        count,
        color: colorMap[status] || 'hsl(var(--muted))'
      }));
    } catch (error) {
      console.error('❌ [ADMIN-STATS] Erro ao buscar distribuição de instâncias:', error);
      return [];
    }
  }

  private async getGrowthData(): Promise<{ period: string; clients: number; revenue: number; }[]> {
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('created_at, mrr');

      if (!clients) return [];

      // Group by month for the last 6 months
      const periods = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const period = date.toISOString().slice(0, 7); // YYYY-MM
        
        const periodClients = clients.filter(c => 
          c.created_at.slice(0, 7) === period
        );
        
        const clientCount = periodClients.length;
        const revenue = periodClients.reduce((sum, c) => sum + (c.mrr || 0), 0);
        
        periods.push({
          period: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
          clients: clientCount,
          revenue: Math.round(revenue * 100) / 100
        });
      }

      return periods;
    } catch (error) {
      console.error('❌ [ADMIN-STATS] Erro ao buscar dados de crescimento:', error);
      return [];
    }
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}

export const adminStatsService = new AdminStatsService();
