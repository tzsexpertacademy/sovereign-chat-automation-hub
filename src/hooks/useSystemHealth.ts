
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { webhookConfigService } from '@/services/webhookConfigService';
import { incrementalImportService } from '@/services/incrementalImportService';
import { useToast } from '@/hooks/use-toast';

export interface SystemHealthStatus {
  webhook: {
    configured: boolean;
    working: boolean;
    lastCheck: Date | null;
  };
  realtime: {
    connected: boolean;
    lastMessage: Date | null;
  };
  import: {
    lastImport: Date | null;
    isRunning: boolean;
    errors: number;
  };
  overall: 'healthy' | 'degraded' | 'critical';
}

export const useSystemHealth = (clientId: string) => {
  const [status, setStatus] = useState<SystemHealthStatus>({
    webhook: { configured: false, working: false, lastCheck: null },
    realtime: { connected: false, lastMessage: null },
    import: { lastImport: null, isRunning: false, errors: 0 },
    overall: 'critical'
  });
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  // Verificar saúde do sistema
  const checkSystemHealth = useCallback(async () => {
    if (!clientId || isChecking) return;

    try {
      setIsChecking(true);
      console.log(`🏥 [HEALTH-CHECK] Verificando saúde do sistema para cliente: ${clientId}`);

      // Buscar instâncias do cliente
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, status, webhook_enabled, last_import_at')
        .eq('client_id', clientId);

      if (!instances || instances.length === 0) {
        console.log(`⚠️ [HEALTH-CHECK] Nenhuma instância encontrada`);
        setStatus(prev => ({
          ...prev,
          overall: 'critical'
        }));
        return;
      }

      const connectedInstances = instances.filter(i => i.status === 'connected');
      
      if (connectedInstances.length === 0) {
        console.log(`⚠️ [HEALTH-CHECK] Nenhuma instância conectada`);
        setStatus(prev => ({
          ...prev,
          overall: 'critical'
        }));
        return;
      }

      // Verificar webhook para primeira instância conectada
      const firstInstance = connectedInstances[0];
      const webhookVerification = await webhookConfigService.verifyWebhook(firstInstance.instance_id);
      
      // Verificar importação
      const importStatus = await incrementalImportService.getImportStatus(clientId);
      
      // Verificar mensagens recentes (últimos 5 minutos)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const { data: recentMessages } = await supabase
        .from('whatsapp_messages')
        .select('timestamp')
        .in('instance_id', connectedInstances.map(i => i.instance_id))
        .gte('timestamp', fiveMinutesAgo.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1);

      const lastMessageTime = recentMessages?.[0]?.timestamp 
        ? new Date(recentMessages[0].timestamp) 
        : null;

      // Determinar status geral
      let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
      
      if (!webhookVerification.isConfigured) {
        overall = 'critical';
      } else if (!lastMessageTime || Date.now() - lastMessageTime.getTime() > 10 * 60 * 1000) {
        overall = 'degraded';
      }

      const newStatus: SystemHealthStatus = {
        webhook: {
          configured: webhookVerification.isConfigured,
          working: webhookVerification.isConfigured && lastMessageTime !== null,
          lastCheck: new Date()
        },
        realtime: {
          connected: true, // Sempre true se chegou até aqui
          lastMessage: lastMessageTime
        },
        import: {
          lastImport: importStatus.lastImportAt || null,
          isRunning: importStatus.isImporting,
          errors: 0 // TODO: Implementar contagem de erros
        },
        overall
      };

      setStatus(newStatus);
      console.log(`✅ [HEALTH-CHECK] Status atualizado:`, overall);

    } catch (error) {
      console.error(`❌ [HEALTH-CHECK] Erro ao verificar saúde do sistema:`, error);
      setStatus(prev => ({
        ...prev,
        overall: 'critical'
      }));
    } finally {
      setIsChecking(false);
    }
  }, [clientId, isChecking]);

  // Auto-reparar sistema
  const autoRepairSystem = useCallback(async () => {
    if (!clientId) return;

    try {
      console.log(`🔧 [AUTO-REPAIR] Iniciando reparo automático do sistema`);
      
      toast({
        title: "🔧 Reparando Sistema",
        description: "Configurando webhook e sincronizando mensagens..."
      });

      // Buscar instâncias conectadas
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('instance_id')
        .eq('client_id', clientId)
        .eq('status', 'connected');

      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância conectada encontrada');
      }

      // Configurar webhook para todas as instâncias
      for (const instance of instances) {
        console.log(`🔧 [AUTO-REPAIR] Configurando webhook para: ${instance.instance_id}`);
        await webhookConfigService.ensureWebhookConfigured(instance.instance_id);
      }

      // Executar importação incremental
      console.log(`📥 [AUTO-REPAIR] Executando importação incremental`);
      await incrementalImportService.performImportWithRetry(clientId, 2);

      // Verificar saúde novamente
      await checkSystemHealth();

      toast({
        title: "✅ Sistema Reparado",
        description: "Webhook configurado e mensagens sincronizadas com sucesso"
      });

    } catch (error) {
      console.error(`❌ [AUTO-REPAIR] Erro no reparo automático:`, error);
      toast({
        title: "❌ Erro no Reparo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  }, [clientId, checkSystemHealth, toast]);

  // Executar verificação periódica
  useEffect(() => {
    if (!clientId) return;

    // Verificação inicial
    checkSystemHealth();

    // Verificação a cada 2 minutos
    const interval = setInterval(checkSystemHealth, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [clientId, checkSystemHealth]);

  return {
    status,
    isChecking,
    checkSystemHealth,
    autoRepairSystem
  };
};
