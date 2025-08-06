import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import unifiedYumerService from '@/services/unifiedYumerService';

interface AutoWebhookConfiguratorProps {
  instanceId: string;
  clientId: string;
}

export const AutoWebhookConfigurator: React.FC<AutoWebhookConfiguratorProps> = ({
  instanceId,
  clientId
}) => {
  const { toast } = useToast();

  const monitorAndConfigureWebhook = async () => {
    console.log('🚨 [EMERGENCY] AutoWebhookConfigurator DISABLED - preventing infinite loop');
    return; // DISABLED TEMPORARILY TO STOP INFINITE LOOP
    
    try {
      // Verificar status da instância
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('status, webhook_enabled, connection_state')
        .eq('instance_id', instanceId)
        .eq('client_id', clientId)
        .single();

      if (!instance) {
        console.warn(`⚠️ [AUTO-WEBHOOK] Instância não encontrada: ${instanceId}`);
        return;
      }

      console.log(`🔍 [AUTO-WEBHOOK] Status da instância ${instanceId}:`, {
        status: instance.status,
        webhook_enabled: instance.webhook_enabled,
        connection_state: instance.connection_state
      });

      // Se instância está conectada mas webhook não está configurado
      if (instance.status === 'connected' && !instance.webhook_enabled) {
        console.log(`🚀 [AUTO-WEBHOOK] Configurando webhook automaticamente para: ${instanceId}`);
        
        const result = await unifiedYumerService.ensureWebhookConfigured(instanceId);
        
        if (result.success) {
          console.log(`✅ [AUTO-WEBHOOK] Webhook configurado com sucesso: ${instanceId}`);
          
          toast({
            title: "🎉 Webhook Configurado",
            description: "Sistema pronto para receber mensagens! Agora você pode testar enviando uma mensagem para o WhatsApp.",
            duration: 5000,
          });
        } else {
          console.error(`❌ [AUTO-WEBHOOK] Falha ao configurar webhook:`, result.error);
          
          toast({
            title: "⚠️ Webhook Pendente",
            description: "Webhook não foi configurado automaticamente. Configure manualmente se necessário.",
            variant: "destructive",
            duration: 3000,
          });
        }
      }
    } catch (error) {
      console.error(`❌ [AUTO-WEBHOOK] Erro no monitoramento:`, error);
    }
  };

  useEffect(() => {
    if (instanceId && clientId) {
      // Configurar imediatamente
      monitorAndConfigureWebhook();
      
      // Verificar periodicamente (a cada 10 segundos)
      const interval = setInterval(monitorAndConfigureWebhook, 10000);
      
      return () => clearInterval(interval);
    }
  }, [instanceId, clientId]);

  // Componente invisível - só executa lógica
  return null;
};