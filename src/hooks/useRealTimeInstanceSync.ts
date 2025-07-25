import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import unifiedYumerService from '@/services/unifiedYumerService';
import { useToast } from '@/hooks/use-toast';

interface RealTimeInstanceSyncOptions {
  onInstanceUpdate?: (instanceId: string, data: any) => void;
  enableWebhookConfig?: boolean;
  intervalMs?: number;
}

export const useRealTimeInstanceSync = (options: RealTimeInstanceSyncOptions = {}) => {
  const { onInstanceUpdate, enableWebhookConfig = true, intervalMs = 5000 } = options;
  const [isActive, setIsActive] = useState(false);
  const { toast } = useToast();

  // ============ SYNC COM API YUMER ============
  const syncWithYumerAPI = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [REAL-TIME-SYNC] Verificando ${instanceId} na API Yumer`);
      
      // Buscar business_id da instância
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select('business_business_id')
        .eq('instance_id', instanceId)
        .single();

      if (!instanceData) {
        console.error(`❌ [REAL-TIME-SYNC] Instância ${instanceId} não encontrada no banco`);
        return;
      }

      // Buscar token do cliente
      const { data: clientData } = await supabase
        .from('clients')
        .select('business_token')
        .eq('business_id', instanceData.business_business_id)
        .single();

      if (!clientData?.business_token) {
        console.error(`❌ [REAL-TIME-SYNC] Token não encontrado para business ${instanceData.business_business_id}`);
        return;
      }
      
      // Verificar status na API Yumer
      const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${instanceId}`, {
        headers: {
          'Authorization': `Bearer ${clientData.business_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📊 [REAL-TIME-SYNC] Status API: ${data.state}/${data.connection}`);

        let newStatus = 'disconnected';
        let phoneNumber = null;
        let isConnected = false;

        // Mapear status da API para nosso sistema
        if (data.state === 'active' && data.connection === 'open') {
          newStatus = 'connected';
          isConnected = true;
          phoneNumber = data.WhatsApp?.ownerJid || null;
          console.log(`✅ [REAL-TIME-SYNC] Instância conectada: ${instanceId}, phone: ${phoneNumber}`);
        } else if (data.state === 'active' && data.connection === 'close') {
          newStatus = 'qr_ready';
          console.log(`🔶 [REAL-TIME-SYNC] Instância aguardando QR: ${instanceId}`);
        } else {
          console.log(`⚠️ [REAL-TIME-SYNC] Status não mapeado: state=${data.state}, connection=${data.connection}`);
        }

        // Atualizar banco de dados
        const { error } = await supabase
          .from('whatsapp_instances')
          .update({
            status: newStatus,
            connection_state: data.connection,
            phone_number: phoneNumber,
            updated_at: new Date().toISOString()
          })
          .eq('instance_id', instanceId);

        if (error) {
          console.error(`❌ [REAL-TIME-SYNC] Erro ao atualizar banco:`, error);
          return;
        }

        // Configurar webhook se conectado
        if (isConnected && enableWebhookConfig) {
          try {
            const webhookResult = await unifiedYumerService.ensureWebhookConfigured(instanceId);
            if (webhookResult.success) {
              console.log(`✅ [REAL-TIME-SYNC] Webhook configurado: ${instanceId}`);
            }
          } catch (webhookError) {
            console.warn(`⚠️ [REAL-TIME-SYNC] Erro ao configurar webhook:`, webhookError);
          }
        }

        // Notificar mudança
        onInstanceUpdate?.(instanceId, {
          status: newStatus,
          connection_state: data.connection,
          phone_number: phoneNumber,
          isConnected
        });

        console.log(`✅ [REAL-TIME-SYNC] Sincronizado: ${instanceId} → ${newStatus}`);
      }
    } catch (error) {
      console.error(`❌ [REAL-TIME-SYNC] Erro ao sincronizar ${instanceId}:`, error);
    }
  }, [onInstanceUpdate, enableWebhookConfig]);

  // ============ LISTENER DE MUDANÇAS NO BANCO ============
  useEffect(() => {
    if (!isActive) return;

    console.log('🚀 [REAL-TIME-SYNC] Iniciando listener de mudanças');

    const channel = supabase
      .channel('instance_realtime_sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_instances'
        },
        (payload) => {
          const newData = payload.new as any;
          console.log(`📡 [REAL-TIME-SYNC] Mudança detectada:`, {
            instance: newData.instance_id,
            status: newData.status,
            webhook: newData.webhook_enabled
          });

          // Se foi conectado, verificar API novamente em 2 segundos
          if (newData.status === 'connected') {
            setTimeout(() => {
              syncWithYumerAPI(newData.instance_id);
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 [REAL-TIME-SYNC] Removendo listener');
      supabase.removeChannel(channel);
    };
  }, [isActive, syncWithYumerAPI]);

  // ============ POLLING INTELIGENTE ============
  useEffect(() => {
    if (!isActive) return;

    console.log(`⏰ [REAL-TIME-SYNC] Iniciando polling a cada ${intervalMs}ms`);

    const interval = setInterval(async () => {
      try {
        // Buscar instâncias que precisam de sync
        const { data: instances } = await supabase
          .from('whatsapp_instances')
          .select('instance_id, status')
          .in('status', ['connecting', 'qr_ready']);

        if (instances && instances.length > 0) {
          console.log(`🔄 [REAL-TIME-SYNC] Sincronizando ${instances.length} instâncias`);
          
          for (const instance of instances) {
            await syncWithYumerAPI(instance.instance_id);
          }
        }
      } catch (error) {
        console.error('❌ [REAL-TIME-SYNC] Erro no polling:', error);
      }
    }, intervalMs);

    return () => {
      console.log('⏹️ [REAL-TIME-SYNC] Parando polling');
      clearInterval(interval);
    };
  }, [isActive, intervalMs, syncWithYumerAPI]);

  // ============ CONTROLES ============
  const startSync = useCallback(() => {
    console.log('🚀 [REAL-TIME-SYNC] Ativando sync em tempo real');
    setIsActive(true);
  }, []);

  const stopSync = useCallback(() => {
    console.log('⏹️ [REAL-TIME-SYNC] Desativando sync em tempo real');
    setIsActive(false);
  }, []);

  const manualSync = useCallback(async (instanceId: string) => {
    await syncWithYumerAPI(instanceId);
  }, [syncWithYumerAPI]);

  return {
    isActive,
    startSync,
    stopSync,
    manualSync
  };
};