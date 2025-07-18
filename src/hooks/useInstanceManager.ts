import { useState, useEffect } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { useToast } from '@/hooks/use-toast';
import { codechatQRService } from '@/services/codechatQRService';

interface InstanceStatus {
  instanceId: string;
  status: string;
  qrCode?: string;
  hasQrCode?: boolean;
  phoneNumber?: string;
  lastUpdated?: number;
}

export const useInstanceManager = () => {
  const [instances, setInstances] = useState<Record<string, InstanceStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔍 Inicializando Instance Manager - REST Mode');
    return () => {
      console.log('🧹 Limpando Instance Manager');
    };
  }, []);

  const connectInstance = async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [INSTANCE-MANAGER] Conectando instância: ${instanceId}`);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: 'connecting',
          hasQrCode: false,
          lastUpdated: Date.now()
        }
      }));

      // CORREÇÃO: Usar codechatQRService que agora tem auth correta
      const createResult = await codechatQRService.createInstance(instanceId);
      console.log(`✅ [INSTANCE-MANAGER] Instância criada:`, createResult);

      // Aguardar 5 segundos para instância inicializar
      console.log(`⏳ [INSTANCE-MANAGER] Aguardando inicialização...`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verificar status e aguardar ficar pronta
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`🔍 [INSTANCE-MANAGER] Tentativa ${attempts}/${maxAttempts} - verificando estado`);

        try {
          const statusData = await codechatQRService.getInstanceStatus(instanceId);
          console.log(`📊 [INSTANCE-MANAGER] Estado: ${statusData.state}, Reason: ${statusData.statusReason}`);

          if (statusData.state === 'open') {
            console.log(`✅ [INSTANCE-MANAGER] Instância online!`);
            setInstances(prev => ({
              ...prev,
              [instanceId]: {
                ...prev[instanceId],
                status: 'connected',
                lastUpdated: Date.now()
              }
            }));
            
            toast({
              title: "✅ WhatsApp Conectado!",
              description: "Instância conectada com sucesso",
            });
            return;
          } else if (statusData.state === 'qr' || statusData.state === 'connecting') {
            console.log(`📱 [INSTANCE-MANAGER] Estado adequado para QR: ${statusData.state}`);
            
            // Tentar obter QR Code
            const qrResult = await codechatQRService.getQRCode(instanceId);
            
            if (qrResult.success && qrResult.qrCode) {
              console.log(`📱 [INSTANCE-MANAGER] QR Code obtido!`);
              setInstances(prev => ({
                ...prev,
                [instanceId]: {
                  ...prev[instanceId],
                  status: 'qr_ready',
                  qrCode: qrResult.qrCode,
                  hasQrCode: true,
                  lastUpdated: Date.now()
                }
              }));

              toast({
                title: "📱 QR Code Disponível!",
                description: "Escaneie o QR Code para conectar",
              });
              return;
            }
          }

          // Se ainda está 'close', aguardar mais tempo
          if (statusData.state === 'close') {
            console.log(`⏳ [INSTANCE-MANAGER] Instância ainda fechada, aguardando...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

        } catch (error: any) {
          console.error(`❌ [INSTANCE-MANAGER] Erro na tentativa ${attempts}:`, error);
          
          if (attempts >= maxAttempts) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      throw new Error('Instância não ficou pronta após múltiplas tentativas');
      
    } catch (error: any) {
      console.error('❌ [INSTANCE-MANAGER] Erro ao conectar instância:', error);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'error',
          lastUpdated: Date.now()
        }
      }));
      
      toast({
        title: "Erro na Conexão",
        description: error.message,
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  };

  const disconnectInstance = async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🔌 [INSTANCE-MANAGER] Desconectando instância: ${instanceId}`);
      
      // Usar codechatQRService com auth correta
      const result = await codechatQRService.disconnectInstance(instanceId);
      
      if (result.success) {
        console.log(`✅ [INSTANCE-MANAGER] Desconectado com sucesso`);
      } else {
        console.warn(`⚠️ [INSTANCE-MANAGER] Disconnect falhou:`, result.error);
      }
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'disconnected',
          qrCode: undefined,
          hasQrCode: false,
          lastUpdated: Date.now()
        }
      }));

      // Atualizar status no banco
      await whatsappInstancesService.updateInstanceStatus(instanceId, 'disconnected');

      toast({
        title: "Desconectado",
        description: "Instância desconectada com sucesso",
      });
      
    } catch (error: any) {
      console.error('❌ [INSTANCE-MANAGER] Erro ao desconectar:', error);
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
