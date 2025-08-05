import { useState, useEffect } from 'react';
import { assistantsMetricsService, AssistantMetrics, AssistantPerformance } from '@/services/assistantsMetricsService';

export const useAssistantMetrics = (clientId: string) => {
  const [metrics, setMetrics] = useState<AssistantMetrics | null>(null);
  const [performance, setPerformance] = useState<AssistantPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    if (!clientId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [metricsData, performanceData] = await Promise.all([
        assistantsMetricsService.getAssistantMetrics(clientId),
        assistantsMetricsService.getAssistantPerformance(clientId)
      ]);

      setMetrics(metricsData);
      setPerformance(performanceData);
    } catch (error) {
      console.error('Erro ao carregar métricas dos assistentes:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clientId) return;

    loadMetrics();

    // Configurar subscription para atualizações em tempo real
    const unsubscribe = assistantsMetricsService.subscribeToAssistantMetrics(
      clientId,
      () => {
        // Debounce para evitar muitas chamadas
        setTimeout(loadMetrics, 1000);
      }
    );

    return unsubscribe;
  }, [clientId]);

  return {
    metrics,
    performance,
    loading,
    error,
    refetch: loadMetrics
  };
};