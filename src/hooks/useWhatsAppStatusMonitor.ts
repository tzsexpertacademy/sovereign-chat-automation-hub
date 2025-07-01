
import { useState, useEffect, useCallback } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

interface StatusMonitorConfig {
  instanceId: string;
  pollInterval?: number;
  maxRetries?: number;
  qrTimeout?: number;
}

interface WhatsAppStatus {
  status: string;
  phoneNumber?: string;
  hasQrCode: boolean;
  qrCode?: string;
  timestamp: string;
  retryCount: number;
  lastChange: Date;
  isStuck: boolean;
}

export const useWhatsAppStatusMonitor = (config: StatusMonitorConfig) => {
  const { instanceId, pollInterval = 3000, maxRetries = 10, qrTimeout = 120000 } = config;
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const checkStatus = useCallback(async () => {
    try {
      console.log(`🔍 [MONITOR] Verificando status: ${instanceId}`);
      const response = await whatsappService.getClientStatus(instanceId);
      
      const newStatus: WhatsAppStatus = {
        status: response.status,
        phoneNumber: response.phoneNumber,
        hasQrCode: response.hasQrCode || false,
        qrCode: response.qrCode,
        timestamp: new Date().toISOString(),
        retryCount: status?.retryCount || 0,
        lastChange: status?.status !== response.status ? new Date() : (status?.lastChange || new Date()),
        isStuck: false
      };

      // Detectar se está preso
      if (status && status.status === response.status) {
        const timeSinceLastChange = Date.now() - status.lastChange.getTime();
        newStatus.isStuck = timeSinceLastChange > qrTimeout && response.status === 'qr_ready';
      }

      setStatus(newStatus);
      setError(null);

      // Log mudanças importantes
      if (!status || status.status !== response.status) {
        console.log(`📱 [MONITOR] Status mudou: ${status?.status || 'N/A'} → ${response.status}`);
        
        if (response.status === 'connected' && response.phoneNumber) {
          console.log(`🎉 [MONITOR] CONECTADO! Telefone: ${response.phoneNumber}`);
          toast({
            title: "WhatsApp Conectado!",
            description: `Instância conectada: ${response.phoneNumber}`,
          });
          setIsMonitoring(false); // Parar monitoramento
        }
      }

      // Detectar se está preso e forçar reconexão
      if (newStatus.isStuck) {
        console.log(`⚠️ [MONITOR] Instância presa em qr_ready há ${Math.round((Date.now() - newStatus.lastChange.getTime()) / 1000)}s`);
        
        if (newStatus.retryCount < maxRetries) {
          await forceReconnect();
          newStatus.retryCount++;
        } else {
          console.log(`❌ [MONITOR] Máximo de tentativas atingido (${maxRetries})`);
          setIsMonitoring(false);
          toast({
            title: "Erro de Conexão",
            description: "Muitas tentativas de reconexão. Tente manualmente.",
            variant: "destructive",
          });
        }
      }

      return newStatus;
      
    } catch (error: any) {
      console.error(`❌ [MONITOR] Erro ao verificar status:`, error);
      setError(error.message);
      
      if (status) {
        setStatus({
          ...status,
          retryCount: status.retryCount + 1
        });
      }
      
      return null;
    }
  }, [instanceId, status, qrTimeout, maxRetries]);

  const forceReconnect = useCallback(async () => {
    try {
      console.log(`🔄 [MONITOR] Forçando reconexão: ${instanceId}`);
      
      // Desconectar primeiro
      await whatsappService.disconnectClient(instanceId);
      
      // Aguardar 2 segundos
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reconectar
      await whatsappService.connectClient(instanceId);
      
      console.log(`✅ [MONITOR] Reconexão iniciada`);
      
      toast({
        title: "Reconectando...",
        description: "Sessão limpa, aguarde novo QR Code",
      });
      
    } catch (error: any) {
      console.error(`❌ [MONITOR] Erro na reconexão:`, error);
      setError(`Erro na reconexão: ${error.message}`);
    }
  }, [instanceId, toast]);

  const startMonitoring = useCallback(() => {
    console.log(`🚀 [MONITOR] Iniciando monitoramento: ${instanceId}`);
    setIsMonitoring(true);
    setError(null);
    
    // Verificar status imediatamente
    checkStatus();
  }, [instanceId, checkStatus]);

  const stopMonitoring = useCallback(() => {
    console.log(`⏹️ [MONITOR] Parando monitoramento: ${instanceId}`);
    setIsMonitoring(false);
  }, [instanceId]);

  // Polling automático
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isMonitoring) {
      interval = setInterval(() => {
        checkStatus();
      }, pollInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring, pollInterval, checkStatus]);

  // Parar monitoramento se conectado
  useEffect(() => {
    if (status?.status === 'connected' && status?.phoneNumber) {
      setIsMonitoring(false);
    }
  }, [status]);

  return {
    status,
    isMonitoring,
    error,
    startMonitoring,
    stopMonitoring,
    forceReconnect,
    checkStatus
  };
};
