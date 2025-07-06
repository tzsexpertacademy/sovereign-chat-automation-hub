
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

interface UseSimplifiedInstanceManagerReturn {
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

export const useSimplifiedInstanceManager = (): UseSimplifiedInstanceManagerReturn => {
  const [instances, setInstances] = useState<Record<string, InstanceStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const { toast } = useToast();

  // Conectar WebSocket uma única vez
  useEffect(() => {
    console.log('🔧 [SIMPLIFIED] Inicializando Instance Manager HTTPS');
    
    const socket = whatsappService.connectSocket();
    
    if (socket) {
      const handleConnect = () => {
        console.log('✅ [SIMPLIFIED] WebSocket HTTPS conectado');
        setWebsocketConnected(true);
      };

      const handleDisconnect = (reason: string) => {
        console.log(`❌ [SIMPLIFIED] WebSocket HTTPS desconectado: ${reason}`);
        setWebsocketConnected(false);
      };

      const handleError = (error: any) => {
        console.error('❌ [SIMPLIFIED] Erro WebSocket HTTPS:', error);
        setWebsocketConnected(false);
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleError);

      if (socket.connected) {
        handleConnect();
      }

      return () => {
        console.log('🧹 [SIMPLIFIED] Limpando listeners WebSocket HTTPS');
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleError);
      };
    }
  }, []);

  // Configurar listener para uma instância
  const setupInstanceListener = useCallback((instanceId: string) => {
    console.log(`🎧 [SIMPLIFIED] Configurando listener HTTPS para: ${instanceId}`);
    
    whatsappService.offClientStatus(instanceId);
    
    const handleStatusUpdate = (clientData: any) => {
      const timestamp = Date.now();
      
      console.log(`📱 [SIMPLIFIED] Status update HTTPS para ${instanceId}:`, {
        status: clientData.status,
        phoneNumber: clientData.phoneNumber || 'N/A',
        hasQrCode: clientData.hasQrCode,
        qrCode: clientData.qrCode ? 'SIM' : 'NÃO'
      });
      
      // ATUALIZAR ESTADO DIRETAMENTE SEM NORMALIZAÇÃO
      setInstances(prev => {
        const newState = {
          ...prev,
          [instanceId]: {
            instanceId,
            status: clientData.status,
            qrCode: clientData.qrCode,
            hasQrCode: clientData.hasQrCode || false,
            phoneNumber: clientData.phoneNumber,
            lastUpdated: timestamp
          }
        };
        
        console.log(`🔄 [SIMPLIFIED] Estado HTTPS atualizado para ${instanceId}:`, newState[instanceId]);
        return newState;
      });

      // Sync com Supabase apenas se necessário
      if (clientData.status !== 'connecting') {
        const updateData = clientData.phoneNumber ? { phone_number: clientData.phoneNumber } : undefined;
        whatsappInstancesService.updateInstanceStatus(instanceId, clientData.status, updateData)
          .catch(error => console.error(`❌ [SIMPLIFIED] Erro sync Supabase:`, error));
      }

      // Notificações
      if (clientData.status === 'connected' && clientData.phoneNumber) {
        toast({
          title: "✅ WhatsApp Conectado HTTPS!",
          description: `Conectado: ${clientData.phoneNumber}`,
        });
      } else if (clientData.status === 'qr_ready' && clientData.hasQrCode) {
        toast({
          title: "📱 QR Code Disponível HTTPS!",
          description: "Escaneie o QR Code para conectar",
        });
      }
    };

    whatsappService.onClientStatus(instanceId, handleStatusUpdate);
    whatsappService.joinClientRoom(instanceId);
    
    return handleStatusUpdate;
  }, [toast]);

  // Buscar status atual
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [SIMPLIFIED] Buscando status HTTPS: ${instanceId}`);
      const status = await whatsappService.getClientStatus(instanceId);
      
      console.log(`📊 [SIMPLIFIED] Status HTTPS obtido ${instanceId}:`, status);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: status.status,
          qrCode: status.qrCode,
          hasQrCode: status.hasQrCode || false,
          phoneNumber: status.phoneNumber,
          lastUpdated: Date.now()
        }
      }));
    } catch (error) {
      console.error(`❌ [SIMPLIFIED] Erro ao buscar status HTTPS ${instanceId}:`, error);
      throw error;
    }
  }, []);

  // Conectar instância
  const connectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [SIMPLIFIED] Conectando instância HTTPS: ${instanceId}`);
      
      // Configurar listener
      setupInstanceListener(instanceId);
      
      // Aguardar configuração
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Conectar
      await whatsappService.connectClient(instanceId);
      
      // Polling backup mais espaçado
      let pollCount = 0;
      const maxPolls = 15;
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        console.log(`🔄 [SIMPLIFIED] Polling HTTPS ${instanceId} (${pollCount}/${maxPolls})`);
        
        try {
          await refreshStatus(instanceId);
          const currentStatus = getInstanceStatus(instanceId);
          
          if (currentStatus.hasQrCode || currentStatus.status === 'connected') {
            console.log(`✅ [SIMPLIFIED] Polling HTTPS finalizado: ${currentStatus.status}`);
            clearInterval(pollInterval);
          } else if (pollCount >= maxPolls) {
            console.log(`⏰ [SIMPLIFIED] Polling HTTPS timeout após ${maxPolls} tentativas`);
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.warn(`⚠️ [SIMPLIFIED] Erro no polling HTTPS ${pollCount}:`, error);
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
          }
        }
      }, 5000); // 5 segundos entre verificações
      
      toast({
        title: "Conectando HTTPS...",
        description: "Aguarde o QR Code aparecer",
      });
      
    } catch (error: any) {
      console.error('❌ [SIMPLIFIED] Erro ao conectar HTTPS:', error);
      toast({
        title: "Erro na Conexão HTTPS",
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
      console.log(`🔌 [SIMPLIFIED] Desconectando instância HTTPS: ${instanceId}`);
      
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
        title: "Desconectado HTTPS",
        description: "Instância desconectada com sucesso",
      });
      
    } catch (error: any) {
      console.error('❌ [SIMPLIFIED] Erro ao desconectar HTTPS:', error);
      toast({
        title: "Erro HTTPS",
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
