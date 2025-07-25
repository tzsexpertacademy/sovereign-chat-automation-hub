
import { useState, useEffect, useCallback } from 'react';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { codechatQRService } from '@/services/codechatQRService';
import { webhookQRService } from '@/services/webhookQRService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useInstanceSync } from '@/hooks/useInstanceSync';
import { useRetryWithBackoff } from '@/hooks/useRetryWithBackoff';

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
  serverOnline: boolean;
  connectInstance: (instanceId: string) => Promise<void>;
  disconnectInstance: (instanceId: string) => Promise<void>;
  getInstanceStatus: (instanceId: string) => InstanceStatus;
  isLoading: (instanceId: string) => boolean;
  cleanup: (instanceId: string) => void;
  refreshStatus: (instanceId: string) => Promise<void>;
  startPollingForInstance: (instanceId: string) => void;
  stopPollingForInstance: (instanceId: string) => void;
}

export const useUnifiedInstanceManager = (initialInstances?: any[]): UseUnifiedInstanceManagerReturn => {
  const [instances, setInstances] = useState<Record<string, InstanceStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [serverOnline, setServerOnline] = useState(true);
  const { toast } = useToast();

  // ============ INICIALIZAÇÃO COM DADOS EXISTENTES ============
  useEffect(() => {
    if (initialInstances && initialInstances.length > 0) {
      console.log(`🔄 [UNIFIED] Inicializando com ${initialInstances.length} instâncias`);
      
      const initialState: Record<string, InstanceStatus> = {};
      initialInstances.forEach(instance => {
        initialState[instance.instance_id] = {
          instanceId: instance.instance_id,
          status: instance.status || 'disconnected',
          phoneNumber: instance.phone_number,
          qrCode: instance.has_qr_code ? instance.qr_code : undefined,
          hasQrCode: instance.has_qr_code || false,
          lastUpdated: Date.now()
        };
      });
      
      setInstances(initialState);
    }
  }, [initialInstances]);

  // ============ SYNC REALTIME APENAS QUANDO NECESSÁRIO ============
  const { manualSync } = useInstanceSync({
    onQRCodeUpdate: (instanceId, qrCode) => {
      console.log(`📱 [UNIFIED-SYNC] QR Code recebido via sync: ${instanceId}`);
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          instanceId,
          status: 'qr_ready',
          qrCode,
          hasQrCode: true,
          lastUpdated: Date.now()
        }
      }));
    },
    onInstanceUpdate: (instanceId, status) => {
      console.log(`📊 [UNIFIED-SYNC] Status atualizado via sync: ${instanceId} → ${status}`);
      setInstances(prev => {
        const current = prev[instanceId];
        
        if (status === 'connected') {
          console.log(`🎯 [UNIFIED-SYNC] Conectado detectado - parando polling: ${instanceId}`);
          stopPollingForInstance(instanceId);
          return {
            ...prev,
            [instanceId]: {
              ...current,
              instanceId,
              status: 'connected',
              qrCode: undefined,
              hasQrCode: false,
              lastUpdated: Date.now()
            }
          };
        }
        
        return {
          ...prev,
          [instanceId]: {
            ...current,
            instanceId,
            status,
            lastUpdated: Date.now()
          }
        };
      });
    },
    enabled: true
  });

  // ============ VERIFICAR STATUS DO SERVIDOR ============
  const checkServerOnline = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://yumer.yumerflow.app:8083/', { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const isOnline = response.ok;
      setServerOnline(isOnline);
      return isOnline;
    } catch (error) {
      console.warn('⚠️ [UNIFIED] Servidor offline detectado');
      setServerOnline(false);
      return false;
    }
  }, []);

  // ============ POLLING INTELIGENTE - APENAS QUANDO NECESSÁRIO ============
  const pollingIntervals = useState<Map<string, NodeJS.Timeout>>(new Map())[0];
  
  const startPollingForInstance = useCallback((instanceId: string) => {
    // Não iniciar polling se já existe ou servidor offline
    if (pollingIntervals.has(instanceId)) {
      console.log(`⚠️ [UNIFIED] Polling já ativo para ${instanceId}`);
      return;
    }

    if (!serverOnline) {
      console.log(`⚠️ [UNIFIED] Servidor offline - não iniciando polling para ${instanceId}`);
      return;
    }
    
    console.log(`🔄 [UNIFIED] Iniciando polling INTELIGENTE para ${instanceId}`);
    
    let pollCount = 0;
    const maxPolls = 36; // 3 minutos máximo (36 * 5s)
    
    const interval = setInterval(async () => {
      pollCount++;
      
      try {
        // Verificar se servidor ainda está online
        const isOnline = await checkServerOnline();
        if (!isOnline) {
          console.log(`🔌 [UNIFIED] Servidor offline - parando polling: ${instanceId}`);
          stopPollingForInstance(instanceId);
          return;
        }

        await refreshStatus(instanceId);
        
        // Verificar se chegou a um estado final
        const currentStatus = instances[instanceId]?.status;
        if (currentStatus === 'connected' || currentStatus === 'disconnected') {
          console.log(`✅ [UNIFIED] Estado final atingido (${currentStatus}) - parando polling: ${instanceId}`);
          stopPollingForInstance(instanceId);
          return;
        }

        // Parar por timeout
        if (pollCount >= maxPolls) {
          console.log(`⏰ [UNIFIED] Timeout de polling atingido - parando: ${instanceId}`);
          stopPollingForInstance(instanceId);
        }
        
      } catch (error) {
        console.error(`❌ [UNIFIED] Erro no polling de ${instanceId}:`, error);
        // Parar em caso de erro persistente
        if (pollCount > 5) {
          stopPollingForInstance(instanceId);
        }
      }
    }, 5000);
    
    pollingIntervals.set(instanceId, interval);
  }, [serverOnline, instances]);
  
  const stopPollingForInstance = useCallback((instanceId: string) => {
    const interval = pollingIntervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.delete(instanceId);
      console.log(`⏹️ [UNIFIED] Polling interrompido para ${instanceId}`);
    }
  }, []);

  // ============ VERIFICAR QR CODE NO BANCO - SEM EXCESSOS ============
  const checkDatabaseForQRCode = useCallback(async (instanceId: string): Promise<{ qrCode?: string; hasQrCode: boolean; status?: string; phoneNumber?: string }> => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('qr_code, has_qr_code, qr_expires_at, status, phone_number')
        .eq('instance_id', instanceId)
        .maybeSingle();
      
      if (error) {
        console.error(`❌ [UNIFIED-DB] Erro ao buscar no banco:`, error);
        return { hasQrCode: false };
      }
      
      if (!data) {
        return { hasQrCode: false };
      }
      
      // PRIORIDADE 1: Status connected
      if (data.status === 'connected' && data.phone_number) {
        return { 
          hasQrCode: false, 
          status: 'connected',
          phoneNumber: data.phone_number
        };
      }
      
      // PRIORIDADE 2: QR Code válido (não expirado)
      if (data.has_qr_code && data.qr_code && data.qr_expires_at) {
        const expiresAt = new Date(data.qr_expires_at);
        const now = new Date();
        
        if (now < expiresAt) {
          return { 
            qrCode: data.qr_code, 
            hasQrCode: true, 
            status: data.status 
          };
        } else {
          // QR expirado - limpar silenciosamente
          await supabase
            .from('whatsapp_instances')
            .update({
              qr_code: null,
              has_qr_code: false,
              qr_expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('instance_id', instanceId);
        }
      }
      
      return { hasQrCode: false, status: data.status, phoneNumber: data.phone_number };
      
    } catch (error) {
      console.error(`❌ [UNIFIED-DB] Erro ao verificar banco:`, error);
      return { hasQrCode: false };
    }
  }, []);

  // ============ REFRESH STATUS - SEM LOOPS ============
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      // Verificar servidor online primeiro
      const isOnline = await checkServerOnline();
      if (!isOnline) {
        console.log(`🔌 [UNIFIED] Servidor offline - não verificando status: ${instanceId}`);
        return;
      }

      // 1. Verificar banco primeiro
      const dbCheck = await checkDatabaseForQRCode(instanceId);
      
      // Se conectado no banco, usar isso
      if (dbCheck.status === 'connected' && dbCheck.phoneNumber) {
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            instanceId,
            status: 'connected',
            phoneNumber: dbCheck.phoneNumber,
            qrCode: undefined,
            hasQrCode: false,
            lastUpdated: Date.now()
          }
        }));
        
        // Parar polling se conectado
        stopPollingForInstance(instanceId);
        return;
      }
      
      // Se QR válido no banco, usar isso
      if (dbCheck.hasQrCode && dbCheck.qrCode) {
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            instanceId,
            status: 'qr_ready',
            qrCode: dbCheck.qrCode,
            hasQrCode: true,
            lastUpdated: Date.now()
          }
        }));
        return;
      }
      
      // 2. Verificar API apenas se necessário
      let statusData;
      try {
        statusData = await codechatQRService.getInstanceStatus(instanceId);
      } catch (error) {
        if (error.message?.includes('404')) {
          setInstances(prev => {
            const newInstances = { ...prev };
            delete newInstances[instanceId];
            return newInstances;
          });
          stopPollingForInstance(instanceId);
          return;
        }
        throw error;
      }
      
      let mappedStatus = 'disconnected';
      let phoneNumber = undefined;
      
      if (statusData.state === 'open') {
        mappedStatus = 'connected';
        try {
          const details = await codechatQRService.getInstanceDetails(instanceId);
          phoneNumber = details.ownerJid;
        } catch (error) {
          console.warn(`⚠️ [UNIFIED] Não foi possível buscar número:`, error);
        }
      } else if (statusData.state === 'connecting') {
        mappedStatus = 'connecting';
      }
      
      // Atualizar estado
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          instanceId,
          status: mappedStatus,
          phoneNumber: phoneNumber,
          qrCode: undefined,
          hasQrCode: false,
          lastUpdated: Date.now()
        }
      }));
      
      // Sincronizar com banco
      await whatsappInstancesService.updateInstanceStatus(instanceId, mappedStatus, {
        phone_number: phoneNumber,
        updated_at: new Date().toISOString()
      });
      
      // Parar polling se chegou a estado final
      if (mappedStatus === 'connected' || mappedStatus === 'disconnected') {
        stopPollingForInstance(instanceId);
        
        if (mappedStatus === 'connected') {
          toast({
            title: "✅ WhatsApp Conectado!",
            description: `Conectado com sucesso${phoneNumber ? `: ${phoneNumber}` : ''}`,
          });
        }
      }
      
    } catch (error) {
      console.error(`❌ [UNIFIED] Erro ao verificar status de ${instanceId}:`, error);
      throw error;
    }
  }, [toast, stopPollingForInstance, checkDatabaseForQRCode, checkServerOnline]);

  // ============ CONECTAR INSTÂNCIA - SEM LOOPS ============
  const connectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [UNIFIED] Conectando instância: ${instanceId}`);
      
      // Verificar se servidor está online
      const isOnline = await checkServerOnline();
      if (!isOnline) {
        throw new Error('Servidor WhatsApp está offline');
      }
      
      // PRIMEIRO: Verificar se já está conectada via API
      try {
        const statusData = await codechatQRService.getInstanceStatus(instanceId);
        if (statusData.state === 'open') {
          console.log(`✅ [UNIFIED] Instância já está conectada: ${instanceId}`);
          
          try {
            const details = await codechatQRService.getInstanceDetails(instanceId);
            const phoneNumber = details.ownerJid;
            
            setInstances(prev => ({
              ...prev,
              [instanceId]: {
                instanceId,
                status: 'connected',
                phoneNumber,
                hasQrCode: false,
                lastUpdated: Date.now()
              }
            }));

            // Atualizar banco
            await whatsappInstancesService.updateInstanceStatus(instanceId, 'connected', {
              phone_number: phoneNumber,
              updated_at: new Date().toISOString()
            });

            toast({
              title: "✅ WhatsApp já Conectado!",
              description: `WhatsApp já estava conectado${phoneNumber ? `: ${phoneNumber}` : ''}`,
            });
            
            return;
          } catch (detailsError) {
            console.warn(`⚠️ [UNIFIED] Erro ao buscar detalhes:`, detailsError);
            
            setInstances(prev => ({
              ...prev,
              [instanceId]: {
                instanceId,
                status: 'connected',
                hasQrCode: false,
                lastUpdated: Date.now()
              }
            }));

            toast({
              title: "✅ WhatsApp já Conectado!",
              description: "WhatsApp já estava conectado",
            });
            
            return;
          }
        }
      } catch (statusError) {
        console.log(`🔍 [UNIFIED] Instância não conectada, prosseguindo com conexão...`);
      }
      
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

      // Conectar via API
      const connectResult = await codechatQRService.connectInstance(instanceId);
      
      if (connectResult?.base64) {
        console.log(`🎯 [UNIFIED] QR Code obtido diretamente!`);
        
        // Salvar no banco com expiração
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 3);
        
        await whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready', {
          qr_code: connectResult.base64,
          has_qr_code: true,
          qr_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        });
        
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
        
        // Iniciar polling apenas para detectar scan
        startPollingForInstance(instanceId);
        return;
      }

      // Fallback - aguardar QR
      console.log(`⏳ [UNIFIED] Aguardando QR Code...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const qrResult = await codechatQRService.getQRCodeSimple(instanceId);
      
      if (qrResult.success && qrResult.qrCode) {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 3);
        
        await whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready', {
          qr_code: qrResult.qrCode,
          has_qr_code: true,
          qr_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        });
        
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
        
        startPollingForInstance(instanceId);
        return;
      }

      throw new Error('QR Code não disponível após tentativas');
      
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
  }, [toast, startPollingForInstance, checkServerOnline]);

  // ============ DESCONECTAR INSTÂNCIA ============
  const disconnectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🔌 [UNIFIED] Desconectando instância: ${instanceId}`);
      
      // Parar polling
      stopPollingForInstance(instanceId);
      
      // Desconectar via API
      try {
        const disconnectResponse = await codechatQRService.disconnectInstance(instanceId);
        if (disconnectResponse.success) {
          console.log(`✅ [UNIFIED] Desconectado via API`);
        }
      } catch (error) {
        console.warn(`⚠️ [UNIFIED] Erro na API disconnect:`, error);
      }
      
      // Atualizar estado
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

  // ============ INICIALIZAÇÃO SIMPLES ============
  useEffect(() => {
    console.log('🔧 [UNIFIED] Inicializando Instance Manager OTIMIZADO');
    console.log('📡 [UNIFIED] Sem loops infinitos - Polling apenas quando necessário');
    
    // Verificar servidor inicial
    checkServerOnline();
    
    // Cleanup na desmontagem
    return () => {
      console.log('🧹 [UNIFIED] Cleanup do manager');
      pollingIntervals.forEach((interval, instanceId) => {
        clearInterval(interval);
        console.log(`⏹️ [UNIFIED] Parando polling: ${instanceId}`);
      });
      pollingIntervals.clear();
      webhookQRService.cleanup();
    };
  }, [checkServerOnline]);

  // ============ FUNÇÕES AUXILIARES ============
  const getInstanceStatus = useCallback((instanceId: string): InstanceStatus => {
    return instances[instanceId] || { instanceId, status: 'disconnected' };
  }, [instances]);

  const isLoading = useCallback((instanceId: string): boolean => {
    return loading[instanceId] || false;
  }, [loading]);

  const cleanup = useCallback((instanceId: string) => {
    console.log(`🧹 [UNIFIED] Limpando instância: ${instanceId}`);
    
    stopPollingForInstance(instanceId);
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
    serverOnline,
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
