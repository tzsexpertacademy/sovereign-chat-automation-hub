import { useState, useEffect, useCallback } from 'react';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { codechatQRService } from '@/services/codechatQRService';
import { webhookQRService } from '@/services/webhookQRService';
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
      // Cleanup global do webhook service
      webhookQRService.cleanup();
    };
  }, []);

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

  // ============ ATUALIZAR STATUS VIA REST API - SIMPLIFICADO ============
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [UNIFIED] Verificando status: ${instanceId}`);
      
      const statusData = await codechatQRService.getInstanceStatus(instanceId);
      console.log(`📊 [UNIFIED] Status response:`, statusData);
      
      let mappedStatus = 'disconnected';
      let phoneNumber = undefined;
      
      // Mapear estados do CodeChat
      if (statusData.state === 'open') {
        mappedStatus = 'connected';
        
        // Buscar número do telefone
        try {
          const details = await codechatQRService.getInstanceDetails(instanceId);
          phoneNumber = details.ownerJid;
        } catch (error) {
          console.warn(`⚠️ [UNIFIED] Não foi possível buscar número:`, error);
        }
      } else if (statusData.state === 'connecting') {
        mappedStatus = 'connecting';
      } else if (statusData.state === 'close') {
        mappedStatus = 'disconnected';
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
      
      console.log(`✅ [UNIFIED] Status sincronizado: ${instanceId} → ${mappedStatus}`);
      
      // Se conectado, parar polling e notificar
      if (mappedStatus === 'connected') {
        stopPollingForInstance(instanceId);
        
        toast({
          title: "✅ WhatsApp Conectado!",
          description: `Conectado com sucesso${phoneNumber ? `: ${phoneNumber}` : ''}`,
        });
      }
      
      // Se desconectado, parar polling
      if (mappedStatus === 'disconnected') {
        stopPollingForInstance(instanceId);
      }
      
    } catch (error) {
      console.error(`❌ [UNIFIED] Erro ao verificar status de ${instanceId}:`, error);
      
      if (error.message?.includes('404')) {
        console.log(`📋 [UNIFIED] Instância ${instanceId} não encontrada`);
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            instanceId,
            status: 'not_found',
            lastUpdated: Date.now()
          }
        }));
        stopPollingForInstance(instanceId);
      }
      
      throw error;
    }
  }, [toast, stopPollingForInstance]);

  // ============ CONECTAR INSTÂNCIA - FLUXO CORRIGIDO: CHECK → CREATE/SKIP → CONNECT → QR → POLLING ============
  const connectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [UNIFIED] INICIANDO CONEXÃO CORRETA: ${instanceId}`);
      
      // Status inicial
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          instanceId,
          status: 'checking',
          hasQrCode: false,
          lastUpdated: Date.now()
        }
      }));

      // ============ ETAPA 0: VERIFICAR SE INSTÂNCIA JÁ EXISTE ============
      console.log(`🔍 [UNIFIED] Etapa 0/4: Verificando se instância existe`);
      
      const existsCheck = await codechatQRService.checkInstanceExists(instanceId);
      
      if (existsCheck.exists) {
        console.log(`✅ [UNIFIED] Instância já existe - pulando criação`);
        
        // Se já existe e está conectada, não precisamos fazer nada
        if (existsCheck.status === 'open') {
          console.log(`🎉 [UNIFIED] Instância já está conectada!`);
          await refreshStatus(instanceId);
          return;
        }
      } else {
        console.log(`📝 [UNIFIED] Instância não existe - criando...`);
        
        // ============ ETAPA 1: CRIAR INSTÂNCIA (SE NÃO EXISTIR) ============
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            status: 'creating',
            lastUpdated: Date.now()
          }
        }));
        
        const createResponse = await codechatQRService.createInstance(instanceId, `Instance: ${instanceId}`);
        
        if (!createResponse.success && createResponse.status !== 'already_exists') {
          throw new Error(`Falha ao criar instância: ${createResponse.error}`);
        }
        
        console.log(`✅ [UNIFIED] Instância ${createResponse.success && createResponse.status === 'created' ? 'criada' : 'verificada'}`);
      }

      // ============ ETAPA 2: CONECTAR E GERAR QR CODE ============
      console.log(`📡 [UNIFIED] Etapa 2/4: Conectando via /instance/connect`);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'connecting',
          lastUpdated: Date.now()
        }
      }));
      
      const connectResponse = await codechatQRService.connectInstance(instanceId);
      
      if (!connectResponse.success) {
        throw new Error(`Falha na conexão: ${connectResponse.error}`);
      }
      
      console.log(`✅ [UNIFIED] Connect executado com sucesso`);
      
      // ============ ETAPA 3: VERIFICAR QR CODE IMEDIATO ============
      console.log(`📱 [UNIFIED] Etapa 3/4: Verificando QR Code imediato`);
      
      if (connectResponse.qrCode) {
        console.log(`📱 [UNIFIED] ✅ QR CODE RECEBIDO DIRETAMENTE!`);
        
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
        
        // Salvar no banco
        await whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready', {
          has_qr_code: true,
          qr_code: connectResponse.qrCode,
          updated_at: new Date().toISOString()
        });
        
        toast({
          title: "📱 QR Code Pronto!",
          description: "Escaneie o QR Code para conectar o WhatsApp",
        });
        
        // Iniciar polling para detectar quando usuário escanear
        startPollingForInstance(instanceId);
        return;
      }
      
      // ============ ETAPA 4: POLLING PARA QR CODE ============
      console.log(`⏳ [UNIFIED] Etapa 4/4: QR Code não retornado, iniciando polling...`);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'waiting_qr',
          hasQrCode: false,
          lastUpdated: Date.now()
        }
      }));
      
      // ============ SISTEMA WEBHOOK + FALLBACK POLLING ============
      console.log(`📊 [UNIFIED] Configurando webhook e fallback para QR Code`);
      
      // Configurar listener de webhook
      const qrCodeListener = (qrData: any) => {
        console.log(`🎯 [UNIFIED] QR Code recebido via ${qrData.source}!`);
        
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            status: 'qr_ready',
            qrCode: qrData.qrCode,
            hasQrCode: true,
            lastUpdated: Date.now()
          }
        }));
        
        whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready', {
          has_qr_code: true,
          qr_code: qrData.qrCode,
          updated_at: new Date().toISOString()
        });
        
        toast({
          title: "📱 QR Code Pronto!",
          description: `QR Code recebido via ${qrData.source === 'webhook' ? 'webhook' : 'polling'}`,
        });
      };
      
      // Adicionar listener
      webhookQRService.addQRCodeListener(instanceId, qrCodeListener);
      
      // Verificar se já temos QR Code
      const existingQR = webhookQRService.getQRCode(instanceId);
      if (existingQR) {
        console.log(`✅ [UNIFIED] QR Code já disponível`);
        qrCodeListener(existingQR);
        return;
      }
      
      // Iniciar fallback polling
      webhookQRService.startFallbackPolling(instanceId, codechatQRService, 30);
      
      toast({
        title: "⏳ Aguardando QR Code",
        description: "Configurando webhook e iniciando fallback...",
      });
      
      // Iniciar polling para status final
      startPollingForInstance(instanceId);
      
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
  }, [toast, startPollingForInstance, refreshStatus]);

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
    
    // Limpar webhook service
    webhookQRService.clearQRCode(instanceId);
    
    setInstances(prev => {
      const newInstances = { ...prev };
      delete newInstances[instanceId];
      return newInstances;
    });
  }, [stopPollingForInstance]);

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