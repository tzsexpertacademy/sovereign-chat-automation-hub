import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Webhook, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import unifiedYumerService from '@/services/unifiedYumerService';

interface WebhookStatusIndicatorProps {
  instanceId: string;
  className?: string;
}

export const WebhookStatusIndicator: React.FC<WebhookStatusIndicatorProps> = ({
  instanceId,
  className = ''
}) => {
  const [webhookStatus, setWebhookStatus] = useState<'unknown' | 'configured' | 'error'>('unknown');
  const [isChecking, setIsChecking] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const { toast } = useToast();

  const checkWebhookStatus = async () => {
    if (!instanceId) return;
    
    setIsChecking(true);
    try {
      console.log(`🔍 [WEBHOOK-STATUS] Verificando webhook: ${instanceId}`);
      
      const result = await unifiedYumerService.getWebhookConfig(instanceId);
      
      if (result.success && result.data?.enabled) {
        setWebhookStatus('configured');
        console.log(`✅ [WEBHOOK-STATUS] Webhook configurado: ${instanceId}`);
      } else {
        setWebhookStatus('error');
        console.warn(`⚠️ [WEBHOOK-STATUS] Webhook não configurado: ${instanceId}`);
      }
    } catch (error) {
      console.error(`❌ [WEBHOOK-STATUS] Erro ao verificar webhook:`, error);
      setWebhookStatus('error');
    } finally {
      setIsChecking(false);
    }
  };

  const configureWebhook = async () => {
    if (!instanceId) return;
    
    setIsConfiguring(true);
    try {
      console.log(`🔧 [WEBHOOK-STATUS] Configurando webhook manualmente: ${instanceId}`);
      
      // Forçar reconfiguração
      const result = await unifiedYumerService.configureWebhook(instanceId);
      
      if (result.success) {
        setWebhookStatus('configured');
        toast({
          title: "✅ Webhook Configurado",
          description: "Webhook configurado com sucesso! Envie uma mensagem de teste no WhatsApp para verificar.",
          duration: 6000,
        });
        console.log(`✅ [WEBHOOK-STATUS] Webhook configurado com sucesso: ${instanceId}`);
        
        // Verificar novamente após configurar
        setTimeout(() => checkWebhookStatus(), 2000);
      } else {
        setWebhookStatus('error');
        toast({
          title: "❌ Erro no Webhook",
          description: `Falha ao configurar webhook: ${result.error}`,
          variant: "destructive"
        });
        console.error(`❌ [WEBHOOK-STATUS] Falha ao configurar webhook:`, result.error);
      }
    } catch (error) {
      console.error(`❌ [WEBHOOK-STATUS] Erro ao configurar webhook:`, error);
      setWebhookStatus('error');
      toast({
        title: "❌ Erro no Webhook",
        description: "Erro interno ao configurar webhook",
        variant: "destructive"
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  // Auto-configurar webhook se instância está conectada mas webhook não está ativo
  const autoConfigureWebhook = async () => {
    if (!instanceId) return;

    try {
      // Verificar se instância está conectada
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('status, webhook_enabled')
        .eq('instance_id', instanceId)
        .single();

      if (instance?.status === 'connected' && !instance?.webhook_enabled) {
        console.log(`🔧 [AUTO-WEBHOOK] Configurando automaticamente para instância conectada: ${instanceId}`);
        await configureWebhook();
      }
    } catch (error) {
      console.error(`❌ [AUTO-WEBHOOK] Erro na verificação automática:`, error);
    }
  };

  useEffect(() => {
    if (instanceId) {
      checkWebhookStatus();
      autoConfigureWebhook(); // Configurar automaticamente se necessário
      
      // Verificar periodicamente
      const interval = setInterval(() => {
        checkWebhookStatus();
        autoConfigureWebhook();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [instanceId]);

  const getStatusBadge = () => {
    switch (webhookStatus) {
      case 'configured':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <Webhook className="h-3 w-3 mr-1" />
            Webhook OK
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Webhook OFF
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            <RefreshCw className={`h-3 w-3 mr-1 ${isChecking ? 'animate-spin' : ''}`} />
            Verificando...
          </Badge>
        );
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {getStatusBadge()}
      
      {webhookStatus === 'error' && (
        <Button
          size="sm"
          variant="outline"
          onClick={configureWebhook}
          disabled={isConfiguring}
          className="h-6 px-2 text-xs"
        >
          {isConfiguring ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Webhook className="h-3 w-3 mr-1" />
              Configurar
            </>
          )}
        </Button>
      )}
      
      <Button
        size="sm"
        variant="ghost"
        onClick={checkWebhookStatus}
        disabled={isChecking}
        className="h-6 w-6 p-0"
      >
        <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
};