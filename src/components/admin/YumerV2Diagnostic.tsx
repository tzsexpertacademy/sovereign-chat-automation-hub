
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Globe, Server, Database } from "lucide-react";
import { serverConfigService } from "@/services/serverConfigService";

interface EndpointTest {
  name: string;
  url: string;
  method: string;
  category: 'admin' | 'business' | 'instance' | 'webhook' | 'message';
  status: 'pending' | 'success' | 'cors_error' | 'not_found' | 'server_error' | 'auth_error';
  details?: string;
  httpStatus?: number;
  responseTime?: number;
}

const YumerV2Diagnostic = () => {
  const [tests, setTests] = useState<EndpointTest[]>([
    // Admin endpoints
    { name: "Health Check", url: "/health", method: "GET", category: "admin", status: "pending" },
    { name: "Server Info", url: "/info", method: "GET", category: "admin", status: "pending" },
    
    // Business endpoints  
    { name: "List Businesses", url: "/business", method: "GET", category: "business", status: "pending" },
    { name: "Create Business", url: "/business", method: "POST", category: "business", status: "pending" },
    
    // Instance endpoints
    { name: "List Instances", url: "/instance", method: "GET", category: "instance", status: "pending" },
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

  const config = serverConfigService.getConfig();

  const testEndpoint = async (endpoint: EndpointTest): Promise<EndpointTest> => {
    const fullUrl = `${config.serverUrl}${config.basePath}${endpoint.url}`;
    const startTime = Date.now();
    
    try {
      console.log(`🧪 [YUMER-V2] Testando ${endpoint.method} ${fullUrl}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
      };

      // Adicionar autenticação para endpoints que precisam
      if (endpoint.category !== 'admin') {
        headers['Authorization'] = `Bearer ${config.adminToken}`;
        headers['apikey'] = config.globalApiKey;
      }

      const response = await fetch(fullUrl, {
        method: endpoint.method,
        headers,
        mode: 'cors',
        credentials: 'omit',
        ...(endpoint.method === 'POST' && {
          body: JSON.stringify(getTestPayload(endpoint))
        })
      });

      const responseTime = Date.now() - startTime;
      const httpStatus = response.status;
      
      if (response.ok) {
        const data = await response.json();
        
        // Salvar info do servidor se for health check
        if (endpoint.url === '/health' && data) {
          setServerInfo(data);
        }
        
        return {
          ...endpoint,
          status: 'success',
          httpStatus,
          responseTime,
          details: `✅ Success - ${responseTime}ms - Status ${httpStatus}`
        };
      } else if (httpStatus === 401 || httpStatus === 403) {
        return {
          ...endpoint,
          status: 'auth_error',
          httpStatus,
          responseTime,
          details: `🔐 Auth Error - Status ${httpStatus} - Verificar tokens`
        };
      } else if (httpStatus === 404) {
        return {
          ...endpoint,
          status: 'not_found',
          httpStatus,
          responseTime,
          details: `⚠️ Endpoint não encontrado - Status ${httpStatus}`
        };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          ...endpoint,
          status: 'server_error',
          httpStatus,
          responseTime,
          details: `❌ Erro servidor - Status ${httpStatus}: ${errorText}`
        };
      }
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ [YUMER-V2] Erro testando ${endpoint.name}:`, error);
      
      if (error.message.includes('CORS') || 
          error.message.includes('Access-Control-Allow-Origin') ||
          error.message.includes('preflight') ||
          error.message === 'Failed to fetch') {
        return {
          ...endpoint,
          status: 'cors_error',
          responseTime,
          details: `❌ CORS Error: ${error.message}`
        };
      } else {
        return {
          ...endpoint,
          status: 'server_error',
          responseTime,
          details: `❌ Network Error: ${error.message}`
        };
      }
    }
  };

  const getTestPayload = (endpoint: EndpointTest) => {
    switch (endpoint.url) {
      case '/business':
        return {
          name: "Test Business",
          email: "test@example.com",
          phone: "5511999999999"
        };
      case '/instance/create':
        return {
          instanceName: "test-instance",
          token: config.adminToken
        };
      case '/webhook/set/test':
        return {
          enabled: true,
          url: config.adminWebhooks.messageWebhook.url,
          events: ['messagesUpsert', 'qrcodeUpdated']
        };
      case '/message/sendText/test':
        return {
          number: "5511999999999",
          textMessage: {
            text: "Test message"
          }
        };
      default:
        return {};
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    console.log('🧪 [YUMER-V2] Iniciando diagnóstico completo da API v2...');
    
    const updatedTests: EndpointTest[] = [];
    
    for (const test of tests) {
      const result = await testEndpoint(test);
      updatedTests.push(result);
      
      // Atualizar estado incremental para mostrar progresso
      setTests([...updatedTests, ...tests.slice(updatedTests.length)]);
      
      // Pequena pausa para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setTests(updatedTests);
    setTesting(false);
    
    // Análise final
    const corsErrors = updatedTests.filter(t => t.status === 'cors_error').length;
    const successes = updatedTests.filter(t => t.status === 'success').length;
    const authErrors = updatedTests.filter(t => t.status === 'auth_error').length;
    
    console.log(`🎯 [YUMER-V2] Diagnóstico concluído:`, {
      successes,
      corsErrors,
      authErrors,
      total: updatedTests.length
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cors_error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'auth_error': return <XCircle className="w-4 h-4 text-orange-500" />;
      case 'not_found': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'server_error': return <XCircle className="w-4 h-4 text-red-600" />;
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

  const corsErrors = tests.filter(t => t.status === 'cors_error');
  const authErrors = tests.filter(t => t.status === 'auth_error');
  const hasApiIssues = corsErrors.length > 0 || authErrors.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>🚀 Diagnóstico API Yumer v2</CardTitle>
          <Button onClick={runAllTests} disabled={testing}>
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Testar API v2
              </>
            )}
          </Button>
        </div>
        
        {/* Server Info */}
        <div className="text-sm text-gray-600">
          <p><strong>Base URL:</strong> {config.serverUrl}{config.basePath}</p>
          <p><strong>Versão:</strong> {config.apiVersion}</p>
          {serverInfo && (
            <p><strong>Server Status:</strong> {JSON.stringify(serverInfo, null, 2)}</p>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        
        {/* Status Summary */}
        {!testing && tests.some(t => t.status !== 'pending') && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        {hasApiIssues && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">🎯 PROBLEMAS IDENTIFICADOS:</p>
                {corsErrors.length > 0 && (
                  <p>• <strong>CORS:</strong> {corsErrors.length} endpoints bloqueados por CORS</p>
                )}
                {authErrors.length > 0 && (
                  <p>• <strong>AUTH:</strong> {authErrors.length} endpoints com erro de autenticação</p>
                )}
                <p className="text-sm">
                  <strong>Próximos passos:</strong> Configurar CORS no backend e verificar tokens de autenticação
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

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded">
          <h4 className="font-medium text-blue-900 mb-2">📋 Plano de Correção:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li><strong>FASE 1:</strong> Configurar CORS no backend para todos os endpoints</li>
            <li><strong>FASE 2:</strong> Verificar e ajustar tokens de autenticação</li>
            <li><strong>FASE 3:</strong> Implementar serviços v2 completos</li>
            <li><strong>FASE 4:</strong> Atualizar estrutura Supabase</li>
            <li><strong>FASE 5:</strong> Migração completa da interface</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default YumerV2Diagnostic;
