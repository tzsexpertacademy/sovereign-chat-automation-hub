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

interface UseUnifiedInstanceManagerReturn {
  instances: Record<string, InstanceStatus>;
  loading: Record<string, boolean>;
  restMode: boolean;
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
  const { toast } = useToast();

  // ============ REST-ONLY INITIALIZATION ============
  useEffect(() => {
    console.log('🔧 [UNIFIED] Inicializando REST-only Instance Manager');
    console.log('📡 [UNIFIED] CodeChat API v1.3.3 - 100% REST Polling');
    
    return () => {
      console.log('🧹 [UNIFIED] Cleanup do manager');
    };
  }, []);

  // ============ QR CODE VIA REST ============
  const qrCodeAttempts = useState<Record<string, number>>({})[0];
  const MAX_QR_ATTEMPTS = 10;
  
  const fetchQRCodeViaRest = useCallback(async (instanceId: string) => {
    // Verificar se já excedeu tentativas
    const currentAttempts = qrCodeAttempts[instanceId] || 0;
    if (currentAttempts >= MAX_QR_ATTEMPTS) {
      console.log(`⏰ [UNIFIED] Timeout: máximo de tentativas de QR Code atingido para ${instanceId}`);
      return false;
    }
    
    qrCodeAttempts[instanceId] = currentAttempts + 1;
    try {
      console.log(`📸 [UNIFIED] Buscando QR Code via fetchInstance: ${instanceId}`);
      
      // Usar fetchInstance para obter detalhes completos incluindo QR Code
      const instanceDetails = await codechatQRService.getInstanceDetails(instanceId);
      
      console.log(`🔍 [UNIFIED] Estrutura completa da resposta fetchInstance:`, JSON.stringify(instanceDetails, null, 2));
      
      // Extrair QR Code de possíveis campos
      const qrCode = instanceDetails?.qrCode || 
                   instanceDetails?.base64 || 
                   instanceDetails?.code ||
                   instanceDetails?.Whatsapp?.qrCode ||
                   instanceDetails?.Whatsapp?.base64 ||
                   instanceDetails?.qr_code ||
                   instanceDetails?.instance?.qrCode ||
                   instanceDetails?.instance?.base64;
      
      if (qrCode) {
        console.log(`✅ [UNIFIED] QR Code encontrado via fetchInstance: ${instanceId}`);
        
        // Resetar contador de tentativas quando encontra QR Code
        qrCodeAttempts[instanceId] = 0;
        
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            instanceId,
            status: 'qr_ready',
            qrCode: qrCode,
            hasQrCode: true,
            lastUpdated: Date.now()
          }
        }));

        toast({
          title: "📱 QR Code Disponível!",
          description: "Escaneie para conectar via WhatsApp",
        });
        
        return true;
      } else {
        console.log(`⏳ [UNIFIED] QR Code ainda não disponível via fetchInstance: ${instanceId} (tentativa ${qrCodeAttempts[instanceId]}/${MAX_QR_ATTEMPTS})`);
        
        // Se chegou no limite, notificar usuário
        if (qrCodeAttempts[instanceId] >= MAX_QR_ATTEMPTS) {
          toast({
            title: "⏰ Timeout QR Code",
            description: "QR Code não foi gerado após várias tentativas. Tente reconectar.",
            variant: "destructive",
          });
        }
        
        return false;
      }
      
    } catch (error) {
      console.error(`❌ [UNIFIED] Erro ao buscar QR Code via fetchInstance:`, error);
      return false;
    }
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
      const statusData = await codechatQRService.getInstanceStatus(instanceId);
      
      console.log(`📊 [UNIFIED] Status response:`, statusData);
      
      // Estrutura da resposta: { state: 'open'|'close', statusReason: 200|400 }
      let mappedStatus = 'disconnected';
      let phoneNumber = undefined;
      
      if (statusData.state) {
        mappedStatus = statusData.state === 'open' ? 'connected' : 
                     statusData.state === 'close' ? 'disconnected' : 
                     statusData.state === 'connecting' ? 'connecting' : 
                     'unknown';
      }
      
      // Se ainda está conectando, tentar buscar QR Code via fetchInstance
      if (mappedStatus === 'connecting') {
        console.log(`🔍 [UNIFIED] Status "connecting" - verificando QR Code via fetchInstance...`);
        await fetchQRCodeViaRest(instanceId);
      }
      
      // Se instância foi fechada ou está com status 'close', parar polling e limpar
      if (mappedStatus === 'disconnected' && statusData.state === 'close') {
        console.log(`🔄 [UNIFIED] Instância com status 'close' - parando polling: ${instanceId}`);
        stopPollingForInstance(instanceId);
        
        // Aguardar um pouco antes de limpar para dar tempo de outras operações
        setTimeout(() => {
          console.log(`🧹 [UNIFIED] Limpando instância desconectada: ${instanceId}`);
          cleanup(instanceId);
        }, 5000);
      }
      
      // Tentar buscar detalhes completos da instância se conectada
      if (mappedStatus === 'connected') {
        try {
          const details = await codechatQRService.getInstanceDetails(instanceId);
          if (details.ownerJid) {
            phoneNumber = details.ownerJid;
          }
        } catch (error) {
          console.warn(`⚠️ [UNIFIED] Não foi possível buscar detalhes da instância:`, error);
        }
      }
      
      console.log(`📊 [UNIFIED] Status processado: ${statusData.state} → ${mappedStatus}`);
      
      // Atualizar estado local
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          instanceId,
          status: mappedStatus,
          phoneNumber: phoneNumber,
          lastUpdated: Date.now()
        }
      }));
      
      // Sincronizar com banco
      await whatsappInstancesService.updateInstanceStatus(instanceId, mappedStatus, {
        phone_number: phoneNumber,
        updated_at: new Date().toISOString()
      });
      
      console.log(`✅ [UNIFIED] Status sincronizado para ${instanceId}: ${mappedStatus}`);
      
      // Se conectado, parar polling e notificar sucesso
      if (mappedStatus === 'connected') {
        stopPollingForInstance(instanceId);
        
        toast({
          title: "✅ WhatsApp Conectado!",
          description: `Conectado com sucesso${phoneNumber ? `: ${phoneNumber}` : ''}`,
        });
      }
      
    } catch (error) {
      console.error(`❌ [UNIFIED] Erro ao atualizar status de ${instanceId}:`, error);
      
      // Em caso de erro 404, a instância não existe
      if (error.message?.includes('404')) {
        console.log(`📋 [UNIFIED] Instância ${instanceId} não encontrada no servidor`);
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            instanceId,
            status: 'not_found',
            lastUpdated: Date.now()
          }
        }));
      }
      
      throw error;
    }
  }, [toast, stopPollingForInstance]);

  // ============ CONECTAR INSTÂNCIA - REST-FIRST COM CREATE → CONNECT ============
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

      // ============ ETAPA 1: CRIAR INSTÂNCIA PRIMEIRO ============
      console.log(`📝 [UNIFIED] Criando instância no servidor: ${instanceId}`);
      
      const createResponse = await codechatQRService.createInstance(instanceId, `Instance: ${instanceId}`);
      
      if (!createResponse.success) {
        if (createResponse.status === 'already_exists' || createResponse.error?.includes('already in use')) {
          console.log(`ℹ️ [UNIFIED] Instância já existe: ${instanceId}`);
        } else {
          throw new Error(`Falha ao criar instância: ${createResponse.error}`);
        }
      }
      
      if (createResponse.success) {
        console.log(`✅ [UNIFIED] Instância criada com sucesso`);
      } else if (createResponse.status === 'already_exists') {
        console.log(`ℹ️ [UNIFIED] Instância já existe, continuando...`);
      }

      // ============ ETAPA 2: CONECTAR VIA CODECHAT API ============
      console.log(`📡 [UNIFIED] Iniciando conexão via CodeChat REST API`);
      
      const connectResponse = await codechatQRService.connectInstance(instanceId);
      
      if (connectResponse.success) {
        console.log(`✅ [UNIFIED] Conexão iniciada com sucesso`);
        
        // Verificar se o connect retornou QR Code diretamente
        if (connectResponse.qrCode) {
          console.log(`📱 [UNIFIED] QR Code recebido diretamente do connect!`);
          
          setInstances(prev => ({
            ...prev,
            [instanceId]: {
              ...prev[instanceId],
              status: 'qr_ready',
              qrCode: connectResponse.qrCode,
              hasQrCode: true,
              lastUpdated: Date.now()
            }
          }));
          
          // Sincronizar com banco
          await whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready', {
            has_qr_code: true,
            qr_code: connectResponse.qrCode,
            updated_at: new Date().toISOString()
          });
          
          // ============ ETAPA 4: INICIAR POLLING PARA STATUS FINAL ============
          startPollingForInstance(instanceId);
          console.log(`🔄 [UNIFIED] Polling iniciado para ${instanceId}`);
          
          return;
        }
        
        // ============ ETAPA 3: INICIAR POLLING REST ============
        console.log(`🔄 [UNIFIED] Iniciando polling REST para ${instanceId}`);
        
        // Atualizar estado para "aguardando QR Code"
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            status: 'awaiting_qr',
            hasQrCode: false,
            lastUpdated: Date.now()
          }
        }));
        
        // Tentar buscar QR Code via polling
        const qrFound = await fetchQRCodeViaRest(instanceId);
        
        if (qrFound) {
          // Sincronizar com banco
          await whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready', {
            has_qr_code: true,
            updated_at: new Date().toISOString()
          });
          
          // ============ ETAPA 4: INICIAR POLLING PARA STATUS FINAL ============
          startPollingForInstance(instanceId);
          console.log(`🔄 [UNIFIED] Polling iniciado para ${instanceId}`);
          
          return;
        }
        
        // Se não encontrou QR Code, verificar se já está conectada
        const statusData = await codechatQRService.getInstanceStatus(instanceId);
        if (statusData.state === 'open') {
          console.log(`✅ [UNIFIED] Instância já conectada!`);
          
          setInstances(prev => ({
            ...prev,
            [instanceId]: {
              ...prev[instanceId],
              status: 'connected',
              hasQrCode: false,
              lastUpdated: Date.now()
            }
          }));
          
          toast({
            title: "✅ WhatsApp Conectado!",
            description: "Instância já conectada",
          });
          
          return;
        }
        
        // Se não está conectada e não tem QR Code, aguardar
        console.log(`⏳ [UNIFIED] QR Code ainda não disponível, continuando polling...`);
        startPollingForInstance(instanceId);
        return;
      }
      
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
  }, [toast, startPollingForInstance, fetchQRCodeViaRest]);

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
    
    // Parar polling se estiver ativo
    stopPollingForInstance(instanceId);
    
    // Limpar contador de tentativas de QR Code
    if (qrCodeAttempts[instanceId]) {
      delete qrCodeAttempts[instanceId];
    }
    
    setInstances(prev => {
      const newInstances = { ...prev };
      delete newInstances[instanceId];
      return newInstances;
    });
  }, []);

  return {
    instances,
    loading,
    restMode: true,
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