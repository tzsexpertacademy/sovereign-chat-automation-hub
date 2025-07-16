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

      // Conectar com evento correto para QR Code CodeChat
      await yumerNativeWebSocketService.connect({
        instanceName: instanceId,
        event: 'qrcode.updated', // Evento correto para CodeChat
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

  // Buscar status atual de uma instância via CodeChat API
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [UNIFIED] Buscando status atual via CodeChat API: ${instanceId}`);
      
      // Buscar status via CodeChat API REST
      const statusData = await codechatQRService.getInstanceStatus(instanceId);
      
      // Mapear resposta da API para nosso formato interno
      const mappedStatus = statusData.state === 'open' ? 'connected' : 
                          statusData.state === 'close' ? 'disconnected' : 
                          statusData.state || 'unknown';
      
      console.log(`📊 [UNIFIED] Status da API: ${statusData.state} → ${mappedStatus}`);
      
      // Atualizar status local
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          instanceId: instanceId,
          status: mappedStatus,
          lastUpdated: Date.now()
        }
      }));
      
      // Sincronizar com banco
      await whatsappInstancesService.updateInstanceStatus(instanceId, mappedStatus);
      
      console.log(`✅ [UNIFIED] Status atualizado para ${instanceId}: ${mappedStatus}`);
      
    } catch (error) {
      console.error(`❌ [UNIFIED] Erro ao buscar status ${instanceId}:`, error);
      
      // Manter o status atual em caso de erro
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
      
      throw error;
    }
  }, []);

  // Conectar instância - PRIORIZAR REST API CodeChat v1.3.3
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
      console.log(`🚀 [UNIFIED] Conectando instância via CodeChat API v1.3.3: ${instanceId}`);
      
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

      // ============ MÉTODO PRINCIPAL: REST API CodeChat ============
      console.log(`📡 [UNIFIED] Usando REST API como método principal`);
      
      try {
        const restResult = await codechatQRService.connectInstance(instanceId);
        
        if (restResult.success && restResult.qrCode) {
          console.log(`✅ [UNIFIED] Sucesso via REST API CodeChat!`);
          
          // Atualizar com QR Code obtido via REST
          setInstances(prev => ({
            ...prev,
            [instanceId]: {
              ...prev[instanceId],
              status: 'qr_ready',
              qrCode: restResult.qrCode,
              hasQrCode: true,
              lastUpdated: Date.now()
            }
          }));
          
          toast({
            title: "✅ QR Code Disponível!",
            description: "Conectado via CodeChat API - escaneie o QR Code",
          });

          // ============ OPCIONAL: WebSocket para eventos em tempo real ============
          try {
            console.log(`🔌 [UNIFIED] Conectando WebSocket para notificações...`);
            await connectWebSocketForInstance(instanceId);
            console.log(`✅ [UNIFIED] WebSocket opcional conectado para ${instanceId}`);
          } catch (wsError) {
            console.warn(`⚠️ [UNIFIED] WebSocket opcional falhou, mas REST funciona:`, wsError);
            // Não é erro crítico - REST API está funcionando
          }

          return; // Sucesso com REST API
        } else {
          throw new Error(`REST API não retornou QR Code: ${restResult.error}`);
        }
        
      } catch (restError) {
        console.error(`❌ [UNIFIED] REST API falhou:`, restError);
        
        // ============ FALLBACK: Tentar só WebSocket ============
        console.log(`🔄 [UNIFIED] Tentando fallback com WebSocket apenas...`);
        
        try {
          await connectWebSocketForInstance(instanceId);
          
          setInstances(prev => ({
            ...prev,
            [instanceId]: {
              ...prev[instanceId],
              status: 'websocket_connected',
              lastUpdated: Date.now()
            }
          }));
          
          toast({
            title: "WebSocket Conectado",
            description: "Aguardando QR Code via WebSocket...",
          });
          
        } catch (wsError) {
          throw new Error(`Tanto REST quanto WebSocket falharam. REST: ${restError.message}, WS: ${wsError.message}`);
        }
      }
      
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