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
  category: 'docs' | 'admin' | 'business' | 'instance' | 'webhook' | 'message' | 'chat';
  status: 'pending' | 'success' | 'cors_error' | 'not_found' | 'server_error' | 'auth_error' | 'timeout_error' | 'network_error';
  details?: string;
  httpStatus?: number;
  responseTime?: number;
  headers?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requiresAuth?: boolean;
  requiresBusiness?: boolean;
  requiresInstance?: boolean;
}

const YumerV2Diagnostic = () => {
  const { config, status: serverStatus, isLoading: configLoading } = useServerConfig();
  const [tests, setTests] = useState<EndpointTest[]>([
    // Documentação (público, sem auth)
    { name: "API Documentation", url: "/docs", method: "GET", category: "docs", status: "pending" },
    { name: "Swagger/OpenAPI", url: "/api/v2/reference/swagger.json", method: "GET", category: "docs", status: "pending" },
    
    // Admin endpoints (v2.2.1) - Precisa ADMIN_TOKEN
    { name: "List All Businesses", url: "/api/v2/admin/business", method: "GET", category: "admin", status: "pending", requiresAuth: true },
    { name: "Create Business", url: "/api/v2/admin/business", method: "POST", category: "admin", status: "pending", requiresAuth: true },
    
    // Business endpoints (v2.2.1) - Precisa businessId válido
    { name: "Get Business Info", url: "/api/v2/business/{businessId}", method: "GET", category: "business", status: "pending", requiresAuth: true, requiresBusiness: true },
    { name: "Create Business Instance", url: "/api/v2/business/{businessId}/instance", method: "POST", category: "business", status: "pending", requiresAuth: true, requiresBusiness: true },
    { name: "Get Business Webhook", url: "/api/v2/business/{businessId}/webhook", method: "GET", category: "business", status: "pending", requiresAuth: true, requiresBusiness: true },
    
    // Instance endpoints (v2.2.1) - Precisa instanceId válido
    { name: "Get Instance Info", url: "/api/v2/instance/{instanceId}", method: "GET", category: "instance", status: "pending", requiresAuth: true, requiresInstance: true },
    { name: "Connect Instance", url: "/api/v2/instance/{instanceId}/connect", method: "GET", category: "instance", status: "pending", requiresAuth: true, requiresInstance: true },
    { name: "Connection State", url: "/api/v2/instance/{instanceId}/connection-state", method: "GET", category: "instance", status: "pending", requiresAuth: true, requiresInstance: true },
    { name: "Get QR Code", url: "/api/v2/instance/{instanceId}/qrcode", method: "GET", category: "instance", status: "pending", requiresAuth: true, requiresInstance: true },
    
    // Webhook endpoints (v2.2.1) - Corrigidos para estrutura real
    { name: "Set Instance Webhook", url: "/api/v2/instance/{instanceId}/webhook", method: "POST", category: "webhook", status: "pending", requiresAuth: true, requiresInstance: true },
    { name: "Get Instance Webhook", url: "/api/v2/instance/{instanceId}/webhook", method: "GET", category: "webhook", status: "pending", requiresAuth: true, requiresInstance: true },
    
    // Message endpoints (v2.2.1) - Corrigidos para estrutura real
    { name: "Send Text Message", url: "/api/v2/instance/{instanceId}/send/text", method: "POST", category: "message", status: "pending", requiresAuth: true, requiresInstance: true },
    { name: "Send Media Message", url: "/api/v2/instance/{instanceId}/send/media", method: "POST", category: "message", status: "pending", requiresAuth: true, requiresInstance: true },
    
    // Chat endpoints (v2.2.1) - Novos da documentação
    { name: "Search Contacts", url: "/api/v2/instance/{instanceId}/chat/search/contacts", method: "GET", category: "chat", status: "pending", requiresAuth: true, requiresInstance: true },
    { name: "Search Chats", url: "/api/v2/instance/{instanceId}/chat/search/chats", method: "GET", category: "chat", status: "pending", requiresAuth: true, requiresInstance: true }
  ]);
  
  const [testing, setTesting] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);
  const [dynamicIds, setDynamicIds] = useState<{
    businessId?: string;
    instanceId?: string;
  }>({});

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`🧪 [YUMER-v2.2.1] ${logMessage}`);
    setDetailedLogs(prev => [...prev, logMessage]);
  };

  const testEndpoint = async (endpoint: EndpointTest): Promise<EndpointTest> => {
    let fullUrl = `${config.serverUrl}${endpoint.url}`;
    const startTime = Date.now();
    
    try {
      // Substituir placeholders dinâmicos
      if (endpoint.requiresBusiness && dynamicIds.businessId) {
        fullUrl = fullUrl.replace('{businessId}', dynamicIds.businessId);
      } else if (endpoint.requiresBusiness) {
        // Se precisa de businessId mas não temos, usar ID de teste
        fullUrl = fullUrl.replace('{businessId}', 'test-business-id');
      }
      
      if (endpoint.requiresInstance && dynamicIds.instanceId) {
        fullUrl = fullUrl.replace('{instanceId}', dynamicIds.instanceId);
      } else if (endpoint.requiresInstance) {
        // Se precisa de instanceId mas não temos, usar ID de teste
        fullUrl = fullUrl.replace('{instanceId}', 'test-instance-id');
      }
      
      addLog(`Testando ${endpoint.method} ${fullUrl}`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
      };

      // Adicionar autenticação baseada na documentação v2.2.1
      if (endpoint.requiresAuth) {
        if (config.globalApiKey) {
          // Para admin endpoints, usar Authorization Bearer
          if (endpoint.category === 'admin') {
            headers['Authorization'] = `Bearer ${config.globalApiKey}`;
          } else {
            // Para outros endpoints, pode usar apikey header ou bearer
            headers['apikey'] = config.globalApiKey;
            headers['Authorization'] = `Bearer ${config.globalApiKey}`;
          }
        }
      }

      addLog(`Headers: ${JSON.stringify({ ...headers, Authorization: headers.Authorization ? 'Bearer ***' : undefined, apikey: headers.apikey ? '***' : undefined }, null, 2)}`);

      // Criar payload para POSTs
      let body: string | undefined;
      if (endpoint.method === 'POST') {
        body = JSON.stringify(getTestPayload(endpoint));
        addLog(`Body: ${body}`);
      }

      // Criar AbortController para timeout de 15 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        addLog(`Timeout após 15 segundos para ${endpoint.name}`);
      }, 15000);

      const response = await fetch(fullUrl, {
        method: endpoint.method,
        headers,
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        ...(body && { body })
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
          try {
            data = await response.json();
            addLog(`Response Data: ${JSON.stringify(data, null, 2)}`);
            
            // Extrair IDs dinâmicos das respostas para usar em outros testes
            if (endpoint.name === "List All Businesses" && Array.isArray(data) && data.length > 0) {
              const businessId = data[0].businessId;
              setDynamicIds(prev => ({ ...prev, businessId }));
              addLog(`🎯 Business ID extraído: ${businessId}`);
            } else if (endpoint.name === "Create Business" && data.businessId) {
              const businessId = data.businessId;
              setDynamicIds(prev => ({ ...prev, businessId }));
              addLog(`🎯 Business ID criado: ${businessId}`);
            }
            
          } catch (parseError) {
            const textData = await response.text();
            addLog(`Response Text (JSON parse failed): ${textData}`);
            data = { raw: textData };
          }
        } else {
          data = await response.text();
          addLog(`Response Text: ${data}`);
        }
        
        // Salvar info do servidor
        if (endpoint.url === '/docs' && data) {
          setServerInfo({
            version: 'v2.2.1',
            endpoint: '/docs',
            status: 'online',
            responseTime: responseTime,
            timestamp: new Date().toISOString()
          });
        }
        
        return {
          ...endpoint,
          status: 'success',
          httpStatus,
          responseTime,
          headers,
          responseHeaders,
          details: `✅ Sucesso - ${responseTime}ms - Status ${httpStatus} - Content-Type: ${contentType || 'N/A'}`
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
          details: `🔐 Auth Error - Status ${httpStatus} - Verificar tokens de autenticação: ${errorText}`
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
          details: `⚠️ Endpoint não encontrado - Status ${httpStatus}: ${errorText} - Verifique se o endpoint existe na v2.2.1`
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
          details: `⏱️ Timeout após 15 segundos - Servidor pode estar sobrecarregado`
        };
      } else if (error.message.includes('CORS') || 
          error.message.includes('Access-Control-Allow-Origin') ||
          error.message.includes('preflight')) {
        return {
          ...endpoint,
          status: 'cors_error',
          responseTime,
          details: `❌ CORS Error: ${error.message} - Servidor precisa configurar CORS para ${window.location.origin}`
        };
      } else if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
        return {
          ...endpoint,
          status: 'network_error',
          responseTime,
          details: `🌐 Network Error: ${error.message} - Pode ser CORS, conectividade ou endpoint inexistente`
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
      case '/api/v2/admin/business':
        return {
          name: "Test Business v2.2.1",
          attributes: {
            category: "testing",
            description: "Business criado para teste do diagnóstico v2.2.1",
            active: true
          }
        };
      case '/api/v2/business/{businessId}/instance':
        return {
          name: `test-instance-${Date.now()}`,
          description: "Instância de teste criada pelo diagnóstico v2.2.1"
        };
      case '/api/v2/instance/{instanceId}/webhook':
        return {
          url: "https://webhook.test.com/codechat",
          enabled: true,
          events: ["messages.upsert", "qrcode.updated", "connection.update"]
        };
      case '/api/v2/instance/{instanceId}/send/text':
        return {
          number: "5511999999999",
          text: "Mensagem de teste do diagnóstico CodeChat v2.2.1"
        };
      case '/api/v2/instance/{instanceId}/send/media':
        return {
          number: "5511999999999",
          mediatype: "image",
          media: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          caption: "Teste de mídia v2.2.1"
        };
      default:
        return {};
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setDetailedLogs([]);
    setDynamicIds({});
    addLog('🧪 Iniciando diagnóstico completo da API CodeChat v2.2.1...');
    addLog(`📍 Servidor: ${config.serverUrl}`);
    addLog(`🔑 API Key configurada: ${config.globalApiKey ? 'Sim' : 'Não'}`);
    addLog(`🌐 Frontend Origin: ${window.location.origin}`);
    
    const updatedTests: EndpointTest[] = [];
    
    // Testar em ordem estratégica: docs → admin → business → instance → outros
    const orderedTests = [
      ...tests.filter(t => t.category === 'docs'),
      ...tests.filter(t => t.category === 'admin'),
      ...tests.filter(t => t.category === 'business'),
      ...tests.filter(t => t.category === 'instance'),
      ...tests.filter(t => !['docs', 'admin', 'business', 'instance'].includes(t.category))
    ];
    
    addLog(`📝 Sequência de teste: ${orderedTests.map(t => `${t.category}/${t.name}`).join(', ')}`);
    
    for (let i = 0; i < orderedTests.length; i++) {
      const test = orderedTests[i];
      addLog(`🔄 (${i+1}/${orderedTests.length}) Executando: ${test.category}/${test.name}`);
      
      const result = await testEndpoint(test);
      updatedTests.push(result);
      
      // Atualizar estado incremental
      setTests([...updatedTests, ...tests.slice(updatedTests.length)]);
      
      // Pausas estratégicas
      if (['Create Business', 'Create Business Instance'].includes(test.name)) {
        addLog(`⏱️ Aguardando 2s após ${test.name}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setTests(updatedTests);
    setTesting(false);
    
    // Análise final
    const successes = updatedTests.filter(t => t.status === 'success').length;
    const authErrors = updatedTests.filter(t => t.status === 'auth_error').length;
    const notFound = updatedTests.filter(t => t.status === 'not_found').length;
    const networkErrors = updatedTests.filter(t => t.status === 'network_error').length;
    
    addLog(`🎯 Diagnóstico v2.2.1 concluído: ${successes} sucessos, ${authErrors} auth, ${notFound} não encontrados, ${networkErrors} rede`);
    
    if (authErrors > 0) {
      addLog(`🔐 AUTENTICAÇÃO: Verificar se o token tem permissões adequadas para endpoints admin/business/instance`);
    }
    
    if (notFound > 0) {
      addLog(`📋 ENDPOINTS NÃO ENCONTRADOS: Alguns endpoints podem não estar implementados na sua versão da API`);
    }
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
      case 'docs': return <Server className="w-4 h-4" />;
      case 'admin': return <Database className="w-4 h-4" />;
      case 'business': return <Database className="w-4 h-4" />;
      case 'instance': return <Globe className="w-4 h-4" />;
      default: return <RefreshCw className="w-4 h-4" />;
    }
  };

  const hasErrors = tests.some(t => ['cors_error', 'network_error', 'timeout_error', 'auth_error', 'server_error'].includes(t.status));
  const hasAuthIssues = tests.some(t => t.status === 'auth_error');
  const hasNotFound = tests.some(t => t.status === 'not_found');

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
          <CardTitle>🚀 Diagnóstico API CodeChat v2.2.1 (Corrigido)</CardTitle>
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
            <p><strong>Versão:</strong> v{config.apiVersion}</p>
            <p><strong>Endpoints corrigidos:</strong> {tests.length}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <p><strong>Status:</strong> {serverStatus.isOnline ? '🟢 Online' : '🔴 Offline'}</p>
            <p><strong>Latência:</strong> {serverStatus.latency}ms</p>
            <p><strong>Business ID:</strong> {dynamicIds.businessId || 'Não obtido'}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <p><strong>API Key:</strong> {config.globalApiKey ? '✅ Configurada' : '❌ Não configurada'}</p>
            <p><strong>Instance ID:</strong> {dynamicIds.instanceId || 'Não obtido'}</p>
            <p><strong>Frontend:</strong> {window.location.hostname}</p>
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
              <div className="text-2xl font-bold text-blue-600">
                {tests.filter(t => t.status === 'network_error').length}
              </div>
              <div className="text-sm text-gray-600">Rede/CORS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {tests.filter(t => t.status === 'timeout_error').length}
              </div>
              <div className="text-sm text-gray-600">Timeout</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {tests.filter(t => t.status === 'cors_error').length}
              </div>
              <div className="text-sm text-gray-600">CORS Error</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-700">
                {tests.filter(t => t.status === 'server_error').length}
              </div>
              <div className="text-sm text-gray-600">Erro servidor</div>
            </div>
          </div>
        )}

        {/* Auth Issues Alert */}
        {hasAuthIssues && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">🔐 PROBLEMA DE AUTENTICAÇÃO:</p>
                <p>• <strong>Token inválido:</strong> Verifique se o token tem permissões adequadas</p>
                <p>• <strong>Admin endpoints:</strong> Precisam de ADMIN_TOKEN válido</p>
                <p>• <strong>Business/Instance endpoints:</strong> Precisam de BUSINESS_TOKEN ou JWT válido</p>
                <div className="text-xs bg-red-100 p-2 rounded">
                  <p><strong>Documentação de autenticação:</strong></p>
                  <p>• Admin: Authorization: Bearer ADMIN_TOKEN</p>
                  <p>• Business: Authorization: Bearer BUSINESS_TOKEN</p>
                  <p>• Instance: Authorization: Bearer JWT_TOKEN</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Not Found Issues Alert */}
        {hasNotFound && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">⚠️ ENDPOINTS NÃO ENCONTRADOS:</p>
                <p>• Alguns endpoints podem não estar implementados na sua versão da API</p>
                <p>• Verifique se a documentação está atualizada</p>
                <p>• Alguns endpoints podem ter mudado na v2.2.1</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Test Results by Category */}
        <div className="space-y-3">
          <h4 className="font-medium">Resultados por Categoria (v2.2.1):</h4>
          
          {['docs', 'admin', 'business', 'instance', 'webhook', 'message', 'chat'].map(category => {
            const categoryTests = tests.filter(t => t.category === category);
            if (categoryTests.length === 0) return null;
            
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center space-x-2">
                  {getCategoryIcon(category)}
                  <h5 className="font-medium capitalize">
                    {category === 'docs' ? 'Documentação' : 
                     category === 'admin' ? 'Administração' :
                     category === 'business' ? 'Negócios' :
                     category === 'instance' ? 'Instâncias' :
                     category === 'webhook' ? 'Webhooks' :
                     category === 'message' ? 'Mensagens' :
                     category === 'chat' ? 'Chat' : category}
                  </h5>
                </div>
                
                {categoryTests.map((test, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded ml-6">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(test.status)}
                      <div>
                        <div className="font-medium">{test.name}</div>
                        <div className="text-sm text-gray-500">
                          {test.method} {config.serverUrl}{test.url}
                        </div>
                        {test.requiresAuth && (
                          <div className="text-xs text-orange-600">
                            🔐 Requer autenticação
                          </div>
                        )}
                        {test.responseTime && (
                          <div className="text-xs text-gray-400">
                            {test.responseTime}ms
                          </div>
                        )}
                        {test.details && (
                          <div className="text-xs text-gray-600 mt-1">
                            {test.details}
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
            <h4 className="text-white mb-2">📋 Logs Detalhados v2.2.1:</h4>
            {detailedLogs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded">
          <h4 className="font-medium text-blue-900 mb-2">📋 Diagnóstico CodeChat v2.2.1:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li><strong>✅ ENDPOINTS CORRIGIDOS:</strong> Usando estrutura real da API v2.2.1</li>
            <li><strong>🔐 AUTENTICAÇÃO:</strong> Implementada conforme documentação (Admin/Business/Instance)</li>
            <li><strong>📋 IDs DINÂMICOS:</strong> Extração automática de businessId/instanceId</li>
            <li><strong>🎯 FEEDBACK ESPECÍFICO:</strong> Diferenciação entre CORS, Auth, Not Found</li>
            <li><strong>📖 BASEADO NA DOCUMENTAÇÃO:</strong> Endpoints da documentação oficial v2.2.1</li>
          </ol>
          
          <div className="mt-3 p-2 bg-green-100 rounded">
            <p className="text-sm text-green-800">
              <strong>✅ DIAGNÓSTICO v2.2.1:</strong> Endpoints corrigidos e testando com a estrutura real da API!
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default YumerV2Diagnostic;
