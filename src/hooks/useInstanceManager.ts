
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
    console.log('🔍 Inicializando Instance Manager Simplificado');
    
    // Conectar WebSocket
    const socket = whatsappService.connectSocket();
    
    if (socket) {
      socket.on('connect', () => {
        console.log('✅ WebSocket conectado no Instance Manager');
        setWebsocketConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('❌ WebSocket desconectado no Instance Manager');
        setWebsocketConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Erro WebSocket no Instance Manager:', error);
        setWebsocketConnected(false);
      });
    }

    return () => {
      console.log('🧹 Limpando Instance Manager');
    };
  }, []);

  const connectInstance = async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 Conectando instância: ${instanceId}`);
      
      // Limpar listeners anteriores
      whatsappService.offClientStatus(instanceId);
      
      // Configurar listener para status
      const handleClientStatus = (clientData: any) => {
        console.log(`📱 Status recebido para ${instanceId}:`, {
          status: clientData.status,
          hasQrCode: clientData.hasQrCode,
          qrCode: clientData.qrCode ? 'Presente' : 'Ausente'
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

        // Atualizar status no banco
        if (clientData.status !== 'connecting') {
          whatsappInstancesService.updateInstanceStatus(
            instanceId, 
            clientData.status,
            clientData.phoneNumber ? { phone_number: clientData.phoneNumber } : undefined
          ).catch(console.error);
        }

        if (clientData.hasQrCode && clientData.qrCode) {
          console.log('🎉 QR Code recebido!');
          toast({
            title: "QR Code Disponível!",
            description: `Escaneie o QR Code para conectar`,
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
      
      // Aguardar um pouco para configuração
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Iniciar conexão
      console.log(`🔗 Enviando comando de conexão para ${instanceId}`);
      await whatsappService.connectClient(instanceId);
      
      // Polling backup para garantir que pegamos o QR Code
      let pollCount = 0;
      const maxPolls = 20; // 20 tentativas = 1 minuto
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        console.log(`🔄 Verificando status ${instanceId} (${pollCount}/${maxPolls})`);
        
        try {
          const status = await whatsappService.getClientStatus(instanceId);
          
          if (status.hasQrCode && status.qrCode) {
            console.log('📱 QR Code encontrado via polling!');
            handleClientStatus(status);
            clearInterval(pollInterval);
          } else if (status.status === 'connected') {
            console.log('✅ Cliente conectado via polling!');
            handleClientStatus(status);
            clearInterval(pollInterval);
          } else if (pollCount >= maxPolls) {
            console.log('⏰ Polling timeout');
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.warn(`⚠️ Erro no polling ${pollCount}:`, error);
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
          }
        }
      }, 3000); // Verificar a cada 3 segundos
      
      toast({
        title: "Conectando...",
        description: "Aguarde o QR Code aparecer",
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao conectar instância:', error);
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
