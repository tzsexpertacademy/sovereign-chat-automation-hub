import { useState, useEffect, useCallback, useRef } from 'react';
import instanceStatusSyncService from '@/services/instanceStatusSyncService';
import { useToast } from '@/hooks/use-toast';
import unifiedYumerService from '@/services/unifiedYumerService';

interface InstanceStatus {
  instanceId: string;
  status: string;
  isConnected: boolean;
  lastSync: Date | null;
  connectionState: string;
}

interface UseAutoSyncOptions {
  intervalMs?: number;
  enableNotifications?: boolean;
  onStatusChange?: (instanceId: string, status: InstanceStatus) => void;
}

export const useAutoSync = (instanceIds: string[], options: UseAutoSyncOptions = {}) => {
  const { intervalMs = 10000, enableNotifications = true, onStatusChange } = options;
  const [statuses, setStatuses] = useState<Record<string, InstanceStatus>>({});
  const [isActive, setIsActive] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronização manual
  const manualSync = useCallback(async (instanceId?: string) => {
    const idsToSync = instanceId ? [instanceId] : instanceIds;
    
    for (const id of idsToSync) {
      try {
        console.log(`🔄 [AUTO-SYNC] Sincronizando: ${id}`);
        
        const statusInfo = await instanceStatusSyncService.performManualSync(id);
        
        if (statusInfo) {
          const newStatus: InstanceStatus = {
            instanceId: id,
            status: statusInfo.status,
            isConnected: statusInfo.isConnected,
            lastSync: new Date(),
            connectionState: statusInfo.connectionState
          };
          
          // CORREÇÃO: Configurar webhook para instâncias conectadas E com status qr_ready
          if (newStatus.isConnected || newStatus.status === 'qr_ready') {
            try {
              console.log(`🔧 [AUTO-SYNC] Configurando webhook para instância: ${id} (status: ${newStatus.status})`);
              const webhookResult = await unifiedYumerService.ensureWebhookConfigured(id);
              if (webhookResult.success) {
                console.log(`✅ [AUTO-SYNC] Webhook configurado automaticamente: ${id}`);
                // Notificar sucesso
                if (enableNotifications) {
                  toast({
                    title: "🔗 Webhook Configurado",
                    description: `Webhook configurado automaticamente para ${id}`,
                  });
                }
              } else {
                console.warn(`⚠️ [AUTO-SYNC] Falha ao configurar webhook: ${id}`, webhookResult.error);
                // Notificar falha
                if (enableNotifications) {
                  toast({
                    title: "⚠️ Erro no Webhook",
                    description: `Falha ao configurar webhook: ${webhookResult.error}`,
                    variant: "destructive"
                  });
                }
              }
            } catch (webhookError) {
              console.error(`❌ [AUTO-SYNC] Erro ao configurar webhook: ${id}`, webhookError);
            }
          }
          
          setStatuses(prev => {
            const oldStatus = prev[id];
            const updated = { ...prev, [id]: newStatus };
            
            // Detectar mudanças importantes
            if (oldStatus && oldStatus.status !== newStatus.status) {
              console.log(`📊 [AUTO-SYNC] Mudança detectada: ${id} (${oldStatus.status} → ${newStatus.status})`);
              
              if (enableNotifications) {
                if (newStatus.isConnected && !oldStatus.isConnected) {
                  toast({
                    title: "✅ WhatsApp Conectado!",
                    description: `Instância ${id} foi conectada automaticamente`,
                  });
                } else if (!newStatus.isConnected && oldStatus.isConnected) {
                  toast({
                    title: "🔌 WhatsApp Desconectado",
                    description: `Instância ${id} perdeu a conexão`,
                    variant: "destructive"
                  });
                }
              }
              
              onStatusChange?.(id, newStatus);
            }
            
            return updated;
          });
        }
        
      } catch (error) {
        console.error(`❌ [AUTO-SYNC] Erro ao sincronizar ${id}:`, error);
      }
    }
    
    setLastSyncTime(new Date());
  }, [instanceIds, enableNotifications, onStatusChange, toast]);

  // Iniciar auto-sync
  const startAutoSync = useCallback(() => {
    if (intervalRef.current || instanceIds.length === 0) return;
    
    console.log(`🚀 [AUTO-SYNC] Iniciando auto-sync para ${instanceIds.length} instâncias (${intervalMs}ms)`);
    setIsActive(true);
    
    // Sync inicial imediato
    manualSync();
    
    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      manualSync();
    }, intervalMs);
    
  }, [instanceIds, intervalMs, manualSync]);

  // Parar auto-sync
  const stopAutoSync = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsActive(false);
      console.log(`⏹️ [AUTO-SYNC] Auto-sync interrompido`);
    }
  }, []);

  // Gerenciar ciclo de vida
  useEffect(() => {
    if (instanceIds.length > 0) {
      startAutoSync();
    } else {
      stopAutoSync();
    }
    
    return () => stopAutoSync();
  }, [instanceIds, startAutoSync, stopAutoSync]);

  // Status da instância
  const getInstanceStatus = useCallback((instanceId: string): InstanceStatus | null => {
    return statuses[instanceId] || null;
  }, [statuses]);

  // Status geral do sync
  const getSyncInfo = useCallback(() => {
    const connectedCount = Object.values(statuses).filter(s => s.isConnected).length;
    const totalCount = instanceIds.length;
    
    return {
      isActive,
      connectedCount,
      totalCount,
      lastSyncTime,
      hasActiveInstances: totalCount > 0
    };
  }, [statuses, instanceIds.length, isActive, lastSyncTime]);

  return {
    statuses,
    isActive,
    lastSyncTime,
    manualSync,
    startAutoSync,
    stopAutoSync,
    getInstanceStatus,
    getSyncInfo
  };
};