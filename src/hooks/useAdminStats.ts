
import { useState, useEffect, useCallback } from 'react';
import { adminStatsService } from '@/services/adminStatsService';

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

export const useAdminStats = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [messageStats, setMessageStats] = useState<MessageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setError(null);
      console.log('📊 [ADMIN-HOOK] Carregando estatísticas...');
      
      const [statsData, activityData, msgStatsData] = await Promise.all([
        adminStatsService.getSystemStats(),
        adminStatsService.getRecentActivity(),
        adminStatsService.getMessageStats()
      ]);

      setStats(statsData);
      setRecentActivity(activityData);
      setMessageStats(msgStatsData);
      
      console.log('✅ [ADMIN-HOOK] Estatísticas carregadas com sucesso');
    } catch (err: any) {
      console.error('❌ [ADMIN-HOOK] Erro ao carregar estatísticas:', err);
      setError(err.message || 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStats = useCallback(() => {
    setLoading(true);
    loadStats();
  }, [loadStats]);

  // Cache persistente
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const CACHE_DURATION = 5000; // 5 segundos de cache

  // Carregar com cache
  const loadWithCache = useCallback(async () => {
    const now = Date.now();
    if (now - lastLoadTime < CACHE_DURATION) {
      console.log('📊 [ADMIN-HOOK] Usando cache...');
      return;
    }
    setLastLoadTime(now);
    await loadStats();
  }, [loadStats, lastLoadTime]);

  // Carregar inicialmente
  useEffect(() => {
    loadWithCache();
  }, [loadWithCache]);

  // Auto-refresh a cada 15 segundos (otimizado)
  useEffect(() => {
    const interval = setInterval(() => {
      loadWithCache();
    }, 15000);

    return () => clearInterval(interval);
  }, [loadWithCache]);

  return {
    stats,
    recentActivity,
    messageStats,
    loading,
    error,
    refreshStats
  };
};
