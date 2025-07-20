
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertTriangle, 
  ExternalLink, 
  Server, 
  Shield, 
  Network, 
  Database,
  Webhook,
  Users,
  QrCode,
  Activity,
  Zap
} from "lucide-react";
import { SERVER_URL, getServerConfig, getYumerGlobalApiKey } from "@/config/environment";
import { supabase } from "@/integrations/supabase/client";

import { QRCodeAdvancedDiagnostic } from "./QRCodeAdvancedDiagnostic";
import AdvancedQRDiagnostic from "./AdvancedQRDiagnostic";
import AdvancedApiDiagnostic from "./AdvancedApiDiagnostic";

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  duration?: number;
}

interface EndpointTest {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  expectedStatus?: number;
}

interface SystemHealth {
  cors: TestResult;
  api: TestResult;
  webhook: TestResult;
  instances: TestResult;
  supabase: TestResult;
}

const ConnectionDiagnostics = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    cors: { status: 'idle', message: '' },
    api: { status: 'idle', message: '' },
    webhook: { status: 'idle', message: '' },
    instances: { status: 'idle', message: '' },
    supabase: { status: 'idle', message: '' }
  });
  
  const [isRunningComplete, setIsRunningComplete] = useState(false);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

  const config = getServerConfig();
  const apiKey = getYumerGlobalApiKey();

  // Endpoints básicos para teste rápido
  const basicEndpoints: EndpointTest[] = [
    { name: 'Health Check', url: '/health', method: 'GET' },
    { name: 'Status Público', url: '/', method: 'GET' },
    { name: 'Fetch Instances', url: '/instance/fetchInstances', method: 'GET', headers: { 'apikey': apiKey || '' } }
  ];

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'testing': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default: return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'testing': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Teste CORS específico
  const testCORS = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors',
        credentials: 'omit'
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        return {
          status: 'success',
          message: 'CORS configurado corretamente',
          duration
        };
      } else {
        return {
          status: 'error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          duration
        };
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (error.message.includes('CORS') || error.message === 'Failed to fetch') {
        return {
          status: 'error',
          message: 'Bloqueado por CORS',
          duration
        };
      }
      return {
        status: 'error',
        message: error.message,
        duration
      };
    }
  };

  // Teste API básica
  const testBasicAPI = async (): Promise<TestResult> => {
    const startTime = Date.now();
    let successCount = 0;
    
    for (const endpoint of basicEndpoints) {
      try {
        const url = `${SERVER_URL}${endpoint.url}`;
        const response = await fetch(url, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            ...endpoint.headers
          },
          mode: 'cors'
        });

        if (response.ok) {
          successCount++;
        }
      } catch (error) {
        // Continue testando outros endpoints
      }
    }

    const duration = Date.now() - startTime;
    const successRate = (successCount / basicEndpoints.length) * 100;

    if (successRate >= 75) {
      return {
        status: 'success',
        message: `${successCount}/${basicEndpoints.length} endpoints funcionando`,
        duration
      };
    } else if (successRate >= 25) {
      return {
        status: 'warning',
        message: `${successCount}/${basicEndpoints.length} endpoints funcionando`,
        duration
      };
    } else {
      return {
        status: 'error',
        message: `Apenas ${successCount}/${basicEndpoints.length} endpoints funcionando`,
        duration
      };
    }
  };

  // Teste Webhook
  const testWebhook = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch(`${SERVER_URL}/webhook/find/test`, {
        headers: { 'apikey': apiKey || '' }
      });
      
      const duration = Date.now() - startTime;
      
      if (response.status === 404) {
        return {
          status: 'warning',
          message: 'Webhook não configurado (normal)',
          duration
        };
      } else if (response.ok) {
        return {
          status: 'success',
          message: 'Webhook configurado',
          duration
        };
      } else {
        return {
          status: 'error',
          message: `Erro HTTP ${response.status}`,
          duration
        };
      }
    } catch (error: any) {
      return {
        status: 'error',
        message: `Erro: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  };

  // Teste múltiplas instâncias
  const testInstances = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await fetch(`${SERVER_URL}/instance/fetchInstances`, {
        headers: { 'apikey': apiKey || '' }
      });
      
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        const instanceCount = Array.isArray(data) ? data.length : 0;
        return {
          status: 'success',
          message: `${instanceCount} instância(s) encontrada(s)`,
          duration
        };
      } else {
        return {
          status: 'error',
          message: `Erro HTTP ${response.status}`,
          duration
        };
      }
    } catch (error: any) {
      return {
        status: 'error',
        message: `Erro: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  };

  // Teste Supabase
  const testSupabase = async (): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const { data, error, count } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact' })
        .limit(1);

      const duration = Date.now() - startTime;

      if (error) {
        return {
          status: 'error',
          message: `Erro: ${error.message}`,
          duration
        };
      }

      return {
        status: 'success',
        message: `Conectado - ${count || 0} instâncias no banco`,
        duration
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: `Erro: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  };

  // Executar diagnóstico completo
  const runCompleteDiagnostic = async () => {
    setIsRunningComplete(true);
    
    try {
      // Executar todos os testes em paralelo
      const [corsResult, apiResult, webhookResult, instancesResult, supabaseResult] = await Promise.all([
        testCORS(),
        testBasicAPI(),
        testWebhook(),
        testInstances(),
        testSupabase()
      ]);

      setSystemHealth({
        cors: corsResult,
        api: apiResult,
        webhook: webhookResult,
        instances: instancesResult,
        supabase: supabaseResult
      });
    } finally {
      setIsRunningComplete(false);
    }
  };

  const toggleDetails = (key: string) => {
    setShowDetails(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Calcular status geral do sistema
  const getOverallStatus = () => {
    const results = Object.values(systemHealth);
    const hasError = results.some(r => r.status === 'error');
    const hasWarning = results.some(r => r.status === 'warning');
    const allSuccess = results.every(r => r.status === 'success');
    const allTested = results.every(r => r.status !== 'idle');

    if (!allTested) return { status: 'idle', message: 'Aguardando diagnóstico' };
    if (hasError) return { status: 'error', message: 'Problemas detectados' };
    if (hasWarning) return { status: 'warning', message: 'Funcionando com avisos' };
    if (allSuccess) return { status: 'success', message: 'Sistema funcionando perfeitamente' };
    
    return { status: 'idle', message: 'Status indefinido' };
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="space-y-6">
      {/* Header com Status Geral */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Activity className="w-6 h-6 text-blue-500" />
              <div>
                <CardTitle className="text-xl">Diagnóstico do Sistema</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Verificação completa da conectividade e funcionalidades
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon(overallStatus.status)}
                <span className={`text-sm font-medium ${getStatusColor(overallStatus.status)}`}>
                  {overallStatus.message}
                </span>
              </div>
              
              <Button 
                onClick={runCompleteDiagnostic} 
                disabled={isRunningComplete}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isRunningComplete ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Diagnosticando...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Diagnóstico Completo
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Dashboard de Status */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: 'cors', label: 'CORS', icon: Shield },
              { key: 'api', label: 'API', icon: Server },
              { key: 'webhook', label: 'Webhook', icon: Webhook },
              { key: 'instances', label: 'Instâncias', icon: Users },
              { key: 'supabase', label: 'Banco', icon: Database }
            ].map(({ key, label, icon: Icon }) => {
              const result = systemHealth[key as keyof SystemHealth];
              return (
                <div 
                  key={key}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => toggleDetails(key)}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(result.status)}
                    <span className={`text-xs ${getStatusColor(result.status)}`}>
                      {result.status === 'idle' ? 'Não testado' : 
                       result.status === 'testing' ? 'Testando...' :
                       result.status === 'success' ? 'OK' :
                       result.status === 'warning' ? 'Aviso' : 'Erro'}
                    </span>
                  </div>
                  
                  {/* Detalhes colapsáveis */}
                  {showDetails[key] && result.message && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">{result.message}</p>
                      {result.duration && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.duration}ms
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Informações da Configuração */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-muted/30 rounded">
                <p className="font-medium text-muted-foreground">Frontend</p>
                <p className="truncate">{window.location.origin}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded">
                <p className="font-medium text-muted-foreground">Servidor YUMER</p>
                <p className="truncate">{SERVER_URL}</p>
              </div>
              <div className="p-3 bg-muted/30 rounded">
                <p className="font-medium text-muted-foreground">API Key</p>
                <p className={apiKey ? 'text-green-600' : 'text-red-600'}>
                  {apiKey ? '✅ Configurada' : '❌ Não configurada'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Reorganizadas */}
      <Tabs defaultValue="connectivity" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="connectivity" className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-2 p-3">
            <Shield className="w-4 h-4 mb-1 sm:mb-0" />
            <span className="text-xs sm:text-sm">Conectividade</span>
          </TabsTrigger>
          <TabsTrigger value="advanced-api" className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-2 p-3">
            <Network className="w-4 h-4 mb-1 sm:mb-0" />
            <span className="text-xs sm:text-sm">API Avançada</span>
          </TabsTrigger>
          <TabsTrigger value="qr-code" className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-2 p-3">
            <QrCode className="w-4 h-4 mb-1 sm:mb-0" />
            <span className="text-xs sm:text-sm">QR Code</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-2 p-3">
            <Server className="w-4 h-4 mb-1 sm:mb-0" />
            <span className="text-xs sm:text-sm">Sistema</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Conectividade (CORS + API Básica) */}
        <TabsContent value="connectivity" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Shield className="w-5 h-5" />
                  <span>Teste CORS</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={async () => {
                    setSystemHealth(prev => ({ ...prev, cors: { status: 'testing', message: 'Testando CORS...' } }));
                    const result = await testCORS();
                    setSystemHealth(prev => ({ ...prev, cors: result }));
                  }}
                  disabled={systemHealth.cors.status === 'testing'}
                  className="w-full mb-4"
                >
                  Testar CORS
                </Button>
                
                {systemHealth.cors.message && (
                  <div className="p-3 border rounded">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(systemHealth.cors.status)}
                      <span className="font-medium">{systemHealth.cors.message}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Server className="w-5 h-5" />
                  <span>API Básica</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={async () => {
                    setSystemHealth(prev => ({ ...prev, api: { status: 'testing', message: 'Testando API...' } }));
                    const result = await testBasicAPI();
                    setSystemHealth(prev => ({ ...prev, api: result }));
                  }}
                  disabled={systemHealth.api.status === 'testing'}
                  className="w-full mb-4"
                >
                  Testar API
                </Button>
                
                {systemHealth.api.message && (
                  <div className="p-3 border rounded">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(systemHealth.api.status)}
                      <span className="font-medium">{systemHealth.api.message}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: API Avançada */}
        <TabsContent value="advanced-api" className="space-y-4 mt-6">
          <AdvancedApiDiagnostic />
        </TabsContent>

        {/* Tab: QR Code */}
        <TabsContent value="qr-code" className="space-y-4 mt-6">
          <div className="space-y-6">
            <QRCodeAdvancedDiagnostic />
            <AdvancedQRDiagnostic />
          </div>
        </TabsContent>

        {/* Tab: Sistema (Webhook + Instâncias + Supabase) */}
        <TabsContent value="system" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Webhook className="w-5 h-5" />
                  <span>Webhook</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={async () => {
                    setSystemHealth(prev => ({ ...prev, webhook: { status: 'testing', message: 'Testando webhook...' } }));
                    const result = await testWebhook();
                    setSystemHealth(prev => ({ ...prev, webhook: result }));
                  }}
                  disabled={systemHealth.webhook.status === 'testing'}
                  className="w-full mb-4"
                >
                  Testar Webhook
                </Button>
                
                {systemHealth.webhook.message && (
                  <div className="p-3 border rounded">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(systemHealth.webhook.status)}
                      <span className="text-sm">{systemHealth.webhook.message}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Users className="w-5 h-5" />
                  <span>Instâncias</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={async () => {
                    setSystemHealth(prev => ({ ...prev, instances: { status: 'testing', message: 'Testando instâncias...' } }));
                    const result = await testInstances();
                    setSystemHealth(prev => ({ ...prev, instances: result }));
                  }}
                  disabled={systemHealth.instances.status === 'testing'}
                  className="w-full mb-4"
                >
                  Testar Instâncias
                </Button>
                
                {systemHealth.instances.message && (
                  <div className="p-3 border rounded">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(systemHealth.instances.status)}
                      <span className="text-sm">{systemHealth.instances.message}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Database className="w-5 h-5" />
                  <span>Supabase</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={async () => {
                    setSystemHealth(prev => ({ ...prev, supabase: { status: 'testing', message: 'Testando Supabase...' } }));
                    const result = await testSupabase();
                    setSystemHealth(prev => ({ ...prev, supabase: result }));
                  }}
                  disabled={systemHealth.supabase.status === 'testing'}
                  className="w-full mb-4"
                >
                  Testar Supabase
                </Button>
                
                {systemHealth.supabase.message && (
                  <div className="p-3 border rounded">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(systemHealth.supabase.status)}
                      <span className="text-sm">{systemHealth.supabase.message}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConnectionDiagnostics;
