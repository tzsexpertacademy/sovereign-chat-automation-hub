
import { useState, useEffect, useCallback } from 'react';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { codechatQRService } from '@/services/codechatQRService';
import { webhookQRService } from '@/services/webhookQRService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useInstanceSync } from '@/hooks/useInstanceSync';
import { useRetryWithBackoff } from '@/hooks/useRetryWithBackoff';
import { instancesUnifiedService } from '@/services/instancesUnifiedService';

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
  const { retryWithBackoff } = useRetryWithBackoff();

  // ============ SYNC REALTIME DO BANCO ============
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
        
        // Se já temos QR code válido e o status é disconnected, manter qr_ready
        if (current?.hasQrCode && current?.qrCode && status === 'disconnected') {
          console.log(`🔒 [UNIFIED-SYNC] Preservando QR code válido para ${instanceId}`);
          return {
            ...prev,
            [instanceId]: {
              ...current,
              status: 'qr_ready',
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

  // ============ LIMPEZA AUTOMÁTICA DE INSTÂNCIAS ÓRFÃS ============
  const cleanupOrphanInstances = useCallback(async () => {
    console.log('🧹 [UNIFIED] Iniciando limpeza de instâncias órfãs...');
    
    try {
      const currentInstances = Object.keys(instances);
      const orphansToRemove: string[] = [];
      
      for (const instanceId of currentInstances) {
        try {
          // Verificar se instância existe no banco
          const dbInstance = await whatsappInstancesService.getInstanceByInstanceId(instanceId);
          
          if (!dbInstance) {
            console.log(`🗑️ [UNIFIED] Instância órfã detectada: ${instanceId}`);
            orphansToRemove.push(instanceId);
          }
        } catch (error) {
          console.warn(`⚠️ [UNIFIED] Erro ao verificar instância ${instanceId}:`, error);
          // Se erro 404 ou similar, também considerar órfã
          if (error.message?.includes('404') || error.message?.includes('not found')) {
            orphansToRemove.push(instanceId);
          }
        }
      }
      
      // Remover órfãs do estado local
      if (orphansToRemove.length > 0) {
        console.log(`🧹 [UNIFIED] Removendo ${orphansToRemove.length} instâncias órfãs do estado`);
        
        setInstances(prev => {
          const newInstances = { ...prev };
          orphansToRemove.forEach(instanceId => {
            delete newInstances[instanceId];
          });
          return newInstances;
        });
        
        setLoading(prev => {
          const newLoading = { ...prev };
          orphansToRemove.forEach(instanceId => {
            delete newLoading[instanceId];
          });
          return newLoading;
        });
        
        // Parar polling para órfãs
        orphansToRemove.forEach(instanceId => {
          stopPollingForInstance(instanceId);
        });
      }
      
    } catch (error) {
      console.error('❌ [UNIFIED] Erro na limpeza de órfãs:', error);
    }
  }, [instances]);

  // ============ REST-ONLY INITIALIZATION ============
  useEffect(() => {
    console.log('🔧 [UNIFIED] Inicializando REST-only Instance Manager');
    console.log('📡 [UNIFIED] CodeChat API v1.3.3 - 100% REST Polling');
    
    // Executar limpeza inicial após 5 segundos
    const cleanupTimeout = setTimeout(cleanupOrphanInstances, 5000);
    
    // Executar limpeza a cada 2 minutos
    const cleanupInterval = setInterval(cleanupOrphanInstances, 120000);
    
    return () => {
      console.log('🧹 [UNIFIED] Cleanup do manager');
      clearTimeout(cleanupTimeout);
      clearInterval(cleanupInterval);
      webhookQRService.cleanup();
    };
  }, [cleanupOrphanInstances]);

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
    }, 5000);
    
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

  // ============ VERIFICAR QR CODE NO BANCO - CORRIGIDO ============
  const checkDatabaseForQRCode = useCallback(async (instanceId: string): Promise<{ qrCode?: string; hasQrCode: boolean; status?: string }> => {
    try {
      console.log(`🔍 [UNIFIED-DB] Verificando QR Code no banco: ${instanceId}`);
      
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('qr_code, has_qr_code, qr_expires_at, status')
        .eq('instance_id', instanceId)
        .maybeSingle();
      
      if (error) {
        console.error(`❌ [UNIFIED-DB] Erro ao buscar no banco:`, error);
        return { hasQrCode: false };
      }
      
      if (!data) {
        console.log(`📋 [UNIFIED-DB] Instância não encontrada no banco: ${instanceId}`);
        return { hasQrCode: false };
      }
      
      // Verificar se QR Code ainda é válido
      if (data.has_qr_code && data.qr_code && data.qr_expires_at) {
        const expiresAt = new Date(data.qr_expires_at);
        const now = new Date();
        
        if (now < expiresAt) {
          console.log(`✅ [UNIFIED-DB] QR Code válido encontrado no banco!`);
          return { 
            qrCode: data.qr_code, 
            hasQrCode: true, 
            status: data.status 
          };
        } else {
          console.log(`⏰ [UNIFIED-DB] QR Code expirado no banco`);
        }
      }
      
      console.log(`📭 [UNIFIED-DB] Nenhum QR Code válido no banco`);
      return { hasQrCode: false, status: data.status };
      
    } catch (error) {
      console.error(`❌ [UNIFIED-DB] Erro ao verificar banco:`, error);
      return { hasQrCode: false };
    }
  }, []);

  // ============ ATUALIZAR STATUS VIA REST API + BANCO - CORRIGIDO ============
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [UNIFIED] Verificando status: ${instanceId}`);
      
      // 1. PRIMEIRA PRIORIDADE: Verificar QR Code no banco
      const dbQrCheck = await checkDatabaseForQRCode(instanceId);
      
      // Se encontrou QR válido no banco, usar imediatamente
      if (dbQrCheck.hasQrCode && dbQrCheck.qrCode) {
        console.log(`🎯 [UNIFIED] QR Code válido encontrado no banco - usando imediatamente!`);
        
        setInstances(prev => ({
          ...prev,
          [instanceId]: {
            ...prev[instanceId],
            instanceId,
            status: 'qr_ready',
            qrCode: dbQrCheck.qrCode,
            hasQrCode: true,
            lastUpdated: Date.now()
          }
        }));
        
        return; // Retornar imediatamente - não precisa consultar API
      }
      
      // 2. Se não tem QR no banco, verificar status na API
      let statusData;
      try {
        statusData = await codechatQRService.getInstanceStatus(instanceId);
        console.log(`📊 [UNIFIED] Status response:`, statusData);
      } catch (error) {
        if (error.message?.includes('404')) {
          console.log(`📋 [UNIFIED] Instância ${instanceId} não encontrada na API - removendo do estado`);
          
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
          qrCode: undefined, // Limpar QR se não tem no banco
          hasQrCode: false,
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
      throw error;
    }
  }, [toast, stopPollingForInstance, checkDatabaseForQRCode]);

  // ============ CONECTAR INSTÂNCIA - CORRIGIDA ============
  const connectInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(prev => ({ ...prev, [instanceId]: true }));
      console.log(`🚀 [UNIFIED] Conectando instância com padrão correto da API: ${instanceId}`);
      
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

      // ============ USAR LÓGICA QUE FUNCIONOU NO DIAGNÓSTICO ============
      console.log(`🔌 [UNIFIED] Conectando via codechatQRService.connectInstance...`);
      const connectResult = await codechatQRService.connectInstance(instanceId);
      
      console.log(`✅ [UNIFIED] Connect executado:`, connectResult);
      
      // CORREÇÃO CRÍTICA: API retorna {count, base64, code} e não {qrCode}
      if (connectResult?.base64) {
        console.log(`🎯 [UNIFIED] QR Code obtido DIRETAMENTE do connect!`);
        
        // Salvar QR Code no banco com expiração
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 3); // QR expira em 3 minutos
        
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
        
        // Iniciar polling para detectar quando usuário escanear
        startPollingForInstance(instanceId);
        return;
      }

      // FALLBACK: Se não veio no connect, aguardar e buscar
      console.log(`⏳ [UNIFIED] QR não veio no connect, aguardando 12s...`);
      await new Promise(resolve => setTimeout(resolve, 12000));
      
      const qrResult = await codechatQRService.getQRCodeSimple(instanceId);
      
      if (qrResult.success && qrResult.qrCode) {
        console.log(`✅ [UNIFIED] QR Code obtido via fetchInstance!`);
        
        // Salvar QR Code no banco
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

  // ============ OBTER STATUS DE INSTÂNCIA - CORRIGIDO PARA PRIORIZAR BANCO ============
  const getInstanceStatus = useCallback((instanceId: string): InstanceStatus => {
    const localStatus = instances[instanceId];
    
    console.log(`🔍 [UNIFIED-STATUS] Buscando status para ${instanceId}:`, {
      temStatusLocal: !!localStatus,
      statusLocal: localStatus?.status,
      hasQrCodeLocal: localStatus?.hasQrCode,
      qrCodeExists: !!localStatus?.qrCode
    });
    
    // Se não tem no estado local, retornar padrão
    if (!localStatus) {
      return { instanceId, status: 'disconnected' };
    }
    
    return localStatus;
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
