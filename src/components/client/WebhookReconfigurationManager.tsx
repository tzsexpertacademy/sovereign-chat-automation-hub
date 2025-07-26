import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import unifiedYumerService from '@/services/unifiedYumerService';

interface WebhookReconfigurationManagerProps {
  instanceId: string;
  clientId: string;
}

interface ReconfigStatus {
  step: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  message: string;
}

export const WebhookReconfigurationManager: React.FC<WebhookReconfigurationManagerProps> = ({
  instanceId,
  clientId
}) => {
  const [isReconfiguring, setIsReconfiguring] = useState(false);
  const [status, setStatus] = useState<ReconfigStatus[]>([]);
  const { toast } = useToast();

  const addStatus = (step: string, status: ReconfigStatus['status'], message: string) => {
    setStatus(prev => [...prev, { step, status, message }]);
  };

  const updateLastStatus = (status: ReconfigStatus['status'], message: string) => {
    setStatus(prev => {
      const newStatus = [...prev];
      if (newStatus.length > 0) {
        newStatus[newStatus.length - 1] = {
          ...newStatus[newStatus.length - 1],
          status,
          message
        };
      }
      return newStatus;
    });
  };

  const forceWebhookReconfiguration = async () => {
    setIsReconfiguring(true);
    setStatus([]);

    try {
      // Etapa 1: Verificar status atual
      addStatus('verification', 'processing', 'Verificando configuração atual...');
      
      const currentConfig = await unifiedYumerService.getWebhookConfig(instanceId);
      
      if (currentConfig.success && currentConfig.data) {
        const isOldWebhook = currentConfig.data.url.includes('yumer-unified-webhook');
        updateLastStatus('success', 
          isOldWebhook 
            ? 'Webhook antigo detectado - precisa reconfigurar'
            : 'Webhook já configurado corretamente'
        );
      } else {
        updateLastStatus('error', 'Erro ao verificar configuração atual');
      }

      // Etapa 2: Forçar nova configuração
      addStatus('configuration', 'processing', 'Reconfigurando webhook...');
      
      const reconfigResult = await unifiedYumerService.configureWebhook(instanceId);
      
      if (reconfigResult.success) {
        updateLastStatus('success', 'Webhook reconfigurado com sucesso');
      } else {
        updateLastStatus('error', `Erro na reconfiguração: ${reconfigResult.error}`);
        throw new Error(reconfigResult.error);
      }

      // Etapa 3: Verificar nova configuração
      addStatus('validation', 'processing', 'Validando nova configuração...');
      
      // Aguardar um pouco para a configuração ser aplicada
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newConfig = await unifiedYumerService.getWebhookConfig(instanceId);
      
      if (newConfig.success && newConfig.data) {
        const isCorrectWebhook = newConfig.data.url.includes('yumer-webhook');
        if (isCorrectWebhook) {
          updateLastStatus('success', 'Nova configuração validada com sucesso');
        } else {
          updateLastStatus('error', 'Configuração ainda incorreta após reconfiguração');
        }
      } else {
        updateLastStatus('error', 'Erro ao validar nova configuração');
      }

      // Etapa 4: Teste de conectividade
      addStatus('testing', 'processing', 'Testando conectividade...');
      
      const testResult = await unifiedYumerService.testConnection(instanceId);
      
      if (testResult.success) {
        updateLastStatus('success', 'Teste de conectividade bem-sucedido');
        
        toast({
          title: "✅ Webhook Reconfigurado",
          description: "Webhook reconfigurado com sucesso! Sistema funcionando normalmente.",
          variant: "default"
        });
      } else {
        updateLastStatus('error', `Erro no teste: ${testResult.error}`);
      }

    } catch (error) {
      console.error('❌ [WEBHOOK-RECONFIG] Erro na reconfiguração:', error);
      
      toast({
        title: "❌ Erro na Reconfiguração",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsReconfiguring(false);
    }
  };

  const getStatusIcon = (status: ReconfigStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: ReconfigStatus['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'processing':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Reconfiguração de Webhook
        </CardTitle>
        <CardDescription>
          Force a reconfiguração do webhook para corrigir problemas de conectividade
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong>Instância:</strong> {instanceId}
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Objetivo:</strong> Reconfigurar para yumer-webhook
          </p>
        </div>

        {status.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Progresso da Reconfiguração:</h4>
            {status.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 rounded-lg border">
                {getStatusIcon(item.status)}
                <Badge variant="outline" className={getStatusColor(item.status)}>
                  {item.step}
                </Badge>
                <span className="text-sm flex-1">{item.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={forceWebhookReconfiguration}
            disabled={isReconfiguring}
            className="flex-1"
          >
            {isReconfiguring ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Reconfigurando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Forçar Reconfiguração
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p><strong>ℹ️ O que este processo faz:</strong></p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Verifica a configuração atual do webhook</li>
            <li>Força uma nova configuração para yumer-webhook</li>
            <li>Valida se a mudança foi aplicada corretamente</li>
            <li>Testa a conectividade do novo webhook</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};