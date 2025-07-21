
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
        serverHealth
      ] = await Promise.all([
        this.getTotalClients(),
        this.getInstancesStats(),
        this.getMessagesStats(),
        this.getTicketsStats(),
        this.getServerHealth()
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
        lastActivity: new Date()
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
        .select('status');

      const localActive = localInstances?.filter(i => 
        i.status === 'connected' || i.status === 'ready' || i.status === 'online'
      ).length || 0;

      // Buscar do servidor YUMER
      try {
        const result = await yumerWhatsappService.getChats('test');
        const yumerInstances = [];
        const yumerActive = yumerInstances.filter(i => 
          i.status === 'connected' || i.status === 'ready'
        ).length;

        return {
          active: Math.max(localActive, yumerActive),
          total: Math.max(localInstances?.length || 0, yumerInstances.length)
        };
      } catch {
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
