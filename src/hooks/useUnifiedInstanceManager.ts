import { useState, useEffect, useCallback } from 'react';
import { yumerNativeWebSocketService } from '@/services/yumerNativeWebSocketService';
import { yumerJwtService } from '@/services/yumerJwtService';
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

interface UseUnifiedInstanceManagerReturn {
  instances: Record<string, InstanceStatus>;
  loading: Record<string, boolean>;
  websocketConnected: boolean;
  jwtConfigured: boolean;
  connectInstance: (instanceId: string) => Promise<void>;
  disconnectInstance: (instanceId: string) => Promise<void>;
  getInstanceStatus: (instanceId: string) => InstanceStatus;
  isLoading: (instanceId: string) => boolean;
  cleanup: (instanceId: string) => void;
  refreshStatus: (instanceId: string) => Promise<void>;
  startPollingForInstance: (instanceId: string) => void;
  stopPollingForInstance: (instanceId: string) => void;
}

export const useUnifiedInstanceManager = (): UseUnifiedInstanceManagerReturn => {
  const [instances, setInstances] = useState<Record<string, InstanceStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [jwtConfigured, setJwtConfigured] = useState(false);
  const { toast } = useToast();

  // Configuração JWT
  const JWT_SECRET = 'sfdgs8152g5s1s5';

  // Verificar se JWT está configurado
  useEffect(() => {
    const checkJwtConfig = () => {
      setJwtConfigured(!!JWT_SECRET);
    };
    checkJwtConfig();
  }, []);

  // ============ REST-FIRST INITIALIZATION ============
  useEffect(() => {
    console.log('🔧 [UNIFIED] Inicializando REST-first Instance Manager');
    console.log('📡 [UNIFIED] Foco em CodeChat API v1.3.3 via REST');
    
    // WebSocket é opcional para eventos em tempo real
    setWebsocketConnected(false);
    
    return () => {
      console.log('🧹 [UNIFIED] Cleanup do manager');
    };
  }, []);

  // Handlers para updates do WebSocket
  const handleInstanceStatusUpdate = useCallback((data: any) => {
    const { instanceName, status, phoneNumber } = data;
    const timestamp = Date.now();
    
    console.log(`📱 [UNIFIED] Status update para ${instanceName}:`, { status, phoneNumber });
    
    setInstances(prev => ({
      ...prev,
      [instanceName]: {
        instanceId: instanceName,
        status: status || 'disconnected',
        phoneNumber: phoneNumber,
        hasQrCode: false,
        lastUpdated: timestamp
      }
    }));

    // Sync com banco de dados
    if (status && status !== 'connecting') {
      const updateData = phoneNumber ? { phone_number: phoneNumber } : undefined;
      whatsappInstancesService.updateInstanceStatus(instanceName, status, updateData)
        .then(() => console.log(`✅ [UNIFIED] Banco sincronizado para ${instanceName}`))
        .catch((error) => console.error(`❌ [UNIFIED] Erro ao sincronizar:`, error));
    }

    // Notificação de sucesso
    if (status === 'connected' && phoneNumber) {
      toast({
        title: "✅ WhatsApp Conectado!",
        description: `Conectado com sucesso: ${phoneNumber}`,
      });
    }
  }, [toast]);

  const handleQRCodeUpdate = useCallback((data: any) => {
    const { instanceName, qrCode } = data;
    const timestamp = Date.now();
    
    console.log(`📱 [UNIFIED] QR Code update para ${instanceName}`);
    
    setInstances(prev => ({
      ...prev,
      [instanceName]: {
        ...prev[instanceName],
        instanceId: instanceName,
        status: 'qr_ready',
        qrCode: qrCode,
        hasQrCode: true,
        lastUpdated: timestamp
      }
    }));

    toast({
      title: "📱 QR Code Disponível!",
      description: "Escaneie o QR Code para conectar",
    });
  }, [toast]);

  // ============ POLLING PARA STATUS ============
  const pollingIntervals = useState<Map<string, NodeJS.Timeout>>(new Map())[0];
  
  const startPollingForInstance = useCallback((instanceId: string) => {
    if (pollingIntervals.has(instanceId)) return;
    
    console.log(`🔄 [UNIFIED] Iniciando polling para ${instanceId}`);
    const interval = setInterval(async () => {
      try {
        await refreshStatus(instanceId);
      } catch (error) {
        console.error(`❌ [UNIFIED] Erro no polling de ${instanceId}:`, error);
      }
    }, 3000); // Poll a cada 3 segundos
    
    pollingIntervals.set(instanceId, interval);
  }, []);
  
  const stopPollingForInstance = useCallback((instanceId: string) => {
    const interval = pollingIntervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.delete(instanceId);
      console.log(`⏹️ [UNIFIED] Polling interrompido para ${instanceId}`);
    }
  }, []);

  // ============ ATUALIZAR STATUS VIA REST API ============
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [UNIFIED] Atualizando status via CodeChat API: ${instanceId}`);
      
      // Usar CodeChat API para buscar status atual
      const response = await codechatQRService.getInstanceStatus(instanceId);
      
      if (response.success && response.data) {
        const { connectionStatus, ownerJid, profilePicUrl } = response.data;
        
        // Mapear status CodeChat para interno
        const mappedStatus = connectionStatus === 'ONLINE' ? 'connected' : 
                            connectionStatus === 'OFFLINE' ? 'disconnected' : 
                            connectionStatus || 'unknown';
        
        console.log(`📊 [UNIFIED] Status obtido: ${connectionStatus} → ${mappedStatus}`);
        
        // Atualizar estado local
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            instanceId,
            status: mappedStatus,
            phoneNumber: ownerJid,
            lastUpdated: Date.now()
          }
        }));
        
        // Sincronizar com banco
        await whatsappInstancesService.updateInstanceStatus(instanceId, mappedStatus, {
          phone_number: ownerJid,
          updated_at: new Date().toISOString()
        });
        
        console.log(`✅ [UNIFIED] Status sincronizado para ${instanceId}`);
        
        // Se conectado, parar polling
        if (mappedStatus === 'connected') {
          stopPollingForInstance(instanceId);
          
          toast({
            title: "✅ WhatsApp Conectado!",
            description: `Conectado com sucesso: ${ownerJid}`,
          });
        }
      }
      
    } catch (error) {
      console.error(`❌ [UNIFIED] Erro ao atualizar status de ${instanceId}:`, error);
      throw error;
    }
  }, [toast]);

  // ============ CONECTAR INSTÂNCIA - REST-FIRST ============
  const connectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [UNIFIED] Conectando via CodeChat API v1.3.3: ${instanceId}`);
      
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

      // ============ ETAPA 1: CONECTAR VIA CODECHAT API ============
      console.log(`📡 [UNIFIED] Iniciando conexão via CodeChat REST API`);
      
      const connectResponse = await codechatQRService.connectInstance(instanceId);
      
      if (connectResponse.success) {
        console.log(`✅ [UNIFIED] Conexão iniciada com sucesso`);
        
        // ============ ETAPA 2: BUSCAR QR CODE ============
        const qrResponse = await codechatQRService.getQRCode(instanceId);
        
        if (qrResponse.success && qrResponse.qrCode) {
          console.log(`✅ [UNIFIED] QR Code obtido com sucesso`);
          
          // Atualizar estado com QR Code
          setInstances(prev => ({
            ...prev,
            [instanceId]: {
              ...prev[instanceId],
              status: 'qr_ready',
              qrCode: qrResponse.qrCode,
              hasQrCode: true,
              lastUpdated: Date.now()
            }
          }));
          
          // Sincronizar com banco
          await whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready', {
            qr_code: qrResponse.qrCode,
            has_qr_code: true,
            updated_at: new Date().toISOString()
          });
          
          toast({
            title: "✅ QR Code Disponível!",
            description: "Escaneie o QR Code para conectar ao WhatsApp",
          });
          
          // ============ ETAPA 3: INICIAR POLLING PARA STATUS ============
          startPollingForInstance(instanceId);
          console.log(`🔄 [UNIFIED] Polling iniciado para ${instanceId}`);
          
          return;
        }
      }
      
      throw new Error('Falha na conexão via CodeChat API');
      
    } catch (error: any) {
      console.error(`❌ [UNIFIED] Erro ao conectar ${instanceId}:`, error);
      
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
        description: error.message || "Falha ao conectar instância",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [toast, startPollingForInstance]);

  // ============ DESCONECTAR INSTÂNCIA ============
  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🔌 [UNIFIED] Desconectando instância: ${instanceId}`);
      
      // Parar polling
      stopPollingForInstance(instanceId);
      
      // Tentar desconectar via CodeChat API
      try {
        const disconnectResponse = await codechatQRService.disconnectInstance(instanceId);
        if (disconnectResponse.success) {
          console.log(`✅ [UNIFIED] Desconectado via CodeChat API`);
        } else {
          console.warn(`⚠️ [UNIFIED] CodeChat disconnect falhou:`, disconnectResponse.error);
        }
      } catch (error) {
        console.warn(`⚠️ [UNIFIED] Erro na API disconnect:`, error);
      }
      
      // Atualizar estado local
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

      // Sincronizar com banco
      await whatsappInstancesService.updateInstanceStatus(instanceId, 'disconnected', {
        qr_code: null,
        has_qr_code: false,
        phone_number: null,
        updated_at: new Date().toISOString()
      });

      toast({
        title: "Desconectado",
        description: "Instância desconectada com sucesso",
      });
      
    } catch (error: any) {
      console.error(`❌ [UNIFIED] Erro ao desconectar ${instanceId}:`, error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar instância",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  }, [toast, stopPollingForInstance]);

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
    console.log(`🧹 [UNIFIED] Limpando instância: ${instanceId}`);
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
    jwtConfigured,
    connectInstance,
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    cleanup,
    refreshStatus,
    startPollingForInstance,
    stopPollingForInstance
  };
};