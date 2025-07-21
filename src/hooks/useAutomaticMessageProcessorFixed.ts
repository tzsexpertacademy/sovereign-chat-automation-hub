
import { useState, useEffect, useCallback } from 'react';
import { queuesService, QueueWithAssistant } from '@/services/queuesService';
import { whatsappInstancesService, WhatsAppInstanceData } from '@/services/whatsappInstancesService';

export interface ProcessorInfo {
  instanceId: string;
  instanceName: string;
  phoneNumber?: string;
  queueConnection: QueueWithAssistant | null;
  isActive: boolean;
  status: 'active' | 'inactive' | 'error' | 'loading';
  lastActivity?: Date;
  messageCount?: number;
}

export interface ProcessorStats {
  total: number;
  active: number;
  withQueues: number;
  withAssistants: number;
  errors: number;
}

export const useAutomaticMessageProcessorFixed = (clientId: string) => {
  const [processors, setProcessors] = useState<ProcessorInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<ProcessorStats>({
    total: 0,
    active: 0,
    withQueues: 0,
    withAssistants: 0,
    errors: 0
  });
  const [error, setError] = useState<string | null>(null);

  const logDebug = (message: string, data?: any) => {
    console.log(`🤖 [PROCESSOR] ${message}`, data || '');
  };

  const loadProcessors = useCallback(async () => {
    if (!clientId) {
      logDebug('Cliente ID não fornecido');
      return;
    }

    try {
      setError(null);
      logDebug('Carregando processadores automáticos...');
      
      const [instances, queues] = await Promise.all([
        whatsappInstancesService.getInstancesByClientId(clientId),
        queuesService.getClientQueues(clientId)
      ]);

      logDebug('Dados carregados:', {
        instances: instances.length,
        queues: queues.length,
        connectedInstances: instances.filter(i => i.status === 'connected').length
      });

      const connectedInstances = instances.filter(i => i.status === 'connected');
      
      const processorsInfo: ProcessorInfo[] = connectedInstances.map(instance => {
        // Buscar fila conectada a esta instância
        const connectedQueue = queues.find(queue => 
          queue.instance_queue_connections?.some(conn => 
            conn.instance_id === instance.id && conn.is_active
          )
        );

        const hasAssistant = !!connectedQueue?.assistants;
        
        const processorInfo: ProcessorInfo = {
          instanceId: instance.instance_id,
          instanceName: instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`,
          phoneNumber: instance.phone_number,
          queueConnection: connectedQueue || null,
          isActive: hasAssistant, // Só está ativo se tem assistente
          status: hasAssistant ? 'active' : (connectedQueue ? 'inactive' : 'inactive'),
          lastActivity: new Date(),
          messageCount: 0
        };

        logDebug(`Processador ${instance.instance_id}:`, {
          hasQueue: !!connectedQueue,
          hasAssistant,
          queueName: connectedQueue?.name,
          assistantName: connectedQueue?.assistants?.name
        });

        return processorInfo;
      });

      // Calcular estatísticas
      const newStats: ProcessorStats = {
        total: processorsInfo.length,
        active: processorsInfo.filter(p => p.isActive).length,
        withQueues: processorsInfo.filter(p => p.queueConnection).length,
        withAssistants: processorsInfo.filter(p => p.queueConnection?.assistants).length,
        errors: processorsInfo.filter(p => p.status === 'error').length
      };

      logDebug('Processadores carregados:', {
        processors: processorsInfo.length,
        stats: newStats
      });
      
      setProcessors(processorsInfo);
      setStats(newStats);
      
    } catch (error: any) {
      logDebug('Erro ao carregar processadores:', error);
      setError(error.message || 'Erro ao carregar processadores');
    }
  }, [clientId]);

  const reloadProcessors = useCallback(() => {
    logDebug('Recarregando processadores...');
    loadProcessors();
  }, [loadProcessors]);

  const toggleProcessing = useCallback((instanceId: string, enabled: boolean) => {
    logDebug(`Alternando processamento para ${instanceId}:`, enabled);
    
    setProcessors(prev => prev.map(processor => 
      processor.instanceId === instanceId 
        ? { 
            ...processor, 
            isActive: enabled,
            status: enabled ? 'active' : 'inactive',
            lastActivity: new Date()
          }
        : processor
    ));
  }, []);

  const getProcessorByInstance = useCallback((instanceId: string): ProcessorInfo | null => {
    return processors.find(p => p.instanceId === instanceId) || null;
  }, [processors]);

  const getActiveProcessors = useCallback((): ProcessorInfo[] => {
    return processors.filter(p => p.isActive);
  }, [processors]);

  const simulateMessageProcessing = useCallback((instanceId: string) => {
    logDebug(`Simulando processamento de mensagem para ${instanceId}`);
    
    setIsProcessing(true);
    
    setProcessors(prev => prev.map(processor => 
      processor.instanceId === instanceId 
        ? { 
            ...processor, 
            messageCount: (processor.messageCount || 0) + 1,
            lastActivity: new Date()
          }
        : processor
    ));

    // Simular processamento por 2 segundos
    setTimeout(() => {
      setIsProcessing(false);
      logDebug(`Processamento concluído para ${instanceId}`);
    }, 2000);
  }, []);

  useEffect(() => {
    if (clientId) {
      loadProcessors();
      
      // Recarregar a cada 30 segundos
      const interval = setInterval(loadProcessors, 30000);
      return () => clearInterval(interval);
    }
  }, [clientId, loadProcessors]);

  return {
    processors,
    stats,
    isProcessing,
    error,
    reloadProcessors,
    toggleProcessing,
    getProcessorByInstance,
    getActiveProcessors,
    simulateMessageProcessing
  };
};
