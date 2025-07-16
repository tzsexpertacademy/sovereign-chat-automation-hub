import { useState, useEffect, useCallback } from 'react';
import { yumerNativeWebSocketService } from '@/services/yumerNativeWebSocketService';
import { yumerJwtService } from '@/services/yumerJwtService';
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
  jwtConfigured: boolean;
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

  // Conectar Native WebSocket uma única vez
  useEffect(() => {
    if (!jwtConfigured) {
      console.log('⚠️ [UNIFIED] JWT não configurado, aguardando...');
      return;
    }

    console.log('🔧 [UNIFIED] Inicializando Native WebSocket Manager');
    
    // Configurar handlers de status
    yumerNativeWebSocketService.onStatus((status) => {
      console.log(`🔌 [UNIFIED] WebSocket Status: ${status}`);
      setWebsocketConnected(status === 'connected');
    });

    // Configurar handler de eventos
    yumerNativeWebSocketService.on('instance_status', (data) => {
      console.log('📱 [UNIFIED] Instance status received:', data);
      handleInstanceStatusUpdate(data);
    });

    yumerNativeWebSocketService.on('qr_code', (data) => {
      console.log('📱 [UNIFIED] QR Code received:', data);
      handleQRCodeUpdate(data);
    });

    return () => {
      console.log('🧹 [UNIFIED] Limpando Native WebSocket');
      yumerNativeWebSocketService.disconnect();
    };
  }, [jwtConfigured]);

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

  // Conectar ao WebSocket para uma instância específica
  const connectWebSocketForInstance = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔌 [UNIFIED] Conectando WebSocket para: ${instanceId}`);
      
      // Verificar se já está conectado
      if (yumerNativeWebSocketService.isConnected()) {
        console.log('✅ [UNIFIED] WebSocket já conectado, reutilizando conexão');
        return;
      }

      // Conectar com as opções corretas
      await yumerNativeWebSocketService.connect({
        instanceName: instanceId,
        event: 'instance_status',
        useSecureConnection: true,
        autoReconnect: true,
        maxReconnectAttempts: 5
      });

      console.log(`✅ [UNIFIED] WebSocket conectado para ${instanceId}`);
    } catch (error) {
      console.error(`❌ [UNIFIED] Erro ao conectar WebSocket:`, error);
      throw error;
    }
  }, []);

  // Buscar status atual de uma instância via API direta
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [UNIFIED] Buscando status atual: ${instanceId}`);
      
      // Para simular refresh, vamos atualizar o timestamp
      setInstances(prev => {
        if (prev[instanceId]) {
          return {
            ...prev,
            [instanceId]: {
              ...prev[instanceId],
              lastUpdated: Date.now()
            }
          };
        }
        return prev;
      });
      
      console.log(`📊 [UNIFIED] Status atualizado para ${instanceId}`);
    } catch (error) {
      console.error(`❌ [UNIFIED] Erro ao buscar status ${instanceId}:`, error);
      throw error;
    }
  }, []);

  // Conectar instância
  const connectInstance = useCallback(async (instanceId: string) => {
    if (!jwtConfigured) {
      toast({
        title: "Configuração Necessária",
        description: "JWT não configurado. Verifique as configurações.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [UNIFIED] Conectando instância: ${instanceId}`);
      
      // Definir status como connecting
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: 'connecting',
          hasQrCode: false,
          lastUpdated: Date.now()
        }
      }));

      // Conectar WebSocket se necessário
      await connectWebSocketForInstance(instanceId);
      
      // Aguardar um momento para estabilizar a conexão
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simular processo de conexão (substituir por chamada real à API)
      console.log(`📱 [UNIFIED] Iniciando processo de conexão para ${instanceId}`);
      
      toast({
        title: "Conectando...",
        description: "Aguarde o QR Code aparecer",
      });
      
      // Simular QR Code após 3 segundos
      setTimeout(() => {
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            status: 'qr_ready',
            hasQrCode: true,
            qrCode: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`,
            lastUpdated: Date.now()
          }
        }));
        
        toast({
          title: "📱 QR Code Disponível!",
          description: "Escaneie o QR Code para conectar",
        });
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao conectar:', error);
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
  }, [jwtConfigured, connectWebSocketForInstance, toast]);

  // Desconectar instância
  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🔌 [UNIFIED] Desconectando instância: ${instanceId}`);
      
      // Atualizar status local
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

      // Sync com banco de dados
      await whatsappInstancesService.updateInstanceStatus(instanceId, 'disconnected');

      toast({
        title: "Desconectado",
        description: "Instância desconectada com sucesso",
      });
      
    } catch (error: any) {
      console.error('❌ [UNIFIED] Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar instância",
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
    refreshStatus
  };
};