
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Globe, Server, Database, Clock, Wifi } from "lucide-react";
import { useServerConfig } from "@/hooks/useServerConfig";

interface EndpointTest {
  name: string;
  url: string;
  method: string;
  category: 'admin' | 'business' | 'instance' | 'webhook' | 'message';
  status: 'pending' | 'success' | 'cors_error' | 'not_found' | 'server_error' | 'auth_error' | 'timeout_error' | 'network_error';
  details?: string;
  httpStatus?: number;
  responseTime?: number;
  headers?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

const YumerV2Diagnostic = () => {
  const { config, status: serverStatus, isLoading: configLoading } = useServerConfig();
  const [tests, setTests] = useState<EndpointTest[]>([
    // Admin endpoints - Básicos primeiro
    { name: "Health Check", url: "/health", method: "GET", category: "admin", status: "pending" },
    { name: "Server Info", url: "/info", method: "GET", category: "admin", status: "pending" },
    
    // Business endpoints  
    { name: "List Businesses", url: "/business", method: "GET", category: "business", status: "pending" },
    { name: "Create Business", url: "/business", method: "POST", category: "business", status: "pending" },
    
    // Instance endpoints
    { name: "List Instances", url: "/instance/fetchInstances", method: "GET", category: "instance", status: "pending" },
    { name: "Create Instance", url: "/instance/create", method: "POST", category: "instance", status: "pending" },
    { name: "Instance Status", url: "/instance/connectionState/test", method: "GET", category: "instance", status: "pending" },
    
    // Webhook endpoints
    { name: "Webhook Config", url: "/webhook/find/test", method: "GET", category: "webhook", status: "pending" },
    { name: "Set Webhook", url: "/webhook/set/test", method: "PUT", category: "webhook", status: "pending" },
    
    // Message endpoints
    { name: "Send Message", url: "/message/sendText/test", method: "POST", category: "message", status: "pending" }
  ]);
  
  const [testing, setTesting] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`🧪 [YUMER-V2] ${logMessage}`);
    setDetailedLogs(prev => [...prev, logMessage]);
  };

  const testEndpoint = async (endpoint: EndpointTest): Promise<EndpointTest> => {
    const fullUrl = `${config.serverUrl}${config.basePath}${endpoint.url}`;
    const startTime = Date.now();
    
    try {
      addLog(`Testando ${endpoint.method} ${fullUrl}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
      };

      // Adicionar autenticação para endpoints que precisam
      if (endpoint.category !== 'admin') {
        if (config.globalApiKey) {
          headers['apikey'] = config.globalApiKey;
        }
        if (config.adminToken) {
          headers['Authorization'] = `Bearer ${config.adminToken}`;
        }
      }

      addLog(`Headers: ${JSON.stringify(headers, null, 2)}`);

      // Criar AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        addLog(`Timeout após 10 segundos para ${endpoint.name}`);
      }, 10000);

      const response = await fetch(fullUrl, {
        method: endpoint.method,
        headers,
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        ...(endpoint.method === 'POST' && {
          body: JSON.stringify(getTestPayload(endpoint))
        })
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      const httpStatus = response.status;
      
      // Capturar headers de resposta
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      addLog(`Resposta HTTP ${httpStatus} em ${responseTime}ms`);
      addLog(`Response Headers: ${JSON.stringify(responseHeaders, null, 2)}`);
      
      if (response.ok) {
        let data;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
          addLog(`Response Data: ${JSON.stringify(data, null, 2)}`);
        } else {
          data = await response.text();
          addLog(`Response Text: ${data}`);
        }
        
        // Salvar info do servidor se for health check
        if (endpoint.url === '/health' && data) {
          setServerInfo(data);
        }
        
        return {
          ...endpoint,
          status: 'success',
          httpStatus,
          responseTime,
          headers,
          responseHeaders,
          details: `✅ Success - ${responseTime}ms - Status ${httpStatus} - Content-Type: ${contentType || 'N/A'}`
        };
      } else if (httpStatus === 401 || httpStatus === 403) {
        const errorText = await response.text().catch(() => 'Unknown auth error');
        addLog(`Auth Error ${httpStatus}: ${errorText}`);
        return {
          ...endpoint,
          status: 'auth_error',
          httpStatus,
          responseTime,
          headers,
          responseHeaders,
          details: `🔐 Auth Error - Status ${httpStatus} - Verificar tokens: ${errorText}`
        };
      } else if (httpStatus === 404) {
        const errorText = await response.text().catch(() => 'Not found');
        addLog(`Not Found ${httpStatus}: ${errorText}`);
        return {
          ...endpoint,
          status: 'not_found',
          httpStatus,
          responseTime,
          headers,
          responseHeaders,
          details: `⚠️ Endpoint não encontrado - Status ${httpStatus}: ${errorText}`
        };
      } else {
        const errorText = await response.text().catch(() => 'Unknown server error');
        addLog(`Server Error ${httpStatus}: ${errorText}`);
        return {
          ...endpoint,
          status: 'server_error',
          httpStatus,
          responseTime,
          headers,
          responseHeaders,
          details: `❌ Erro servidor - Status ${httpStatus}: ${errorText}`
        };
      }
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      addLog(`Erro: ${error.message}`);
      
      if (error.name === 'AbortError') {
        return {
          ...endpoint,
          status: 'timeout_error',
          responseTime,
          details: `⏱️ Timeout após 10 segundos - Servidor pode estar sobrecarregado`
        };
      } else if (error.message.includes('CORS') || 
          error.message.includes('Access-Control-Allow-Origin') ||
          error.message.includes('preflight')) {
        return {
          ...endpoint,
          status: 'cors_error',
          responseTime,
          details: `❌ CORS Error: ${error.message} - Verificar configuração CORS no servidor`
        };
      } else if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
        return {
          ...endpoint,
          status: 'network_error',
          responseTime,
          details: `🌐 Network Error: ${error.message} - Verificar conectividade ou firewall`
        };
      } else {
        return {
          ...endpoint,
          status: 'server_error',
          responseTime,
          details: `❌ Error: ${error.message}`
        };
      }
    }
  };

  const getTestPayload = (endpoint: EndpointTest) => {
    switch (endpoint.url) {
      case '/business':
        return {
          name: "Test Business v2.2.1",
          email: "test@example.com",
          phone: "5511999999999"
        };
      case '/instance/create':
        return {
          instanceName: `test-instance-${Date.now()}`,
          token: config.adminToken,
          qrcode: true
        };
      case '/webhook/set/test':
        return {
          enabled: true,
          url: config.adminWebhooks.messageWebhook.url,
          events: ['messagesUpsert', 'qrcodeUpdated'],
          webhook_by_events: true,
          webhook_base64: false
        };
      case '/message/sendText/test':
        return {
          number: "5511999999999",
          text: "Test message from v2.2.1 diagnostic"
        };
      default:
        return {};
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setDetailedLogs([]);
    addLog('🧪 Iniciando diagnóstico completo da API CodeChat v2.2.1...');
    addLog(`📍 Servidor: ${config.serverUrl}${config.basePath}`);
    addLog(`🔑 API Key configurada: ${config.globalApiKey ? 'Sim' : 'Não'}`);
    addLog(`🎫 Admin Token configurado: ${config.adminToken ? 'Sim' : 'Não'}`);
    
    const updatedTests: EndpointTest[] = [];
    
    // Testar endpoints básicos primeiro
    const basicEndpoints = tests.filter(t => t.category === 'admin');
    const otherEndpoints = tests.filter(t => t.category !== 'admin');
    
    for (const test of [...basicEndpoints, ...otherEndpoints]) {
      const result = await testEndpoint(test);
      updatedTests.push(result);
      
      // Atualizar estado incremental para mostrar progresso
      setTests([...updatedTests, ...tests.slice(updatedTests.length)]);
      
      // Pausa entre testes para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setTests(updatedTests);
    setTesting(false);
    
    // Análise final
    const corsErrors = updatedTests.filter(t => t.status === 'cors_error').length;
    const networkErrors = updatedTests.filter(t => t.status === 'network_error').length;
    const timeoutErrors = updatedTests.filter(t => t.status === 'timeout_error').length;
    const successes = updatedTests.filter(t => t.status === 'success').length;
    const authErrors = updatedTests.filter(t => t.status === 'auth_error').length;
    
    addLog(`🎯 Diagnóstico concluído: ${successes} sucessos, ${corsErrors} CORS, ${networkErrors} rede, ${timeoutErrors} timeout, ${authErrors} auth`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cors_error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'auth_error': return <XCircle className="w-4 h-4 text-orange-500" />;
      case 'not_found': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'server_error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'timeout_error': return <Clock className="w-4 h-4 text-purple-500" />;
      case 'network_error': return <Wifi className="w-4 h-4 text-blue-500" />;
      default: return <RefreshCw className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'cors_error': return 'destructive';
      case 'auth_error': return 'destructive';
      case 'not_found': return 'secondary';
      case 'server_error': return 'destructive';
      case 'timeout_error': return 'destructive';
      case 'network_error': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return 'OK';
      case 'cors_error': return 'CORS Error';
      case 'auth_error': return 'Auth Error';
      case 'not_found': return 'Não encontrado';
      case 'server_error': return 'Erro servidor';
      case 'timeout_error': return 'Timeout';
      case 'network_error': return 'Erro rede';
      default: return 'Aguardando';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'admin': return <Server className="w-4 h-4" />;
      case 'business': return <Database className="w-4 h-4" />;
      case 'instance': return <Globe className="w-4 h-4" />;
      default: return <RefreshCw className="w-4 h-4" />;
    }
  };

  const hasErrors = tests.some(t => ['cors_error', 'network_error', 'timeout_error', 'auth_error', 'server_error'].includes(t.status));

  if (configLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Carregando configuração do servidor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>🚀 Diagnóstico API CodeChat v2.2.1</CardTitle>
          <Button onClick={runAllTests} disabled={testing}>
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Testar API v2.2.1
              </>
            )}
          </Button>
        </div>
        
        {/* Server Configuration Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded">
            <p><strong>Servidor:</strong> {config.serverUrl}</p>
            <p><strong>Base Path:</strong> {config.basePath}</p>
            <p><strong>Versão:</strong> {config.apiVersion}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <p><strong>Status:</strong> {serverStatus.isOnline ? '🟢 Online' : '🔴 Offline'}</p>
            <p><strong>Latência:</strong> {serverStatus.latency}ms</p>
            <p><strong>Última verificação:</strong> {new Date(serverStatus.lastCheck).toLocaleTimeString()}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <p><strong>API Key:</strong> {config.globalApiKey ? '✅ Configurada' : '❌ Não configurada'}</p>
            <p><strong>Admin Token:</strong> {config.adminToken ? '✅ Configurado' : '❌ Não configurado'}</p>
          </div>
        </div>
        
        {serverInfo && (
          <div className="p-3 bg-blue-50 rounded">
            <p><strong>Server Info:</strong></p>
            <pre className="text-xs mt-1 overflow-auto">{JSON.stringify(serverInfo, null, 2)}</pre>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        
        {/* Status Summary */}
        {!testing && tests.some(t => t.status !== 'pending') && (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {tests.filter(t => t.status === 'success').length}
              </div>
              <div className="text-sm text-gray-600">Funcionando</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {tests.filter(t => t.status === 'cors_error').length}
              </div>
              <div className="text-sm text-gray-600">CORS Error</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {tests.filter(t => t.status === 'network_error').length}
              </div>
              <div className="text-sm text-gray-600">Rede</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {tests.filter(t => t.status === 'timeout_error').length}
              </div>
              <div className="text-sm text-gray-600">Timeout</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {tests.filter(t => t.status === 'auth_error').length}
              </div>
              <div className="text-sm text-gray-600">Auth Error</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {tests.filter(t => t.status === 'not_found').length}
              </div>
              <div className="text-sm text-gray-600">Não encontrado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-700">
                {tests.filter(t => t.status === 'server_error').length}
              </div>
              <div className="text-sm text-gray-600">Erro servidor</div>
            </div>
          </div>
        )}

        {/* Issues Alert */}
        {hasErrors && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">🎯 PROBLEMAS IDENTIFICADOS:</p>
                {tests.filter(t => t.status === 'cors_error').length > 0 && (
                  <p>• <strong>CORS:</strong> {tests.filter(t => t.status === 'cors_error').length} endpoints bloqueados por CORS</p>
                )}
                {tests.filter(t => t.status === 'network_error').length > 0 && (
                  <p>• <strong>REDE:</strong> {tests.filter(t => t.status === 'network_error').length} falhas de conectividade</p>
                )}
                {tests.filter(t => t.status === 'timeout_error').length > 0 && (
                  <p>• <strong>TIMEOUT:</strong> {tests.filter(t => t.status === 'timeout_error').length} requisições lentas demais</p>
                )}
                {tests.filter(t => t.status === 'auth_error').length > 0 && (
                  <p>• <strong>AUTH:</strong> {tests.filter(t => t.status === 'auth_error').length} endpoints com erro de autenticação</p>
                )}
                <p className="text-sm">
                  <strong>Próximos passos:</strong> Verificar logs detalhados abaixo e configurar CORS/autenticação
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Test Results by Category */}
        <div className="space-y-3">
          <h4 className="font-medium">Resultados por Categoria:</h4>
          
          {['admin', 'business', 'instance', 'webhook', 'message'].map(category => {
            const categoryTests = tests.filter(t => t.category === category);
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center space-x-2">
                  {getCategoryIcon(category)}
                  <h5 className="font-medium capitalize">{category}</h5>
                </div>
                
                {categoryTests.map((test, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded ml-6">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(test.status)}
                      <div>
                        <div className="font-medium">{test.name}</div>
                        <div className="text-sm text-gray-500">
                          {test.method} {config.serverUrl}{config.basePath}{test.url}
                        </div>
                        {test.responseTime && (
                          <div className="text-xs text-gray-400">
                            {test.responseTime}ms
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {test.httpStatus && (
                        <span className="text-sm text-gray-500">
                          {test.httpStatus}
                        </span>
                      )}
                      <Badge variant={getStatusColor(test.status)}>
                        {getStatusText(test.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Detailed Logs */}
        {detailedLogs.length > 0 && (
          <div className="bg-gray-900 text-green-400 p-4 rounded text-xs font-mono max-h-64 overflow-auto">
            <h4 className="text-white mb-2">📋 Logs Detalhados:</h4>
            {detailedLogs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded">
          <h4 className="font-medium text-blue-900 mb-2">📋 Plano de Correção v2.2.1:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li><strong>FASE 1:</strong> Configurar CORS no backend CodeChat para todos os endpoints</li>
            <li><strong>FASE 2:</strong> Verificar e ajustar tokens de autenticação API v2.2.1</li>
            <li><strong>FASE 3:</strong> Implementar serviços v2.2.1 completos</li>
            <li><strong>FASE 4:</strong> Atualizar estrutura Supabase</li>
            <li><strong>FASE 5:</strong> Migração completa da interface v2.2.1</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default YumerV2Diagnostic;
