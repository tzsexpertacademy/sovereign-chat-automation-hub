import { useState, useEffect, useCallback } from 'react';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { codechatQRService } from '@/services/codechatQRService';
import { webhookQRService } from '@/services/webhookQRService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

  // ============ VERIFICAR QR CODE NO BANCO ============
  const checkDatabaseForQRCode = useCallback(async (instanceId: string): Promise<{ qrCode?: string; hasQrCode: boolean }> => {
    try {
      console.log(`🔍 [UNIFIED-DB] Verificando QR Code no banco: ${instanceId}`);
      
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('qr_code, has_qr_code, qr_expires_at')
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
          return { qrCode: data.qr_code, hasQrCode: true };
        } else {
          console.log(`⏰ [UNIFIED-DB] QR Code expirado no banco`);
        }
      }
      
      console.log(`📭 [UNIFIED-DB] Nenhum QR Code válido no banco`);
      return { hasQrCode: false };
      
    } catch (error) {
      console.error(`❌ [UNIFIED-DB] Erro ao verificar banco:`, error);
      return { hasQrCode: false };
    }
  }, []);

  // ============ ATUALIZAR STATUS VIA REST API + BANCO ============
  const refreshStatus = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [UNIFIED] Verificando status: ${instanceId}`);
      
      // 1. Verificar QR Code no banco primeiro
      const dbQrCheck = await checkDatabaseForQRCode(instanceId);
      
      // 2. Buscar status do CodeChat
      const statusData = await codechatQRService.getInstanceStatus(instanceId);
      console.log(`📊 [UNIFIED] Status response:`, statusData);
      
      let mappedStatus = 'disconnected';
      let phoneNumber = undefined;
      let qrCode = dbQrCheck.qrCode;
      let hasQrCode = dbQrCheck.hasQrCode;
      
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
        
        // Se está conectando e temos QR code no banco, usar status qr_ready
        if (hasQrCode && qrCode) {
          mappedStatus = 'qr_ready';
        }
      } else if (statusData.state === 'close') {
        mappedStatus = 'disconnected';
      }
      
      console.log(`📊 [UNIFIED] Status processado: ${statusData.state} → ${mappedStatus} (QR: ${hasQrCode})`);
      
      // Atualizar estado local
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          instanceId,
          status: mappedStatus,
          phoneNumber: phoneNumber,
          qrCode: qrCode,
          hasQrCode: hasQrCode,
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
  }, [toast, stopPollingForInstance, checkDatabaseForQRCode]);

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

      // ============ ETAPA 1.5: CONFIGURAR WEBHOOK ============
      console.log(`🔧 [UNIFIED] Etapa 1.5/5: Configurando webhook automático`);
      
      const webhookResult = await codechatQRService.configureWebhook(instanceId);
      if (webhookResult.success) {
        console.log(`✅ [UNIFIED] Webhook configurado com sucesso`);
      } else {
        console.warn(`⚠️ [UNIFIED] Falha no webhook (continuando):`, webhookResult.error);
      }

      // ============ ETAPA 2: CONECTAR E GERAR QR CODE ============
      console.log(`📡 [UNIFIED] Etapa 2/5: Conectando via /instance/connect`);
      
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
      console.log(`📱 [UNIFIED] Etapa 3/5: Verificando QR Code imediato`);
      
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
      
      // ============ ETAPA 4: AGUARDAR WEBHOOK ============
      console.log(`📡 [UNIFIED] Etapa 4/5: Aguardando QR Code via webhook...`);
      
      setInstances(prev => ({
        ...prev,
        [instanceId]: {
          ...prev[instanceId],
          status: 'waiting_qr',
          hasQrCode: false,
          lastUpdated: Date.now()
        }
      }));
      
      // ============ ETAPA 5: POLLING DO BANCO + FALLBACK ============
      console.log(`🔄 [UNIFIED] Etapa 5/5: Iniciando polling do banco + fallback`);
      
      // Polling do banco para detectar QR Code salvo pelo webhook
      let attempts = 0;
      const maxAttempts = 30; // 30 tentativas = 90 segundos
      const pollInterval = 3000; // 3 segundos
      
      const bankPollingInterval = setInterval(async () => {
        attempts++;
        console.log(`🔍 [UNIFIED-POLL] Tentativa ${attempts}/${maxAttempts} - verificando banco`);
        
        try {
          const dbQrCheck = await checkDatabaseForQRCode(instanceId);
          
          if (dbQrCheck.hasQrCode && dbQrCheck.qrCode) {
            console.log(`🎉 [UNIFIED-POLL] QR Code encontrado no banco!`);
            
            clearInterval(bankPollingInterval);
            
            setInstances(prev => ({
              ...prev,
              [instanceId]: {
                ...prev[instanceId],
                status: 'qr_ready',
                qrCode: dbQrCheck.qrCode,
                hasQrCode: true,
                lastUpdated: Date.now()
              }
            }));
            
            toast({
              title: "📱 QR Code Pronto!",
              description: "QR Code recebido via webhook",
            });
            
            // Iniciar polling para status final
            startPollingForInstance(instanceId);
            return;
          }
          
          // Se passou do tempo limite, tentar fallback
          if (attempts >= maxAttempts) {
            console.warn(`⏰ [UNIFIED-POLL] Timeout atingido - tentando fallback REST`);
            clearInterval(bankPollingInterval);
            
            // Fallback: tentar buscar QR Code via REST API
            try {
              const qrResponse = await codechatQRService.getQRCode(instanceId);
              if (qrResponse.success && qrResponse.qrCode) {
                console.log(`✅ [UNIFIED-FALLBACK] QR Code obtido via REST`);
                
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
                
                // Salvar no banco
                await whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready', {
                  has_qr_code: true,
                  qr_code: qrResponse.qrCode,
                  updated_at: new Date().toISOString()
                });
                
                toast({
                  title: "📱 QR Code Pronto!",
                  description: "QR Code obtido via fallback",
                });
                
                startPollingForInstance(instanceId);
              } else {
                throw new Error('Timeout: QR Code não gerado');
              }
            } catch (fallbackError) {
              console.error(`❌ [UNIFIED-FALLBACK] Falha no fallback:`, fallbackError);
              
              setInstances(prev => ({
                ...prev,
                [instanceId]: {
                  ...prev[instanceId],
                  status: 'error',
                  lastUpdated: Date.now()
                }
              }));
              
              toast({
                title: "Timeout",
                description: "QR Code não foi gerado. Tente novamente.",
                variant: "destructive",
              });
            }
          }
          
        } catch (error) {
          console.error(`❌ [UNIFIED-POLL] Erro no polling:`, error);
        }
      }, pollInterval);
      
      toast({
        title: "⏳ Aguardando QR Code",
        description: "Sistema híbrido webhook + polling ativado...",
      });
      
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