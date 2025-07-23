
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  Shield, 
  Network, 
  Settings,
  Download,
  Upload,
  Zap,
  Eye,
  Loader2
} from "lucide-react";
import { useServerConfig } from "@/hooks/useServerConfig";
import { toast } from "sonner";

interface DiagnosticTest {
  id: string;
  name: string;
  category: 'endpoint' | 'auth' | 'ssl' | 'config';
  status: 'pending' | 'testing' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
  duration?: number;
  autoFix?: boolean;
}

interface EndpointTest {
  url: string;
  method: 'GET' | 'POST';
  description: string;
  authRequired: boolean;
  expectedStatus?: number;
}

const ServerAdvancedDiagnostic = () => {
  const { config, updateConfig, testConnection, validateConfig } = useServerConfig();
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [autoFixEnabled, setAutoFixEnabled] = useState(true);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

  // Endpoints para testar
  const endpointTests: EndpointTest[] = [
    { url: '/', method: 'GET', description: 'Raiz da API', authRequired: false },
    { url: '/health', method: 'GET', description: 'Health Check Padrão', authRequired: false },
    { url: '/api/health', method: 'GET', description: 'Health Check API', authRequired: false },
    { url: '/api/v2/health', method: 'GET', description: 'Health Check v2', authRequired: false },
    { url: '/status', method: 'GET', description: 'Status do Servidor', authRequired: false },
    { url: '/ping', method: 'GET', description: 'Ping Simples', authRequired: false },
    { url: '/manager/findApikey', method: 'GET', description: 'Listar API Keys', authRequired: true },
    { url: '/instance/fetchInstances', method: 'GET', description: 'Listar Instâncias', authRequired: true },
    { url: '/instance/create', method: 'POST', description: 'Criar Instância', authRequired: true },
  ];

  // Formatos de autenticação para testar
  const authFormats = [
    { name: 'apikey-header', headers: (key: string) => ({ 'apikey': key }) },
    { name: 'authorization-bearer', headers: (key: string) => ({ 'Authorization': `Bearer ${key}` }) },
    { name: 'x-api-key', headers: (key: string) => ({ 'X-API-Key': key }) },
    { name: 'query-param', query: (key: string) => `?apikey=${key}` },
  ];

  const initializeTests = () => {
    const initialTests: DiagnosticTest[] = [
      // Testes de Endpoint
      ...endpointTests.map(endpoint => ({
        id: `endpoint-${endpoint.url.replace(/[^a-zA-Z0-9]/g, '-')}`,
        name: `${endpoint.method} ${endpoint.url}`,
        category: 'endpoint' as const,
        status: 'pending' as const,
        message: endpoint.description,
        details: { endpoint, authRequired: endpoint.authRequired }
      })),
      
      // Testes de Autenticação
      ...authFormats.map(format => ({
        id: `auth-${format.name}`,
        name: `Auth: ${format.name}`,
        category: 'auth' as const,
        status: 'pending' as const,
        message: `Testar autenticação ${format.name}`,
        details: { format }
      })),

      // Testes SSL
      {
        id: 'ssl-certificate',
        name: 'Certificado SSL',
        category: 'ssl' as const,
        status: 'pending' as const,
        message: 'Validar certificado SSL'
      },
      {
        id: 'ssl-cors',
        name: 'CORS Headers',
        category: 'ssl' as const,
        status: 'pending' as const,
        message: 'Verificar headers CORS'
      },

      // Testes de Configuração
      {
        id: 'config-validation',
        name: 'Validação Config',
        category: 'config' as const,
        status: 'pending' as const,
        message: 'Validar configuração atual'
      },
      {
        id: 'config-autofix',
        name: 'Auto-correção',
        category: 'config' as const,
        status: 'pending' as const,
        message: 'Aplicar correções automáticas',
        autoFix: true
      }
    ];

    setTests(initialTests);
  };

  useEffect(() => {
    initializeTests();
  }, []);

  const updateTestStatus = (testId: string, status: DiagnosticTest['status'], message: string, details?: any, duration?: number) => {
    setTests(prev => prev.map(test => 
      test.id === testId 
        ? { ...test, status, message, details, duration }
        : test
    ));
  };

  const testEndpoint = async (test: DiagnosticTest): Promise<void> => {
    const { endpoint } = test.details;
    const startTime = Date.now();
    updateTestStatus(test.id, 'testing', 'Testando endpoint...');

    try {
      const url = `${config.serverUrl}${endpoint.url}`;
      console.log(`🧪 [DIAGNOSTIC] Testando ${endpoint.method} ${url}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
      };

      // Adicionar autenticação se necessário
      if (endpoint.authRequired && config.globalApiKey) {
        headers['apikey'] = config.globalApiKey;
      }

      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        mode: 'cors',
        credentials: 'omit',
        ...(endpoint.method === 'POST' && {
          body: JSON.stringify({ instanceName: 'diagnostic-test' })
        })
      });

      const duration = Date.now() - startTime;
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      if (response.ok) {
        updateTestStatus(test.id, 'success', `✅ OK (${response.status}) - ${duration}ms`, {
          ...test.details,
          response: responseData,
          httpStatus: response.status,
          headers: Object.fromEntries(response.headers.entries())
        }, duration);
      } else if (response.status === 404) {
        updateTestStatus(test.id, 'warning', `⚠️ Endpoint não encontrado (404) - ${duration}ms`, {
          ...test.details,
          httpStatus: response.status,
          response: responseData
        }, duration);
      } else if (response.status === 401 || response.status === 403) {
        updateTestStatus(test.id, 'warning', `🔐 Erro de autenticação (${response.status}) - ${duration}ms`, {
          ...test.details,
          httpStatus: response.status,
          response: responseData
        }, duration);
      } else {
        updateTestStatus(test.id, 'error', `❌ Erro HTTP ${response.status} - ${duration}ms`, {
          ...test.details,
          httpStatus: response.status,
          response: responseData
        }, duration);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ [DIAGNOSTIC] Erro testando ${test.name}:`, error);

      if (error.message.includes('CORS') || error.message === 'Failed to fetch') {
        updateTestStatus(test.id, 'error', `❌ Erro CORS - ${duration}ms`, {
          ...test.details,
          error: error.message
        }, duration);
      } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
        updateTestStatus(test.id, 'error', `🔒 Erro SSL - ${duration}ms`, {
          ...test.details,
          error: error.message
        }, duration);
      } else {
        updateTestStatus(test.id, 'error', `❌ ${error.message} - ${duration}ms`, {
          ...test.details,
          error: error.message
        }, duration);
      }
    }
  };

  const testAuthentication = async (test: DiagnosticTest): Promise<void> => {
    if (!config.globalApiKey) {
      updateTestStatus(test.id, 'warning', '⚠️ API Key não configurada', test.details);
      return;
    }

    const { format } = test.details;
    const startTime = Date.now();
    updateTestStatus(test.id, 'testing', 'Testando autenticação...');

    try {
      const baseUrl = `${config.serverUrl}/manager/findApikey`;
      const url = format.query ? `${baseUrl}${format.query(config.globalApiKey)}` : baseUrl;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin,
        ...format.headers?.(config.globalApiKey) || {}
      };

      console.log(`🔐 [AUTH-TEST] Testando ${format.name} em ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        mode: 'cors',
        credentials: 'omit'
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        updateTestStatus(test.id, 'success', `✅ Autenticação OK (${format.name}) - ${duration}ms`, {
          ...test.details,
          httpStatus: response.status
        }, duration);
      } else if (response.status === 401 || response.status === 403) {
        updateTestStatus(test.id, 'warning', `🔐 Auth rejeitada (${response.status}) - ${duration}ms`, {
          ...test.details,
          httpStatus: response.status
        }, duration);
      } else {
        updateTestStatus(test.id, 'error', `❌ Erro HTTP ${response.status} - ${duration}ms`, {
          ...test.details,
          httpStatus: response.status
        }, duration);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      updateTestStatus(test.id, 'error', `❌ ${error.message} - ${duration}ms`, {
        ...test.details,
        error: error.message
      }, duration);
    }
  };

  const testSSL = async (test: DiagnosticTest): Promise<void> => {
    const startTime = Date.now();
    updateTestStatus(test.id, 'testing', 'Testando SSL...');

    try {
      if (test.id === 'ssl-certificate') {
        // Testar certificado SSL
        const response = await fetch(config.serverUrl, {
          method: 'HEAD',
          mode: 'cors'
        });

        const duration = Date.now() - startTime;
        const isHttps = config.serverUrl.startsWith('https://');
        
        if (isHttps && response.ok) {
          updateTestStatus(test.id, 'success', `✅ Certificado SSL válido - ${duration}ms`, {
            isHttps,
            status: response.status
          }, duration);
        } else if (isHttps) {
          updateTestStatus(test.id, 'warning', `⚠️ SSL com problemas - ${duration}ms`, {
            isHttps,
            status: response.status
          }, duration);
        } else {
          updateTestStatus(test.id, 'warning', `⚠️ Conexão não HTTPS - ${duration}ms`, {
            isHttps
          }, duration);
        }

      } else if (test.id === 'ssl-cors') {
        // Testar CORS headers
        const response = await fetch(`${config.serverUrl}/health`, {
          method: 'OPTIONS',
          headers: {
            'Origin': window.location.origin,
            'Access-Control-Request-Method': 'GET'
          },
          mode: 'cors'
        });

        const duration = Date.now() - startTime;
        const corsHeaders = {
          'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
          'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
          'access-control-allow-headers': response.headers.get('access-control-allow-headers')
        };

        if (corsHeaders['access-control-allow-origin']) {
          updateTestStatus(test.id, 'success', `✅ CORS configurado - ${duration}ms`, {
            corsHeaders
          }, duration);
        } else {
          updateTestStatus(test.id, 'error', `❌ CORS não configurado - ${duration}ms`, {
            corsHeaders
          }, duration);
        }
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      updateTestStatus(test.id, 'error', `❌ ${error.message} - ${duration}ms`, {
        error: error.message
      }, duration);
    }
  };

  const testConfiguration = async (test: DiagnosticTest): Promise<void> => {
    const startTime = Date.now();
    updateTestStatus(test.id, 'testing', 'Validando configuração...');

    try {
      if (test.id === 'config-validation') {
        const isValid = await validateConfig();
        const duration = Date.now() - startTime;

        if (isValid) {
          updateTestStatus(test.id, 'success', `✅ Configuração válida - ${duration}ms`, {
            config: config
          }, duration);
        } else {
          updateTestStatus(test.id, 'warning', `⚠️ Configuração com problemas - ${duration}ms`, {
            config: config
          }, duration);
        }

      } else if (test.id === 'config-autofix' && autoFixEnabled) {
        // Auto-correção baseada nos resultados dos testes
        const duration = Date.now() - startTime;
        const fixes = await applyAutoFixes();
        
        if (fixes.length > 0) {
          updateTestStatus(test.id, 'success', `✅ ${fixes.length} correções aplicadas - ${duration}ms`, {
            fixes
          }, duration);
          toast.success(`${fixes.length} correções automáticas aplicadas`);
        } else {
          updateTestStatus(test.id, 'warning', `⚠️ Nenhuma correção necessária - ${duration}ms`, {
            fixes: []
          }, duration);
        }
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      updateTestStatus(test.id, 'error', `❌ ${error.message} - ${duration}ms`, {
        error: error.message
      }, duration);
    }
  };

  const applyAutoFixes = async (): Promise<string[]> => {
    const fixes: string[] = [];
    
    // Analisar resultados dos testes para aplicar correções
    const endpointTests = tests.filter(t => t.category === 'endpoint' && t.status === 'success');
    const authTests = tests.filter(t => t.category === 'auth' && t.status === 'success');

    // Se encontrou um endpoint de health funcionando, atualizar configuração
    const workingHealthEndpoint = endpointTests.find(t => 
      t.name.includes('health') && t.status === 'success'
    );

    if (workingHealthEndpoint && workingHealthEndpoint.details?.endpoint?.url !== '/health') {
      const newBasePath = workingHealthEndpoint.details.endpoint.url.replace('/health', '');
      await updateConfig({ basePath: newBasePath });
      fixes.push(`Base path atualizado para: ${newBasePath}`);
    }

    // Se encontrou formato de auth funcionando, salvar preferência
    const workingAuth = authTests.find(t => t.status === 'success');
    if (workingAuth) {
      fixes.push(`Formato de autenticação validado: ${workingAuth.details.format.name}`);
    }

    return fixes;
  };

  const runCompleteDiagnostic = async () => {
    setIsRunning(true);
    setProgress(0);
    
    console.log('🚀 [DIAGNOSTIC] Iniciando diagnóstico completo do servidor...');
    
    const totalTests = tests.length;
    let completedTests = 0;

    try {
      // Executar testes por categoria
      for (const test of tests) {
        switch (test.category) {
          case 'endpoint':
            await testEndpoint(test);
            break;
          case 'auth':
            await testAuthentication(test);
            break;
          case 'ssl':
            await testSSL(test);
            break;
          case 'config':
            await testConfiguration(test);
            break;
        }

        completedTests++;
        setProgress((completedTests / totalTests) * 100);
        
        // Pequena pausa para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Gerar relatório final
      const successCount = tests.filter(t => t.status === 'success').length;
      const warningCount = tests.filter(t => t.status === 'warning').length;
      const errorCount = tests.filter(t => t.status === 'error').length;

      console.log(`🎯 [DIAGNOSTIC] Diagnóstico concluído:`, {
        total: totalTests,
        success: successCount,
        warnings: warningCount,
        errors: errorCount
      });

      toast.success(`Diagnóstico concluído: ${successCount} sucessos, ${warningCount} avisos, ${errorCount} erros`);

    } catch (error) {
      console.error('❌ [DIAGNOSTIC] Erro durante diagnóstico:', error);
      toast.error('Erro durante o diagnóstico');
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  };

  const exportDiagnostic = () => {
    const report = {
      timestamp: new Date().toISOString(),
      config,
      tests: tests.map(t => ({
        ...t,
        details: t.details ? JSON.stringify(t.details, null, 2) : undefined
      })),
      summary: {
        total: tests.length,
        success: tests.filter(t => t.status === 'success').length,
        warnings: tests.filter(t => t.status === 'warning').length,
        errors: tests.filter(t => t.status === 'error').length
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server-diagnostic-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Relatório de diagnóstico exportado');
  };

  const getStatusIcon = (status: DiagnosticTest['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'testing': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default: return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusBadge = (status: DiagnosticTest['status']) => {
    switch (status) {
      case 'success': return <Badge variant="default">Sucesso</Badge>;
      case 'warning': return <Badge variant="secondary">Aviso</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      case 'testing': return <Badge variant="outline">Testando...</Badge>;
      default: return <Badge variant="outline">Aguardando</Badge>;
    }
  };

  const getCategoryIcon = (category: DiagnosticTest['category']) => {
    switch (category) {
      case 'endpoint': return <Server className="w-4 h-4" />;
      case 'auth': return <Shield className="w-4 h-4" />;
      case 'ssl': return <Network className="w-4 h-4" />;
      case 'config': return <Settings className="w-4 h-4" />;
    }
  };

  const toggleDetails = (testId: string) => {
    setShowDetails(prev => ({ ...prev, [testId]: !prev[testId] }));
  };

  const testsByCategory = {
    endpoint: tests.filter(t => t.category === 'endpoint'),
    auth: tests.filter(t => t.category === 'auth'),
    ssl: tests.filter(t => t.category === 'ssl'),
    config: tests.filter(t => t.category === 'config')
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Zap className="w-6 h-6 text-blue-500" />
              <div>
                <CardTitle className="text-xl">Diagnóstico Avançado do Servidor</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Análise completa da conectividade com a API CodeChat v2.2.1
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                onClick={runCompleteDiagnostic}
                disabled={isRunning}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Diagnosticando...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Executar Diagnóstico
                  </>
                )}
              </Button>
              
              <Button
                onClick={exportDiagnostic}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {isRunning && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>Progresso do diagnóstico</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Configuração Atual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium text-sm text-muted-foreground">Servidor</p>
              <p className="truncate text-sm">{config.serverUrl}</p>
            </div>
            <div>
              <p className="font-medium text-sm text-muted-foreground">API Version</p>
              <p className="text-sm">{config.apiVersion}</p>
            </div>
            <div>
              <p className="font-medium text-sm text-muted-foreground">API Key</p>
              <p className={`text-sm ${config.globalApiKey ? 'text-green-600' : 'text-red-600'}`}>
                {config.globalApiKey ? '✅ Configurada' : '❌ Não configurada'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs por Categoria */}
      <Tabs defaultValue="endpoint" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="endpoint" className="flex items-center space-x-2">
            <Server className="w-4 h-4" />
            <span>Endpoints</span>
          </TabsTrigger>
          <TabsTrigger value="auth" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Autenticação</span>
          </TabsTrigger>
          <TabsTrigger value="ssl" className="flex items-center space-x-2">
            <Network className="w-4 h-4" />
            <span>SSL/CORS</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Configuração</span>
          </TabsTrigger>
        </TabsList>

        {Object.entries(testsByCategory).map(([category, categoryTests]) => (
          <TabsContent key={category} value={category} className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  {getCategoryIcon(category as DiagnosticTest['category'])}
                  <span className="capitalize">Testes de {category}</span>
                  <Badge variant="outline">
                    {categoryTests.filter(t => t.status === 'success').length}/{categoryTests.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryTests.map((test) => (
                  <div key={test.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(test.status)}
                        <div>
                          <div className="font-medium">{test.name}</div>
                          <div className="text-sm text-muted-foreground">{test.message}</div>
                          {test.duration && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Tempo: {test.duration}ms
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(test.status)}
                        {test.details && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleDetails(test.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Detalhes colapsáveis */}
                    {showDetails[test.id] && test.details && (
                      <div className="mt-3 pt-3 border-t">
                        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                          {JSON.stringify(test.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Resumo e Ações */}
      {tests.some(t => t.status !== 'pending') && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo do Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {tests.filter(t => t.status === 'success').length}
                </div>
                <div className="text-sm text-green-600">Sucessos</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded">
                <div className="text-2xl font-bold text-yellow-600">
                  {tests.filter(t => t.status === 'warning').length}
                </div>
                <div className="text-sm text-yellow-600">Avisos</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-600">
                  {tests.filter(t => t.status === 'error').length}
                </div>
                <div className="text-sm text-red-600">Erros</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-2xl font-bold text-gray-600">
                  {tests.filter(t => t.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-600">Pendentes</div>
              </div>
            </div>

            {/* Recomendações */}
            <div className="space-y-2">
              <h4 className="font-medium">🎯 Próximos Passos:</h4>
              
              {tests.filter(t => t.status === 'error' && t.category === 'endpoint').length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Endpoints com erro:</strong> Verifique se o servidor está rodando e se a URL base está correta.
                  </AlertDescription>
                </Alert>
              )}

              {tests.filter(t => t.status === 'error' && t.category === 'auth').length > 0 && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Problemas de autenticação:</strong> Verifique se a API Key está correta e ativa.
                  </AlertDescription>
                </Alert>
              )}

              {tests.filter(t => t.status === 'error' && t.category === 'ssl').length > 0 && (
                <Alert variant="destructive">
                  <Network className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Problemas SSL/CORS:</strong> Configure CORS no servidor e aceite certificados autoassinados.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ServerAdvancedDiagnostic;
