import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { useToast } from '@/hooks/use-toast';

interface InstanceStatus {
  instanceId: string;
  status: string;
  qrCode?: string;
  hasQrCode?: boolean;
  phoneNumber?: string;
}

interface InstanceManagerContextType {
  instances: Record<string, InstanceStatus>;
  loading: Record<string, boolean>;
  websocketConnected: boolean;
  connectInstance: (instanceId: string) => Promise<void>;
  disconnectInstance: (instanceId: string) => Promise<void>;
  getInstanceStatus: (instanceId: string) => InstanceStatus;
  isLoading: (instanceId: string) => boolean;
  cleanup: (instanceId: string) => void;
}

const InstanceManagerContext = createContext<InstanceManagerContextType | undefined>(undefined);

export const useInstanceManager = () => {
  const context = useContext(InstanceManagerContext);
  if (!context) {
    throw new Error('useInstanceManager must be used within InstanceManagerProvider');
  }
  return context;
};

interface InstanceManagerProviderProps {
  children: ReactNode;
}

export const InstanceManagerProvider: React.FC<InstanceManagerProviderProps> = ({ children }) => {
  const [instances, setInstances] = useState<Record<string, InstanceStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔍 [GLOBAL] Iniciando Instance Manager Global');
    
    // Conectar ao WebSocket
    const socket = whatsappService.connectSocket();
    
    if (socket) {
      socket.on('connect', () => {
        console.log('✅ [GLOBAL] WebSocket conectado no Instance Manager Global');
        setWebsocketConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('❌ [GLOBAL] WebSocket desconectado no Instance Manager Global');
        setWebsocketConnected(false);
        // Tentar reconectar automaticamente após 3 segundos
        setTimeout(() => {
          console.log('🔄 [GLOBAL] Tentando reconectar WebSocket...');
          whatsappService.connectSocket();
        }, 3000);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ [GLOBAL] Erro WebSocket no Instance Manager Global:', error);
        setWebsocketConnected(false);
      });

      // Responder ao heartbeat do servidor
      socket.on('ping', () => {
        socket.emit('pong');
      });
    }

      // SISTEMA DE POLLING CRÍTICO - REDUZIDO PARA 3 SEGUNDOS
      const statusPollingInterval = setInterval(async () => {
        const instanceIds = Object.keys(instances);
        if (instanceIds.length === 0) return;

        console.log('🔄 [GLOBAL] Polling CRÍTICO (3s) para todas as instâncias...');
        
        for (const instanceId of instanceIds) {
          try {
            const realStatus = await whatsappService.getClientStatus(instanceId);
            const currentLocalStatus = instances[instanceId]?.status;
            
            // CORREÇÃO CRÍTICA - PRIORIZAR PHONEUMBER E AUTHENTICATED
            let normalizedStatus = realStatus.status;
            
            // PRIORIDADE 1: Se tem phoneNumber, SEMPRE é 'connected'
            if (realStatus.phoneNumber && realStatus.phoneNumber.length > 0) {
              normalizedStatus = 'connected';
            }
            // PRIORIDADE 2: Se status é 'authenticated', SEMPRE é 'connected'
            else if (realStatus.status === 'authenticated') {
              normalizedStatus = 'connected';
            }
            // PRIORIDADE 3: Se status já é 'connected', manter
            else if (realStatus.status === 'connected') {
              normalizedStatus = 'connected';
            }
            // APENAS se não tem phone E não está autenticado → verificar QR
            else if (realStatus.hasQrCode && !realStatus.phoneNumber) {
              normalizedStatus = 'qr_ready';
            }
            
            // FORÇAR ATUALIZAÇÃO PARA QUALQUER MUDANÇA REAL
            const shouldUpdate = (
              currentLocalStatus !== normalizedStatus ||
              (realStatus.phoneNumber && !instances[instanceId]?.phoneNumber) ||
              (normalizedStatus === 'connected' && currentLocalStatus !== 'connected') ||
              (realStatus.status === 'authenticated' && currentLocalStatus !== 'connected')
            );
            
            if (shouldUpdate) {
              console.log(`🔄 [GLOBAL] FORÇANDO atualização ${instanceId}: ${currentLocalStatus} -> ${normalizedStatus}`);
              
              setInstances(prev => ({
                ...prev,
                [instanceId]: {
                  instanceId,
                  status: normalizedStatus,
                  qrCode: normalizedStatus === 'qr_ready' ? realStatus.qrCode : undefined,
                  hasQrCode: normalizedStatus === 'qr_ready' ? realStatus.hasQrCode : false,
                  phoneNumber: realStatus.phoneNumber
                }
              }));

              // FORÇAR UPDATE NO BANCO PARA QUALQUER MUDANÇA
              console.log(`💾 [GLOBAL] FORÇANDO update banco: ${instanceId} -> ${normalizedStatus}`);
              whatsappInstancesService.updateInstanceStatus(
                instanceId, 
                normalizedStatus,
                realStatus.phoneNumber ? { phone_number: realStatus.phoneNumber } : undefined
              ).catch(console.error);

              // Toast apenas para conexões importantes
              if (normalizedStatus === 'connected' && currentLocalStatus !== 'connected') {
                toast({
                  title: "✅ WhatsApp Conectado!",
                  description: `Instância conectada: ${realStatus.phoneNumber || 'Conectado'}`,
                });
              }
            }
          } catch (error) {
            console.warn(`⚠️ [GLOBAL] Erro no polling para ${instanceId}:`, error);
          }
        }
      }, 3000); // POLLING CRÍTICO: 3 segundos para capturar mudanças rapidamente

    return () => {
      console.log('🧹 [GLOBAL] Limpando Instance Manager Global');
      clearInterval(statusPollingInterval);
      // Limpar todos os listeners ao desmontar
      if (socket) {
        Object.keys(instances).forEach(instanceId => {
          whatsappService.offClientStatus(instanceId);
        });
      }
    };
  }, [instances, toast]);

  const connectInstance = async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [GLOBAL] Conectando instância: ${instanceId}`);
      
      // Primeiro, garantir que o WebSocket está conectado
      const socket = whatsappService.getSocket();
      if (!socket || !socket.connected) {
        console.log('🔌 [GLOBAL] WebSocket não conectado, reconectando...');
        whatsappService.connectSocket();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar conexão
      }
      
      // Limpar listeners anteriores
      whatsappService.offClientStatus(instanceId);
      
        // Configurar listener ANTES de entrar na sala
        const handleClientStatus = (clientData: any) => {
          console.log(`📱 [GLOBAL] Status recebido para ${instanceId}:`, {
            status: clientData.status,
            hasQrCode: clientData.hasQrCode,
            timestamp: clientData.timestamp
          });
          
          // MAPEAR STATUS CORRETAMENTE - PRIORIZAR PHONEUMBER E AUTHENTICATED
          let normalizedStatus = clientData.status;
          if (clientData.phoneNumber && clientData.phoneNumber.length > 0) {
            normalizedStatus = 'connected';
          } else if (clientData.status === 'authenticated') {
            normalizedStatus = 'connected';
          } else if (clientData.status === 'connected') {
            normalizedStatus = 'connected';
          }
          
          setInstances(prev => ({
            ...prev,
            [instanceId]: {
              instanceId: clientData.clientId || instanceId,
              status: normalizedStatus,
              qrCode: clientData.qrCode,
              hasQrCode: clientData.hasQrCode || false,
              phoneNumber: clientData.phoneNumber
            }
          }));

        // Atualizar status no banco se necessário
        if (normalizedStatus !== 'connecting') {
          whatsappInstancesService.updateInstanceStatus(
            instanceId, 
            normalizedStatus,
            clientData.phoneNumber ? { phone_number: clientData.phoneNumber } : undefined
          ).catch(console.error);
        }

        if (clientData.hasQrCode && clientData.qrCode) {
          console.log('🎉 [GLOBAL] QR Code recebido!', clientData.qrCode.substring(0, 50) + '...');
          toast({
            title: "QR Code Disponível!",
            description: `Escaneie o QR Code para conectar a instância`,
          });
        }

        if (normalizedStatus === 'connected') {
          toast({
            title: "WhatsApp Conectado!",
            description: `Instância conectada com sucesso`,
          });
        }
      };

      // Escutar status da instância
      whatsappService.onClientStatus(instanceId, handleClientStatus);
      
      // Entrar na sala da instância
      whatsappService.joinClientRoom(instanceId);
      
      // Aguardar configuração da sala
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Iniciar conexão
      console.log(`🔗 [GLOBAL] Enviando comando de conexão para ${instanceId}`);
      await whatsappService.connectClient(instanceId);
      
      // POLLING BACKUP - Verificar status via API como fallback
      const startPolling = () => {
        let pollCount = 0;
        const maxPolls = 30; // 30 tentativas = 1.5 minutos
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          console.log(`🔄 [GLOBAL] Polling status ${instanceId} (tentativa ${pollCount}/${maxPolls})`);
          
          try {
            const status = await whatsappService.getClientStatus(instanceId);
            
            if (status.hasQrCode && status.qrCode) {
              console.log('📱 [GLOBAL] QR Code encontrado via polling!');
              handleClientStatus(status);
              clearInterval(pollInterval);
            } else if (status.status === 'connected') {
              console.log('✅ [GLOBAL] Cliente conectado via polling!');
              handleClientStatus(status);
              clearInterval(pollInterval);
            } else if (pollCount >= maxPolls) {
              console.log('⏰ [GLOBAL] Polling timeout atingido');
              clearInterval(pollInterval);
            }
          } catch (error: any) {
            console.warn(`⚠️ [GLOBAL] Erro no polling ${pollCount}:`, error.message);
            if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
            }
          }
        }, 3000); // Verificar a cada 3 segundos
      };
      
      // Iniciar polling backup após 5 segundos
      setTimeout(startPolling, 5000);
      
      toast({
        title: "Conectando...",
        description: "Aguarde o QR Code aparecer (sistema global sincronizado)",
      });
      
    } catch (error: any) {
      console.error('❌ [GLOBAL] Erro ao conectar instância:', error);
      toast({
        title: "Erro na Conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  };

  const disconnectInstance = async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🔌 [GLOBAL] Desconectando instância: ${instanceId}`);
      
      // Desconectar do servidor
      await whatsappService.disconnectClient(instanceId);
      
      // Parar de escutar eventos
      whatsappService.offClientStatus(instanceId);
      
      // Atualizar estado local
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'disconnected',
          qrCode: undefined,
          hasQrCode: false
        }
      }));

      // Atualizar status no banco
      await whatsappInstancesService.updateInstanceStatus(instanceId, 'disconnected');

      toast({
        title: "Desconectado",
        description: "Instância desconectada com sucesso",
      });
      
    } catch (error: any) {
      console.error('❌ [GLOBAL] Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  };

  const getInstanceStatus = (instanceId: string) => {
    return instances[instanceId] || { instanceId, status: 'disconnected' };
  };

  const isLoading = (instanceId: string) => {
    return loading[instanceId] || false;
  };

  const cleanup = (instanceId: string) => {
    whatsappService.offClientStatus(instanceId);
    setInstances(prev => {
      const newInstances = { ...prev };
      delete newInstances[instanceId];
      return newInstances;
    });
  };

  const value: InstanceManagerContextType = {
    instances,
    loading,
    websocketConnected,
    connectInstance,
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    cleanup
  };

  return (
    <InstanceManagerContext.Provider value={value}>
      {children}
    </InstanceManagerContext.Provider>
  );
};