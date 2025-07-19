
import { useState, useEffect, useCallback } from 'react';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { codechatQRService } from '@/services/codechatQRService';
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
  const [websocketConnected] = useState(false); // REST-only, sem WebSocket
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔧 [SIMPLIFIED] Inicializando REST-only Instance Manager');
    console.log('📡 [SIMPLIFIED] CodeChat API v1.3.3 - 100% REST sem WebSocket');
  }, []);

  // BUSCAR STATUS ATUAL VIA REST - SIMPLIFICADO
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [SIMPLIFIED] Buscando status REST: ${instanceId}`);
      
      // Buscar detalhes da instância via REST
      const details = await codechatQRService.getInstanceDetails(instanceId);
      console.log(`📊 [SIMPLIFIED] Detalhes obtidos:`, details);
      
      let status = 'disconnected';
      let qrCode = undefined;
      let hasQrCode = false;
      let phoneNumber = undefined;
      
      // Mapear status baseado no connectionStatus
      if (details.connectionStatus === 'ONLINE' && details.ownerJid) {
        status = 'connected';
        phoneNumber = details.ownerJid;
      } else if (details.connectionStatus === 'OFFLINE') {
        // Verificar se tem QR code disponível
        const qrResult = await codechatQRService.getQRCodeSimple(instanceId);
        if (qrResult.success && qrResult.qrCode) {
          status = 'qr_ready';
          qrCode = qrResult.qrCode;
          hasQrCode = true;
        } else {
          status = 'connecting';
        }
      }
      
      console.log(`📊 [SIMPLIFIED] Status processado: ${status}, QR: ${hasQrCode}`);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status,
          qrCode,
          hasQrCode,
          phoneNumber,
          lastUpdated: Date.now()
        }
      }));
      
    } catch (error) {
      console.error(`❌ [SIMPLIFIED] Erro ao buscar status ${instanceId}:`, error);
      
      // Se 404, marcar como não encontrada
      if (error.message?.includes('404')) {
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            instanceId,
            status: 'not_found',
            lastUpdated: Date.now()
          }
        }));
      }
      
      throw error;
    }
  }, []);

  // CONECTAR INSTÂNCIA - FLUXO SIMPLIFICADO
  const connectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [SIMPLIFIED] Conectando instância SIMPLIFICADA: ${instanceId}`);
      
      // Status inicial
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: 'connecting',
          hasQrCode: false,
          lastUpdated: Date.now()
        }
      }));

      // 1. Conectar via REST
      await codechatQRService.connectInstance(instanceId);
      console.log(`✅ [SIMPLIFIED] Connect executado com sucesso`);
      
      // 2. Aguardar estabilização
      console.log(`⏳ [SIMPLIFIED] Aguardando 15s para estabilização...`);
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // 3. Buscar QR code
      console.log(`📱 [SIMPLIFIED] Buscando QR Code...`);
      const qrResult = await codechatQRService.getQRCodeSimple(instanceId);
      
      if (qrResult.success && qrResult.qrCode) {
        console.log(`🎉 [SIMPLIFIED] QR Code obtido!`);
        
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
          description: "Escaneie o QR Code para conectar o WhatsApp",
        });
        
        // 4. Iniciar polling para detectar scan
        console.log(`🔄 [SIMPLIFIED] Iniciando polling para detectar scan...`);
        const pollInterval = setInterval(async () => {
          try {
            const details = await codechatQRService.getInstanceDetails(instanceId);
            
            if (details.connectionStatus === 'ONLINE' && details.ownerJid) {
              console.log(`✅ [SIMPLIFIED] WhatsApp conectado! ${details.ownerJid}`);
              
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
            console.warn(`⚠️ [SIMPLIFIED] Erro no polling:`, error);
          }
        }, 5000); // Poll a cada 5 segundos
        
        // Parar polling após 2 minutos
        setTimeout(() => {
          clearInterval(pollInterval);
          console.log(`⏰ [SIMPLIFIED] Polling finalizado por timeout`);
        }, 120000);
        
      } else {
        console.log(`⚠️ [SIMPLIFIED] QR Code não obtido: ${qrResult.error}`);
        
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            status: 'error',
            lastUpdated: Date.now()
          }
        }));
        
        toast({
          title: "Erro",
          description: "Não foi possível obter o QR Code",
          variant: "destructive"
        });
      }
      
    } catch (error: any) {
      console.error('❌ [SIMPLIFIED] Erro ao conectar:', error);
      
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
  }, [toast]);

  // DESCONECTAR INSTÂNCIA
  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🔌 [SIMPLIFIED] Desconectando instância: ${instanceId}`);
      
      const result = await codechatQRService.disconnectInstance(instanceId);
      
      if (result.success) {
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            status: 'disconnected',
            qrCode: undefined,
            hasQrCode: false,
            phoneNumber: undefined,
            lastUpdated: Date.now()
          }
        }));

        await whatsappInstancesService.updateInstanceStatus(instanceId, 'disconnected');

        toast({
          title: "Desconectado",
          description: "Instância desconectada com sucesso",
        });
      }
      
    } catch (error: any) {
      console.error('❌ [SIMPLIFIED] Erro ao desconectar:', error);
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
