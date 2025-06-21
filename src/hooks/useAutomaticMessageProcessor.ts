
import { useState, useEffect, useCallback } from 'react';
import { queuesService, QueueWithAssistant } from '@/services/queuesService';
import { whatsappInstancesService, WhatsAppInstanceData } from '@/services/whatsappInstancesService';

export interface ProcessorInfo {
  instanceId: string;
  queueConnection: QueueWithAssistant | null;
  isActive: boolean;
}

export const useAutomaticMessageProcessor = (clientId: string) => {
  const [processors, setProcessors] = useState<ProcessorInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadProcessors = useCallback(async () => {
    try {
      console.log('🔄 Carregando processadores automáticos...');
      
      const [instances, queues] = await Promise.all([
        whatsappInstancesService.getInstancesByClientId(clientId),
        queuesService.getClientQueues(clientId)
      ]);

      const connectedInstances = instances.filter(i => i.status === 'connected');
      
      const processorsInfo: ProcessorInfo[] = connectedInstances.map(instance => {
        // Buscar fila conectada a esta instância
        const connectedQueue = queues.find(queue => 
          queue.instance_queue_connections?.some(conn => 
            conn.instance_id === instance.id && conn.is_active
          )
        );

        return {
          instanceId: instance.instance_id,
          queueConnection: connectedQueue || null,
          isActive: !!connectedQueue?.assistants // Só está ativo se tem assistente
        };
      });

      console.log('✅ Processadores carregados:', processorsInfo);
      setProcessors(processorsInfo);
      
    } catch (error) {
      console.error('❌ Erro ao carregar processadores:', error);
    }
  }, [clientId]);

  const reloadProcessors = useCallback(() => {
    loadProcessors();
  }, [loadProcessors]);

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
    isProcessing,
    reloadProcessors
  };
};
