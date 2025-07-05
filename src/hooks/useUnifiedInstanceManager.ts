import { useState, useEffect, useCallback } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { useToast } from '@/hooks/use-toast';

interface InstanceStatus {
  instanceId: string;
  status: string;
  qrCode?: string;
  hasQrCode?: boolean;
  phoneNumber?: string;
  lastUpdated?: number;
}

interface UseUnifiedInstanceManagerReturn {
  instances: Record<string, InstanceStatus>;
  loading: Record<string, boolean>;
  websocketConnected: boolean;
  connectInstance: (instanceId: string) => Promise<void>;
  disconnectInstance: (instanceId: string) => Promise<void>;
  getInstanceStatus: (instanceId: string) => InstanceStatus;
  isLoading: (instanceId: string) => boolean;
  cleanup: (instanceId: string) => void;
  refreshStatus: (instanceId: string) => Promise<void>;
}

export const useUnifiedInstanceManager = (): UseUnifiedInstanceManagerReturn => {
  const [instances, setInstances] = useState<Record<string, InstanceStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const { toast } = useToast();

  // Conectar WebSocket uma única vez
  useEffect(() => {
    console.log('🔧 [UNIFIED] Inicializando Unified Instance Manager');
    
    const socket = whatsappService.connectSocket();
    
    if (socket) {
      const handleConnect = () => {
        console.log('✅ [UNIFIED] WebSocket conectado');
        setWebsocketConnected(true);
      };

      const handleDisconnect = () => {
        console.log('❌ [UNIFIED] WebSocket desconectado');
        setWebsocketConnected(false);
        // Reconectar automaticamente
        setTimeout(() => {
          console.log('🔄 [UNIFIED] Reconectando WebSocket...');
          whatsappService.connectSocket();
        }, 3000);
      };

      const handleError = (error: any) => {
        console.error('❌ [UNIFIED] Erro WebSocket:', error);
        setWebsocketConnected(false);
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleError);

      // Heartbeat
      socket.on('ping', () => socket.emit('pong'));

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleError);
      };
    }
  }, []);

  // Função para normalizar status
  const normalizeStatus = useCallback((clientData: any): string => {
    // REGRA 1: phoneNumber = connected (sempre)
    if (clientData.phoneNumber && clientData.phoneNumber.trim().length > 0) {
      return 'connected';
    }
    
    // REGRA 2: authenticated = connected (sempre)
    if (clientData.status === 'authenticated') {
      return 'connected';
    }
    
    // REGRA 3: QR code disponível = qr_ready
    if (clientData.hasQrCode && clientData.qrCode && !clientData.phoneNumber) {
      return 'qr_ready';
    }
    
    // REGRA 4: Outros status passam direto
    return clientData.status || 'disconnected';
  }, []);

  // Configurar listener para uma instância
  const setupInstanceListener = useCallback((instanceId: string) => {
    console.log(`🎧 [UNIFIED] Configurando listener para: ${instanceId}`);
    
    // Limpar listener anterior
    whatsappService.offClientStatus(instanceId);
    
    // Configurar novo listener
    const handleStatusUpdate = (clientData: any) => {
      const normalizedStatus = normalizeStatus(clientData);
      const timestamp = Date.now();
      
      console.log(`📱 [UNIFIED] Status update ${instanceId}: ${clientData.status} -> ${normalizedStatus}`, {
        hasQrCode: clientData.hasQrCode,
        phoneNumber: clientData.phoneNumber ? 'Presente' : 'Ausente'
      });
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: normalizedStatus,
          qrCode: clientData.qrCode,
          hasQrCode: clientData.hasQrCode || false,
          phoneNumber: clientData.phoneNumber,
          lastUpdated: timestamp
        }
      }));

      // Atualizar banco para status permanentes
      if (normalizedStatus !== 'connecting') {
        whatsappInstancesService.updateInstanceStatus(
          instanceId, 
          normalizedStatus,
          clientData.phoneNumber ? { phone_number: clientData.phoneNumber } : undefined
        ).catch(console.error);
      }

      // Toasts para eventos importantes
      if (normalizedStatus === 'connected' && clientData.phoneNumber) {
        toast({
          title: "✅ WhatsApp Conectado!",
          description: `Conectado com sucesso: ${clientData.phoneNumber}`,
        });
      } else if (normalizedStatus === 'qr_ready' && clientData.hasQrCode) {
        toast({
          title: "📱 QR Code Disponível!",
          description: "Escaneie o QR Code para conectar",
        });
      }
    };

    whatsappService.onClientStatus(instanceId, handleStatusUpdate);
    whatsappService.joinClientRoom(instanceId);
    
    return handleStatusUpdate;
  }, [normalizeStatus, toast]);

  // Buscar status atual de uma instância
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [UNIFIED] Buscando status atual: ${instanceId}`);
      const status = await whatsappService.getClientStatus(instanceId);
      const normalizedStatus = normalizeStatus(status);
      
      console.log(`📊 [UNIFIED] Status atual ${instanceId}: ${normalizedStatus}`);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: normalizedStatus,
          qrCode: status.qrCode,
          hasQrCode: status.hasQrCode || false,
          phoneNumber: status.phoneNumber,
          lastUpdated: Date.now()
        }
      }));
    } catch (error) {
      console.error(`❌ [UNIFIED] Erro ao buscar status ${instanceId}:`, error);
      throw error;
    }
  }, [normalizeStatus]);

  // Conectar instância
  const connectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [UNIFIED] Conectando instância: ${instanceId}`);
      
      // Configurar listener antes de conectar
      setupInstanceListener(instanceId);
      
      // Aguardar configuração
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Iniciar conexão
      await whatsappService.connectClient(instanceId);
      
      // Polling inteligente como backup
      let pollCount = 0;
      const maxPolls = 20;
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        console.log(`🔄 [UNIFIED] Polling ${instanceId} (${pollCount}/${maxPolls})`);
        
        try {
          await refreshStatus(instanceId);
          const currentStatus = getInstanceStatus(instanceId);
          
          if (currentStatus.hasQrCode || currentStatus.status === 'connected' || pollCount >= maxPolls) {
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.warn(`⚠️ [UNIFIED] Erro no polling ${pollCount}:`, error);
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
          }
        }
      }, 3000);
      
      toast({
        title: "Conectando...",
        description: "Aguarde o QR Code aparecer",
      });
      
    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao conectar:', error);
      toast({
        title: "Erro na Conexão",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [setupInstanceListener, refreshStatus, toast]);

  // Desconectar instância
  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🔌 [UNIFIED] Desconectando instância: ${instanceId}`);
      
      await whatsappService.disconnectClient(instanceId);
      whatsappService.offClientStatus(instanceId);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'disconnected',
          qrCode: undefined,
          hasQrCode: false
        }
      }));

      await whatsappInstancesService.updateInstanceStatus(instanceId, 'disconnected');

      toast({
        title: "Desconectado",
        description: "Instância desconectada com sucesso",
      });
      
    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [toast]);

  // Obter status de uma instância
  const getInstanceStatus = useCallback((instanceId: string): InstanceStatus => {
    return instances[instanceId] || { instanceId, status: 'disconnected' };
  }, [instances]);

  // Verificar se está carregando
  const isLoading = useCallback((instanceId: string): boolean => {
    return loading[instanceId] || false;
  }, [loading]);

  // Limpar instância
  const cleanup = useCallback((instanceId: string) => {
    whatsappService.offClientStatus(instanceId);
    setInstances(prev => {
      const newInstances = { ...prev };
      delete newInstances[instanceId];
      return newInstances;
    });
  }, []);

  return {
    instances,
    loading,
    websocketConnected,
    connectInstance,
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    cleanup,
    refreshStatus
  };
};