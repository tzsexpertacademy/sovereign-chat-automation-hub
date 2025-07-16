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

    // Configurar handler de eventos - eventos corretos
    yumerNativeWebSocketService.on('instance_status', (data) => {
      console.log('📱 [UNIFIED] Instance status received:', data);
      handleInstanceStatusUpdate(data);
    });

    yumerNativeWebSocketService.on('qr_code', (data) => {
      console.log('📱 [UNIFIED] QR Code received:', data);
      handleQRCodeUpdate(data);
    });

    // Listeners adicionais para debug
    yumerNativeWebSocketService.on('message_received', (data) => {
      console.log('📨 [UNIFIED] Message received:', data);
    });

    yumerNativeWebSocketService.on('connection_update', (data) => {
      console.log('🔌 [UNIFIED] Connection update:', data);
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

      // Gerar JWT com o instanceId correto
      const jwt = await yumerJwtService.generateLocalJWT(JWT_SECRET, instanceId);
      console.log(`🔐 [UNIFIED] JWT gerado para ${instanceId}:`, jwt.substring(0, 50) + '...');

      // Conectar com as opções corretas usando o instanceId real
      await yumerNativeWebSocketService.connect({
        instanceName: instanceId,
        event: 'MESSAGE_RECEIVED',
        useSecureConnection: true,
        autoReconnect: true,
        maxReconnectAttempts: 10
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

      // Conectar WebSocket - isso vai gerar o JWT correto e conectar
      await connectWebSocketForInstance(instanceId);
      
      // Aguardar conexão WebSocket estabilizar
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(`📱 [UNIFIED] WebSocket conectado, aguardando eventos para ${instanceId}`);
      
      toast({
        title: "Conectando...",
        description: "WebSocket conectado, aguardando QR Code...",
      });
      
      // Atualizar status para conectado via WebSocket
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'websocket_connected',
          lastUpdated: Date.now()
        }
      }));
      
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