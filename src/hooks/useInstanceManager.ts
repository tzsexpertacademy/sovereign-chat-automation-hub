import { useState, useEffect } from 'react';
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

export const useInstanceManager = () => {
  const [instances, setInstances] = useState<Record<string, InstanceStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔍 [MANAGER] Iniciando Instance Manager');
    
    // Conectar ao WebSocket
    const socket = whatsappService.connectSocket();
    
    if (socket) {
      socket.on('connect', () => {
        console.log('✅ [MANAGER] WebSocket conectado no Instance Manager');
        setWebsocketConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('❌ [MANAGER] WebSocket desconectado no Instance Manager');
        setWebsocketConnected(false);
        // Tentar reconectar automaticamente após 3 segundos
        setTimeout(() => {
          console.log('🔄 [MANAGER] Tentando reconectar WebSocket...');
          whatsappService.connectSocket();
        }, 3000);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ [MANAGER] Erro WebSocket no Instance Manager:', error);
        setWebsocketConnected(false);
      });

      // Responder ao heartbeat do servidor
      socket.on('ping', () => {
        socket.emit('pong');
      });
    }

    return () => {
      console.log('🧹 [MANAGER] Limpando Instance Manager');
      // Limpar todos os listeners ao desmontar
      if (socket) {
        Object.keys(instances).forEach(instanceId => {
          whatsappService.offClientStatus(instanceId);
        });
      }
    };
  }, []); // Removeu 'instances' da dependência para evitar re-renders desnecessários

  const connectInstance = async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [MANAGER] Conectando instância: ${instanceId}`);
      
      // Primeiro, garantir que o WebSocket está conectado
      const socket = whatsappService.getSocket();
      if (!socket || !socket.connected) {
        console.log('🔌 [MANAGER] WebSocket não conectado, reconectando...');
        whatsappService.connectSocket();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar conexão
      }
      
      // Limpar listeners anteriores
      whatsappService.offClientStatus(instanceId);
      
      // Configurar listener ANTES de entrar na sala
      const handleClientStatus = (clientData: any) => {
        console.log(`📱 [MANAGER] Status recebido para ${instanceId}:`, {
          status: clientData.status,
          hasQrCode: clientData.hasQrCode,
          timestamp: clientData.timestamp
        });
        
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            instanceId: clientData.clientId || instanceId,
            status: clientData.status,
            qrCode: clientData.qrCode,
            hasQrCode: clientData.hasQrCode || false,
            phoneNumber: clientData.phoneNumber
          }
        }));

        // Atualizar status no banco se necessário
        if (clientData.status !== 'connecting') {
          whatsappInstancesService.updateInstanceStatus(
            instanceId, 
            clientData.status,
            clientData.phoneNumber ? { phone_number: clientData.phoneNumber } : undefined
          ).catch(console.error);
        }

        if (clientData.hasQrCode && clientData.qrCode) {
          console.log('🎉 [MANAGER] QR Code recebido!', clientData.qrCode.substring(0, 50) + '...');
          toast({
            title: "QR Code Disponível!",
            description: `Escaneie o QR Code para conectar a instância`,
          });
        }

        if (clientData.status === 'connected') {
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
      console.log(`🔗 [MANAGER] Enviando comando de conexão para ${instanceId}`);
      await whatsappService.connectClient(instanceId);
      
      // POLLING BACKUP - Verificar status via API como fallback
      const startPolling = () => {
        let pollCount = 0;
        const maxPolls = 30; // 30 tentativas = 1.5 minutos
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          console.log(`🔄 [MANAGER] Polling status ${instanceId} (tentativa ${pollCount}/${maxPolls})`);
          
          try {
            const status = await whatsappService.getClientStatus(instanceId);
            
            if (status.hasQrCode && status.qrCode) {
              console.log('📱 [MANAGER] QR Code encontrado via polling!');
              handleClientStatus(status);
              clearInterval(pollInterval);
            } else if (status.status === 'connected') {
              console.log('✅ [MANAGER] Cliente conectado via polling!');
              handleClientStatus(status);
              clearInterval(pollInterval);
            } else if (pollCount >= maxPolls) {
              console.log('⏰ [MANAGER] Polling timeout atingido');
              clearInterval(pollInterval);
            }
          } catch (error) {
            console.warn(`⚠️ [MANAGER] Erro no polling ${pollCount}:`, error.message);
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
        description: "Aguarde o QR Code aparecer (com backup polling)",
      });
      
    } catch (error: any) {
      console.error('❌ [MANAGER] Erro ao conectar instância:', error);
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
      console.log(`🔌 Desconectando instância: ${instanceId}`);
      
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
      console.error('❌ Erro ao desconectar:', error);
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

  return {
    connectInstance,
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup
  };
};