import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, WifiOff, Settings, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { yumerWhatsappService } from '@/services/yumerWhatsappService';
import { serverConfigService } from '@/services/serverConfigService';

interface ConnectionDiagnosticsProps {
  instanceId: string | null;
  isVisible: boolean;
  onConfigureWebhook?: () => void;
}

interface DiagnosticResult {
  name: string;
  status: 'success' | 'warning' | 'error' | 'checking';
  message: string;
  details?: string;
}

const ConnectionDiagnostics = ({ instanceId, isVisible, onConfigureWebhook }: ConnectionDiagnosticsProps) => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const runDiagnostics = async () => {
    if (!instanceId) {
      setDiagnostics([{
        name: 'Instância',
        status: 'error',
        message: 'Nenhuma instância selecionada',
        details: 'Conecte ou selecione uma instância WhatsApp primeiro'
      }]);
      return;
    }

    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    // 1. Testar configuração do servidor
    results.push({
      name: 'Configuração do Servidor',
      status: 'checking',
      message: 'Verificando configuração...'
    });

    try {
      const config = serverConfigService.getConfig();
      const serverStatus = await serverConfigService.testConnection();
      
      if (serverStatus.isOnline) {
        results[0] = {
          name: 'Configuração do Servidor',
          status: 'success',
          message: `Conectado (${serverStatus.latency}ms)`,
          details: `URL: ${config.serverUrl}`
        };
      } else {
        results[0] = {
          name: 'Configuração do Servidor',
          status: 'error',
          message: 'Servidor offline',
          details: serverStatus.error || 'Falha na conexão'
        };
      }
    } catch (error) {
      results[0] = {
        name: 'Configuração do Servidor',
        status: 'error',
        message: 'Erro na configuração',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }

    // 2. Testar conexão da instância
    results.push({
      name: 'Conexão da Instância',
      status: 'checking',
      message: 'Testando conexão...'
    });

    try {
      const connectionResult = await yumerWhatsappService.testConnection(instanceId);
      
      if (connectionResult.success) {
        results[1] = {
          name: 'Conexão da Instância',
          status: 'success',
          message: 'Instância conectada',
          details: `ID: ${instanceId}`
        };
      } else {
        results[1] = {
          name: 'Conexão da Instância',
          status: 'error',
          message: 'Instância desconectada',
          details: connectionResult.error || 'Verifique se a instância está ativa'
        };
      }
    } catch (error) {
      results[1] = {
        name: 'Conexão da Instância',
        status: 'error',
        message: 'Erro ao testar conexão',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }

    // 3. Verificar configuração do webhook
    results.push({
      name: 'Configuração do Webhook',
      status: 'checking',
      message: 'Verificando webhook...'
    });

    try {
      const webhookResult = await yumerWhatsappService.getWebhookConfig(instanceId);
      
      if (webhookResult.success && webhookResult.data?.enabled) {
        const webhookUrl = webhookResult.data?.url || '';
        const hasCorrectUrl = webhookUrl.includes('supabase.co/functions/v1/');
        
        if (hasCorrectUrl) {
          results[2] = {
            name: 'Configuração do Webhook',
            status: 'success',
            message: 'Webhook configurado corretamente',
            details: `URL: ${webhookUrl}`
          };
        } else {
          results[2] = {
            name: 'Configuração do Webhook',
            status: 'warning',
            message: 'Webhook com URL incorreta',
            details: `URL atual: ${webhookUrl}`
          };
        }
      } else {
        results[2] = {
          name: 'Configuração do Webhook',
          status: 'error',
          message: 'Webhook não configurado',
          details: 'Webhook precisa ser configurado para receber mensagens'
        };
      }
    } catch (error) {
      results[2] = {
        name: 'Configuração do Webhook',
        status: 'error',
        message: 'Erro ao verificar webhook',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }

    // 4. Testar envio de mensagem (opcional)
    results.push({
      name: 'Capacidade de Envio',
      status: 'checking',
      message: 'Verificando capacidade de envio...'
    });

    try {
      // Não enviar mensagem real, apenas verificar se tudo está configurado
      const allPreviousOk = results.slice(0, 3).every(r => r.status === 'success');
      
      if (allPreviousOk) {
        results[3] = {
          name: 'Capacidade de Envio',
          status: 'success',
          message: 'Sistema pronto para envio',
          details: 'Todas as configurações estão corretas'
        };
      } else {
        results[3] = {
          name: 'Capacidade de Envio',
          status: 'warning',
          message: 'Problemas detectados',
          details: 'Corrija os problemas acima antes de enviar mensagens'
        };
      }
    } catch (error) {
      results[3] = {
        name: 'Capacidade de Envio',
        status: 'error',
        message: 'Erro no teste de envio',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }

    setDiagnostics(results);
    setLastCheck(new Date());
    setIsRunning(false);
  };

  const handleFixWebhook = async () => {
    if (!instanceId) return;

    try {
      setIsRunning(true);
      const result = await yumerWhatsappService.ensureWebhookConfigured(instanceId);
      
      if (result.success) {
        // Executar diagnóstico novamente
        await runDiagnostics();
      }
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isVisible && instanceId) {
      runDiagnostics();
    }
  }, [isVisible, instanceId]);

  if (!isVisible) return null;

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">OK</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Aviso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'checking':
        return <Badge variant="outline">Verificando...</Badge>;
    }
  };

  const hasErrors = diagnostics.some(d => d.status === 'error');
  const hasWarnings = diagnostics.some(d => d.status === 'warning');

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {hasErrors ? (
              <WifiOff className="h-5 w-5 text-red-500" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : (
              <Wifi className="h-5 w-5 text-green-500" />
            )}
            <span>Diagnóstico de Conexão</span>
          </div>
          <div className="flex items-center space-x-2">
            {lastCheck && (
              <span className="text-sm text-muted-foreground">
                Última verificação: {lastCheck.toLocaleTimeString()}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={runDiagnostics}
              disabled={isRunning}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Verificando...' : 'Verificar'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {diagnostics.map((diagnostic, index) => (
          <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center space-x-3">
              {getStatusIcon(diagnostic.status)}
              <div>
                <div className="font-medium">{diagnostic.name}</div>
                <div className="text-sm text-muted-foreground">{diagnostic.message}</div>
                {diagnostic.details && (
                  <div className="text-xs text-muted-foreground mt-1">{diagnostic.details}</div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge(diagnostic.status)}
              {diagnostic.name === 'Configuração do Webhook' && diagnostic.status === 'error' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleFixWebhook}
                  disabled={isRunning}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Configurar
                </Button>
              )}
            </div>
          </div>
        ))}

        {hasErrors && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Problemas críticos detectados. As mensagens podem não ser enviadas ou recebidas corretamente.
            </AlertDescription>
          </Alert>
        )}

        {hasWarnings && !hasErrors && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Alguns problemas foram encontrados. O sistema pode funcionar, mas recomendamos corrigir as configurações.
            </AlertDescription>
          </Alert>
        )}

        {!hasErrors && !hasWarnings && diagnostics.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Todas as verificações foram aprovadas. O sistema está pronto para enviar e receber mensagens.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionDiagnostics;