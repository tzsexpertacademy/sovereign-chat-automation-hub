import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  Server, 
  Shield, 
  Network, 
  Database,
  Webhook,
  Users,
  QrCode,
  Activity,
  Trash2,
  RefreshCw,
  Eye,
  Settings
} from "lucide-react";
import { SERVER_URL, getYumerGlobalApiKey } from "@/config/environment";
import { useToast } from "@/hooks/use-toast";

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  duration?: number;
  endpoint?: string;
  method?: string;
}

interface ApiEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  category: string;
  description: string;
  headers?: Record<string, string>;
  body?: any;
  requiresInstance?: boolean;
}

const AdvancedApiDiagnostic = () => {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isRunningSequential, setIsRunningSequential] = useState(false);
  const [currentTestInstance, setCurrentTestInstance] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const apiKey = getYumerGlobalApiKey();

  // ============ DEFINIÇÃO COMPLETA DOS ENDPOINTS YUMER ============
  const endpoints: ApiEndpoint[] = [
    // 🔧 Básicos
    { 
      name: 'Health Check', 
      url: '/health', 
      method: 'GET', 
      category: 'basic',
      description: 'Verificar se servidor está online'
    },
    { 
      name: 'Status Público', 
      url: '/', 
      method: 'GET', 
      category: 'basic',
      description: 'Status público da API'
    },
    
    // 📱 Instance CRUD
    { 
      name: 'Create Instance', 
      url: '/instance/create', 
      method: 'POST', 
      category: 'instance',
      description: 'Criar nova instância',
      headers: { 'apikey': apiKey || '' },
      body: { instanceName: '', description: 'Test Instance from Diagnostic' }
    },
    { 
      name: 'Fetch All Instances', 
      url: '/instance/fetchInstances', 
      method: 'GET', 
      category: 'instance',
      description: 'Listar todas as instâncias',
      headers: { 'apikey': apiKey || '' }
    },
    { 
      name: 'Fetch Single Instance', 
      url: '/instance/fetchInstance/{instance}', 
      method: 'GET', 
      category: 'instance',
      description: 'Buscar instância específica',
      headers: { 'apikey': apiKey || '' },
      requiresInstance: true
    },
    { 
      name: 'Update Instance', 
      url: '/instance/update/{instance}', 
      method: 'PATCH', 
      category: 'instance',
      description: 'Atualizar configurações da instância',
      headers: { 'apikey': apiKey || '' },
      requiresInstance: true,
      body: { description: 'Updated from Diagnostic' }
    },
    { 
      name: 'Delete Instance', 
      url: '/instance/delete/{instance}', 
      method: 'DELETE', 
      category: 'instance',
      description: 'Deletar instância',
      headers: { 'apikey': apiKey || '' },
      requiresInstance: true
    },
    
    // 🔗 Conexão e QR
    { 
      name: 'Connect Instance', 
      url: '/instance/connect/{instance}', 
      method: 'GET', 
      category: 'connection',
      description: 'Conectar instância e gerar QR code',
      headers: { 'apikey': apiKey || '' },
      requiresInstance: true
    },
    { 
      name: 'Connection State', 
      url: '/instance/connectionState/{instance}', 
      method: 'GET', 
      category: 'connection',
      description: 'Verificar estado da conexão',
      headers: { 'apikey': apiKey || '' },
      requiresInstance: true
    },
    { 
      name: 'QR Code Direct', 
      url: '/instance/qrcode/{instance}', 
      method: 'GET', 
      category: 'connection',
      description: 'Obter QR code diretamente',
      headers: { 'apikey': apiKey || '' },
      requiresInstance: true
    },
    { 
      name: 'Logout Instance', 
      url: '/instance/logout/{instance}', 
      method: 'DELETE', 
      category: 'connection',
      description: 'Desconectar instância',
      headers: { 'apikey': apiKey || '' },
      requiresInstance: true
    }
  ];

  const categories = {
    basic: { name: '🔧 Básicos', icon: Shield },
    instance: { name: '📱 Instâncias', icon: Database },
    connection: { name: '🔗 Conexão', icon: Network },
    webhook: { name: '🔔 Webhook', icon: Webhook },
    performance: { name: '⚡ Performance', icon: Activity }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'testing': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default: return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500">Sucesso</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      case 'warning': return <Badge className="bg-yellow-500">Atenção</Badge>;
      case 'testing': return <Badge variant="secondary">Testando...</Badge>;
      default: return <Badge variant="outline">Não testado</Badge>;
    }
  };

  // Executar teste único
  const executeTest = async (endpoint: ApiEndpoint, instanceName?: string): Promise<TestResult> => {
    const startTime = Date.now();
    const testKey = `${endpoint.category}-${endpoint.name}`;
    
    // Marcar como testing
    setTestResults(prev => ({
      ...prev,
      [testKey]: { 
        status: 'testing', 
        message: 'Executando...', 
        endpoint: endpoint.url,
        method: endpoint.method 
      }
    }));

    try {
      let url = `${SERVER_URL}${endpoint.url}`;
      
      // Substituir placeholder de instância
      if (endpoint.requiresInstance && instanceName) {
        url = url.replace('{instance}', instanceName);
      }

      // Preparar body para create instance
      let body = endpoint.body;
      if (endpoint.name === 'Create Instance' && instanceName) {
        body = { 
          instanceName: instanceName,
          description: `Test Instance: ${instanceName}` 
        };
      }

      console.log(`🧪 [API-TEST] ${endpoint.method} ${url}`, body ? { body } : '');

      const response = await fetch(url, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          ...endpoint.headers
        },
        body: body ? JSON.stringify(body) : undefined,
        mode: 'cors'
      });

      const duration = Date.now() - startTime;
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      const result: TestResult = {
        status: response.ok ? 'success' : 'error',
        message: `${endpoint.method} ${response.status} - ${response.ok ? 'OK' : response.statusText}`,
        details: { 
          status: response.status, 
          data: responseData,
          url: url 
        },
        duration,
        endpoint: endpoint.url,
        method: endpoint.method
      };

      setTestResults(prev => ({ ...prev, [testKey]: result }));
      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        status: 'error',
        message: `Erro: ${error.message}`,
        details: { error: error.message },
        duration,
        endpoint: endpoint.url,
        method: endpoint.method
      };

      setTestResults(prev => ({ ...prev, [testKey]: result }));
      return result;
    }
  };

  // Teste sequencial completo
  const runSequentialTest = async () => {
    setIsRunningSequential(true);
    setProgress(0);
    
    const testInstanceName = `test_diagnostic_${Date.now()}`;
    setCurrentTestInstance(testInstanceName);
    
    try {
      const sequentialEndpoints = [
        'Create Instance',
        'Fetch Single Instance', 
        'Update Instance',
        'Connect Instance',
        'Connection State',
        'QR Code Direct',
        'Logout Instance',
        'Delete Instance'
      ];

      for (let i = 0; i < sequentialEndpoints.length; i++) {
        const endpointName = sequentialEndpoints[i];
        const endpoint = endpoints.find(e => e.name === endpointName);
        
        if (endpoint) {
          console.log(`🔄 [SEQUENTIAL] Executando: ${endpointName}`);
          
          const result = await executeTest(endpoint, testInstanceName);
          
          // Para alguns endpoints, aguardar um pouco
          if (['Create Instance', 'Connect Instance'].includes(endpointName)) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          setProgress(((i + 1) / sequentialEndpoints.length) * 100);
          
          // Se criação falhar, parar o teste
          if (endpointName === 'Create Instance' && result.status === 'error') {
            toast({
              title: "Teste Sequencial Interrompido",
              description: "Falha ao criar instância de teste",
              variant: "destructive"
            });
            break;
          }
        }
      }

      toast({
        title: "Teste Sequencial Concluído",
        description: `Testados ${sequentialEndpoints.length} endpoints`,
      });

    } finally {
      setIsRunningSequential(false);
      setCurrentTestInstance('');
    }
  };

  // Teste de categoria específica
  const testCategory = async (category: string) => {
    const categoryEndpoints = endpoints.filter(e => e.category === category);
    
    for (const endpoint of categoryEndpoints) {
      if (endpoint.requiresInstance) {
        // Para endpoints que precisam de instância, usar uma fake
        await executeTest(endpoint, 'test_category_instance');
      } else {
        await executeTest(endpoint);
      }
    }
  };

  // Limpar todos os resultados
  const clearResults = () => {
    setTestResults({});
    setProgress(0);
  };

  // Renderizar resultado de teste
  const renderTestResult = (endpoint: ApiEndpoint) => {
    const testKey = `${endpoint.category}-${endpoint.name}`;
    const result = testResults[testKey];
    
    return (
      <div key={testKey} className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(result?.status || 'idle')}
            <div>
              <h4 className="font-medium">{endpoint.name}</h4>
              <p className="text-sm text-muted-foreground">
                {endpoint.method} {endpoint.url}
              </p>
              <p className="text-xs text-muted-foreground">{endpoint.description}</p>
            </div>
          </div>
          <div className="text-right">
            {getStatusBadge(result?.status || 'idle')}
            {result?.duration && (
              <p className="text-xs text-muted-foreground mt-1">
                {result.duration}ms
              </p>
            )}
          </div>
        </div>
        
        {result?.message && (
          <div className="text-sm">
            <span className={
              result.status === 'success' ? 'text-green-600' :
              result.status === 'error' ? 'text-red-600' :
              result.status === 'warning' ? 'text-yellow-600' :
              'text-gray-600'
            }>
              {result.message}
            </span>
          </div>
        )}
        
        {result?.details && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Ver detalhes</summary>
            <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          </details>
        )}
        
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => executeTest(endpoint, endpoint.requiresInstance ? 'test_single' : undefined)}
          disabled={result?.status === 'testing'}
        >
          {result?.status === 'testing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Testar
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            📊 Diagnóstico Avançado da API YUMER
            <div className="flex space-x-2">
              <Button onClick={clearResults} variant="outline" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar
              </Button>
              <Button 
                onClick={runSequentialTest} 
                disabled={isRunningSequential}
                size="sm"
              >
                {isRunningSequential ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 mr-2" />
                    Teste Sequencial
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
          {isRunningSequential && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Testando: {currentTestInstance}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-3 border rounded">
              <p className="text-sm font-medium">Servidor YUMER</p>
              <p className="text-xs text-muted-foreground">{SERVER_URL}</p>
            </div>
            <div className="p-3 border rounded">
              <p className="text-sm font-medium">API Key</p>
              <p className="text-xs text-muted-foreground">
                {apiKey ? '✅ Configurada' : '❌ Não configurada'}
              </p>
            </div>
            <div className="p-3 border rounded">
              <p className="text-sm font-medium">Endpoints</p>
              <p className="text-xs text-muted-foreground">{endpoints.length} mapeados</p>
            </div>
          </div>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              {Object.entries(categories).map(([key, category]) => (
                <TabsTrigger key={key} value={key} className="flex items-center space-x-2">
                  <category.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{category.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(categories).map(([key, category]) => (
              <TabsContent key={key} value={key} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center space-x-2">
                        <category.icon className="w-5 h-5" />
                        <span>{category.name}</span>
                      </div>
                      <Button 
                        onClick={() => testCategory(key)} 
                        size="sm"
                        variant="outline"
                      >
                        Testar Categoria
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {endpoints
                        .filter(endpoint => endpoint.category === key)
                        .map(endpoint => renderTestResult(endpoint))
                      }
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedApiDiagnostic;