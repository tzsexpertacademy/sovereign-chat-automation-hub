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
        console.log('✅ [UNIFIED] WebSocket conectado com sucesso');
        setWebsocketConnected(true);
      };

      const handleDisconnect = (reason: string) => {
        console.log(`❌ [UNIFIED] WebSocket desconectado: ${reason}`);
        setWebsocketConnected(false);
        
        // Reconectar automaticamente após pequeno delay
        if (reason !== 'io client disconnect') {
          setTimeout(() => {
            console.log('🔄 [UNIFIED] Tentando reconectar WebSocket...');
            const newSocket = whatsappService.connectSocket();
            if (newSocket) {
              console.log('🔄 [UNIFIED] Nova conexão WebSocket estabelecida');
            }
          }, 2000);
        }
      };

      const handleError = (error: any) => {
        console.error('❌ [UNIFIED] Erro WebSocket:', error);
        setWebsocketConnected(false);
      };

      // CONFIGURAR EVENTOS WEBSOCKET
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleError);

      // Heartbeat melhorado
      socket.on('ping', () => {
        socket.emit('pong');
        console.log('💗 [UNIFIED] Heartbeat enviado');
      });

      // LOG DE STATUS INICIAL
      if (socket.connected) {
        handleConnect();
      }

      return () => {
        console.log('🧹 [UNIFIED] Limpando listeners WebSocket');
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleError);
        socket.off('ping');
      };
    } else {
      console.error('❌ [UNIFIED] Falha ao obter socket WebSocket');
    }
  }, []);

  // Função para normalizar status - SIMPLIFICADA
  const normalizeStatus = useCallback((clientData: any): string => {
    console.log(`🔧 [UNIFIED] Normalizando status:`, {
      status: clientData.status,
      phoneNumber: clientData.phoneNumber ? 'Presente' : 'Ausente',
      hasQrCode: clientData.hasQrCode
    });
    
    // REGRA PRINCIPAL: Se tem phoneNumber, está conectado
    if (clientData.phoneNumber && clientData.phoneNumber.trim().length > 0) {
      console.log(`✅ [UNIFIED] Status normalizado: phoneNumber presente -> connected`);
      return 'connected';
    }
    
    // USAR STATUS DIRETO DO BACKEND (já está correto)
    const finalStatus = clientData.status || 'disconnected';
    console.log(`📊 [UNIFIED] Status normalizado: ${clientData.status} -> ${finalStatus}`);
    return finalStatus;
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
      
      console.log(`📱 [UNIFIED] Status update recebido para ${instanceId}:`, {
        originalStatus: clientData.status,
        normalizedStatus: normalizedStatus,
        phoneNumber: clientData.phoneNumber || 'N/A',
        hasQrCode: clientData.hasQrCode,
        timestamp: clientData.timestamp
      });
      
      // ATUALIZAR ESTADO LOCAL IMEDIATAMENTE
      setInstances(prev => {
        const newState = {
          ...prev,
          [instanceId]: {
            instanceId,
            status: normalizedStatus,
            qrCode: clientData.qrCode,
            hasQrCode: clientData.hasQrCode || false,
            phoneNumber: clientData.phoneNumber,
            lastUpdated: timestamp
          }
        };
        
        console.log(`🔄 [UNIFIED] Estado atualizado para ${instanceId}:`, newState[instanceId]);
        return newState;
      });

      // SYNC COM BANCO DE DADOS (sem await para não bloquear UI)
      if (normalizedStatus !== 'connecting') {
        const updateData = clientData.phoneNumber ? { phone_number: clientData.phoneNumber } : undefined;
        whatsappInstancesService.updateInstanceStatus(instanceId, normalizedStatus, updateData)
          .then(() => {
            console.log(`✅ [UNIFIED] Banco sincronizado para ${instanceId}: ${normalizedStatus}`);
          })
          .catch((error) => {
            console.error(`❌ [UNIFIED] Erro ao sincronizar banco para ${instanceId}:`, error);
          });
      }

      // NOTIFICAÇÕES DE SUCESSO
      if (normalizedStatus === 'connected' && clientData.phoneNumber) {
        console.log(`🎉 [UNIFIED] WhatsApp conectado com sucesso: ${clientData.phoneNumber}`);
        toast({
          title: "✅ WhatsApp Conectado!",
          description: `Conectado com sucesso: ${clientData.phoneNumber}`,
        });
      } else if (normalizedStatus === 'qr_ready' && clientData.hasQrCode) {
        console.log(`📱 [UNIFIED] QR Code disponível para ${instanceId}`);
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
      
      // Polling inteligente como backup - REDUZIDO
      let pollCount = 0;
      const maxPolls = 10; // Reduzido de 20 para 10
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        console.log(`🔄 [UNIFIED] Polling ${instanceId} (${pollCount}/${maxPolls})`);
        
        try {
          await refreshStatus(instanceId);
          const currentStatus = getInstanceStatus(instanceId);
          
          // PARAR POLLING SE QR CODE APARECER OU CONECTAR
          if (currentStatus.hasQrCode || currentStatus.status === 'connected') {
            console.log(`✅ [UNIFIED] Polling finalizado para ${instanceId}: ${currentStatus.status}`);
            clearInterval(pollInterval);
          } else if (pollCount >= maxPolls) {
            console.log(`⏰ [UNIFIED] Polling timeout para ${instanceId} após ${maxPolls} tentativas`);
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.warn(`⚠️ [UNIFIED] Erro no polling ${pollCount}:`, error);
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
          }
        }
      }, 4000); // Aumentado de 3000 para 4000ms (menos agressivo)
      
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