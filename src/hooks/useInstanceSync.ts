import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { useToast } from '@/hooks/use-toast';

interface InstanceSyncOptions {
  onInstanceUpdate?: (instanceId: string, status: string) => void;
  onQRCodeUpdate?: (instanceId: string, qrCode: string) => void;
  enabled?: boolean;
}

export const useInstanceSync = (options: InstanceSyncOptions = {}) => {
  const { toast } = useToast();
  const { onInstanceUpdate, onQRCodeUpdate, enabled = true } = options;

  // ============ REALTIME SYNC DO BANCO ============
  const setupRealtimeSync = useCallback(() => {
    if (!enabled) return;

    console.log('🔄 [SYNC] Configurando sync realtime do banco');

    const channel = supabase
      .channel('whatsapp_instances_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_instances'
        },
        (payload) => {
          console.log('📡 [SYNC] Update realtime recebido:', payload);
          
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          // QR Code foi atualizado
          if (newRecord.has_qr_code && newRecord.qr_code && !oldRecord.has_qr_code) {
            console.log('📱 [SYNC] QR Code detectado via realtime!');
            onQRCodeUpdate?.(newRecord.instance_id, newRecord.qr_code);
            
            toast({
              title: "📱 QR Code Atualizado",
              description: "QR Code recebido via webhook em tempo real",
            });
          }
          
          // Status foi atualizado
          if (newRecord.status !== oldRecord.status) {
            console.log(`📊 [SYNC] Status mudou: ${oldRecord.status} → ${newRecord.status}`);
            onInstanceUpdate?.(newRecord.instance_id, newRecord.status);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 [SYNC] Limpando sync realtime');
      supabase.removeChannel(channel);
    };
  }, [enabled, onInstanceUpdate, onQRCodeUpdate, toast]);

  // ============ SYNC PERIÓDICO DE SEGURANÇA ============
  const setupPeriodicSync = useCallback(() => {
    if (!enabled) return;

    console.log('⏰ [SYNC] Configurando sync periódico de segurança');

    const interval = setInterval(async () => {
      try {
        // Buscar instâncias que podem ter QR codes não sincronizados
        const { data: instances, error } = await supabase
          .from('whatsapp_instances')
          .select('instance_id, status, has_qr_code, qr_code, qr_expires_at')
          .eq('has_qr_code', true)
          .not('qr_code', 'is', null)
          .gte('qr_expires_at', new Date().toISOString());

        if (error) {
          console.error('❌ [SYNC] Erro no sync periódico:', error);
          return;
        }

        if (instances && instances.length > 0) {
          console.log(`🔍 [SYNC] Encontradas ${instances.length} instâncias com QR válido`);
          
          instances.forEach(instance => {
            onQRCodeUpdate?.(instance.instance_id, instance.qr_code);
            onInstanceUpdate?.(instance.instance_id, instance.status);
          });
        }
      } catch (error) {
        console.error('❌ [SYNC] Erro no sync periódico:', error);
      }
    }, 30000); // A cada 30 segundos

    return () => {
      console.log('🧹 [SYNC] Limpando sync periódico');
      clearInterval(interval);
    };
  }, [enabled, onInstanceUpdate, onQRCodeUpdate]);

  // ============ CONFIGURAR SYNCS ============
  useEffect(() => {
    if (!enabled) return;

    const cleanupRealtime = setupRealtimeSync();
    const cleanupPeriodic = setupPeriodicSync();

    return () => {
      cleanupRealtime?.();
      cleanupPeriodic?.();
    };
  }, [setupRealtimeSync, setupPeriodicSync, enabled]);

  // ============ SYNC MANUAL ============
  const manualSync = useCallback(async (instanceId: string) => {
    try {
      console.log(`🔄 [SYNC] Sync manual para ${instanceId}`);
      
      const { data: instance, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (error) {
        console.error('❌ [SYNC] Erro no sync manual:', error);
        return false;
      }

      if (!instance) {
        console.warn('⚠️ [SYNC] Instância não encontrada no banco');
        return false;
      }

      // Verificar QR Code válido
      if (instance.has_qr_code && instance.qr_code && instance.qr_expires_at) {
        const expiresAt = new Date(instance.qr_expires_at);
        const now = new Date();
        
        if (now < expiresAt) {
          console.log('✅ [SYNC] QR Code válido encontrado no sync manual');
          onQRCodeUpdate?.(instance.instance_id, instance.qr_code);
          onInstanceUpdate?.(instance.instance_id, instance.status);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ [SYNC] Erro no sync manual:', error);
      return false;
    }
  }, [onInstanceUpdate, onQRCodeUpdate]);

  return {
    manualSync
  };
};