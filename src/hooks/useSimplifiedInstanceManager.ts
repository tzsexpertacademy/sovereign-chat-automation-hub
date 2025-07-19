
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
  const [websocketConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔧 [SIMPLIFIED] Inicializando REST-only Instance Manager v2');
    console.log('📡 [SIMPLIFIED] CodeChat API v1.3.3 - Lógica que funcionou no diagnóstico');
  }, []);

  // BUSCAR STATUS ATUAL VIA REST
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [SIMPLIFIED] Buscando status REST: ${instanceId}`);
      
      const details = await codechatQRService.getInstanceDetails(instanceId);
      console.log(`📊 [SIMPLIFIED] Detalhes obtidos:`, details);
      
      let status = 'disconnected';
      let qrCode = undefined;
      let hasQrCode = false;
      let phoneNumber = undefined;
      
      if (details.connectionStatus === 'ONLINE' && details.ownerJid) {
        status = 'connected';
        phoneNumber = details.ownerJid;
      } else if (details.connectionStatus === 'OFFLINE') {
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

  // CONECTAR INSTÂNCIA - USANDO A LÓGICA QUE FUNCIONOU NO DIAGNÓSTICO
  const connectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [SIMPLIFIED] Conectando instância SIMPLIFICADA: ${instanceId}`);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: 'connecting',
          hasQrCode: false,
          lastUpdated: Date.now()
        }
      }));

      // 1. Conectar via REST (método que funcionou!)
      const connectResult = await codechatQRService.connectInstance(instanceId);
      console.log(`✅ [SIMPLIFIED] Connect executado:`, connectResult);
      
      // 2. VERIFICAR SE QR VEIO DIRETO DO CONNECT (estratégia que funcionou!)
      if (connectResult?.base64) {
        console.log(`🎯 [SIMPLIFIED] QR Code obtido DIRETAMENTE do connect!`);
        
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
        
        // 3. Iniciar polling para detectar scan
        startConnectionPolling(instanceId);
        return;
      }

      // FALLBACK: Se não veio no connect, aguardar e buscar
      console.log(`⏳ [SIMPLIFIED] QR não veio no connect, aguardando 12s...`);
      await new Promise(resolve => setTimeout(resolve, 12000));
      
      const qrResult = await codechatQRService.getQRCodeSimple(instanceId);
      
      if (qrResult.success && qrResult.qrCode) {
        console.log(`✅ [SIMPLIFIED] QR Code obtido via fetchInstance!`);
        
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

      throw new Error('QR Code não disponível');
      
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

  // Polling para detectar conexão (igual ao diagnóstico)
  const startConnectionPolling = useCallback((instanceId: string) => {
    console.log(`🔄 [SIMPLIFIED] Iniciando polling para ${instanceId}...`);
    
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
    }, 5000);
    
    // Parar polling após 3 minutos
    setTimeout(() => {
      clearInterval(pollInterval);
      console.log(`⏰ [SIMPLIFIED] Polling finalizado por timeout`);
    }, 180000);
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

  const getInstanceStatus = useCallback((instanceId: string): InstanceStatus => {
    return instances[instanceId] || { instanceId, status: 'disconnected' };
  }, [instances]);

  const isLoading = useCallback((instanceId: string): boolean => {
    return loading[instanceId] || false;
  }, [loading]);

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
