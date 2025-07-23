
import { useState, useEffect } from 'react';
import whatsappService from '@/services/whatsappMultiClient';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { useToast } from '@/hooks/use-toast';
import { codechatQRService, type InstanceDetails, type ConnectResult } from '@/services/codechatQRService';

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
    console.log('🔍 Inicializando Instance Manager - YUMER REST Mode v2');
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

      // ETAPA 1: Criar instância no YUMER (se não existir)
      console.log(`📝 [INSTANCE-MANAGER] Verificando/criando instância...`);
      try {
        const existsCheck = await codechatQRService.checkInstanceExists(instanceId);
        if (!existsCheck.exists) {
          console.log(`📝 [INSTANCE-MANAGER] Criando instância no YUMER...`);
          await codechatQRService.createInstance(instanceId, `Instance: ${instanceId}`);
          console.log(`✅ [INSTANCE-MANAGER] Instância criada no YUMER`);
          
          // Aguardar inicialização
          console.log(`⏳ [INSTANCE-MANAGER] Aguardando 15s para inicialização...`);
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      } catch (createError: any) {
        console.log(`ℹ️ [INSTANCE-MANAGER] Instância pode já existir: ${createError.message}`);
      }

      // ETAPA 2: Conectar e obter QR direto
      console.log(`🔌 [INSTANCE-MANAGER] Conectando instância...`);
      const connectResult: ConnectResult = await codechatQRService.connectInstance(instanceId);
      console.log(`📡 [INSTANCE-MANAGER] Connect executado:`, connectResult);
      
      // VERIFICAR SE QR VEIO DIRETO DO CONNECT
      if (connectResult?.base64) {
        console.log(`🎯 [INSTANCE-MANAGER] QR Code obtido DIRETAMENTE do connect!`);
        
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            status: 'qr_ready',
            qrCode: connectResult.base64,
            hasQrCode: true,
            lastUpdated: Date.now()
          }
        }));

        toast({
          title: "📱 QR Code Disponível!",
          description: "Escaneie o QR Code para conectar o WhatsApp",
        });
        
        // ETAPA 3: Iniciar polling para detectar scan
        console.log(`🔄 [INSTANCE-MANAGER] Iniciando polling para detectar scan...`);
        startConnectionPolling(instanceId);
        return;
      }

      // FALLBACK: Se não veio no connect, buscar via fetchInstance
      console.log(`⏳ [INSTANCE-MANAGER] QR não veio no connect, aguardando 12s...`);
      await new Promise(resolve => setTimeout(resolve, 12000));
      
      console.log(`📱 [INSTANCE-MANAGER] Buscando QR via fetchInstance...`);
      const qrResult = await codechatQRService.getQRCodeSimple(instanceId);
      
      if (qrResult.success && qrResult.qrCode) {
        console.log(`✅ [INSTANCE-MANAGER] QR Code obtido via fetchInstance!`);
        
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
        
        startConnectionPolling(instanceId);
        return;
      }

      throw new Error('QR Code não disponível após múltiplas tentativas');
      
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

  // Polling para detectar quando WhatsApp é conectado
  const startConnectionPolling = (instanceId: string) => {
    console.log(`🔄 [INSTANCE-MANAGER] Iniciando polling para ${instanceId}...`);
    
    const pollInterval = setInterval(async () => {
      try {
        const details: InstanceDetails = await codechatQRService.getInstanceDetails(instanceId);
        
        if (details.success && details.connectionStatus === 'ONLINE' && details.ownerJid) {
          console.log(`✅ [INSTANCE-MANAGER] WhatsApp conectado! ${details.ownerJid}`);
          
          setInstances(prev => ({
            ...prev,
            [instanceId]: {
              ...prev[instanceId],
              status: 'connected',
              phoneNumber: details.ownerJid,
              qrCode: undefined,
              hasQrCode: false,
              lastUpdated: Date.now()
            }
          }));
          
          // Sync com Supabase
          await whatsappInstancesService.updateInstanceStatus(instanceId, 'connected', {
            phone_number: details.ownerJid
          });
          
          toast({
            title: "✅ WhatsApp Conectado!",
            description: `Conectado: ${details.ownerJid}`,
          });
          
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.warn(`⚠️ [INSTANCE-MANAGER] Erro no polling:`, error);
      }
    }, 5000); // Poll a cada 5 segundos
    
    // Parar polling após 3 minutos
    setTimeout(() => {
      clearInterval(pollInterval);
      console.log(`⏰ [INSTANCE-MANAGER] Polling finalizado por timeout`);
    }, 180000);
  };

  const disconnectInstance = async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🔌 [INSTANCE-MANAGER] Desconectando instância: ${instanceId}`);
      
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

  const refreshQRCode = async (instanceId: string) => {
    try {
      console.log(`🔄 [INSTANCE-MANAGER] Atualizando QR Code: ${instanceId}`);
      
      const qrResult = await codechatQRService.getQRCodeSimple(instanceId);
      
      if (qrResult.success && qrResult.qrCode) {
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            qrCode: qrResult.qrCode,
            lastUpdated: Date.now()
          }
        }));
        
        toast({
          title: "QR Code Atualizado",
          description: "QR Code foi atualizado com sucesso",
        });
      }
    } catch (error: any) {
      console.error('❌ [INSTANCE-MANAGER] Erro ao atualizar QR:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar QR Code",
        variant: "destructive",
      });
    }
  };

  const getInstanceStatus = (instanceId: string) => {
    return instances[instanceId] || { instanceId, status: 'disconnected' };
  };

  const isLoading = (instanceId: string) => {
    return loading[instanceId] || false;
  };

  const cleanup = (instanceId: string) => {
    setInstances(prev => {
      const newInstances = { ...prev };
      delete newInstances[instanceId];
      return newInstances;
    });
  };

  return {
    connectInstance,
    disconnectInstance,
    refreshQRCode,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup
  };
};
