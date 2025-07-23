
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
import { useToast } from "@/hooks/use-toast";
import { useServerConfig } from "@/hooks/useServerConfig";
import InstanceStatusChecker from "./InstanceStatusChecker";

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
  const { config, apiUrl, headers } = useServerConfig();
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isRunningSequential, setIsRunningSequential] = useState(false);
  const [currentTestInstance, setCurrentTestInstance] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // ============ DEFINIÇÃO COMPLETA DOS ENDPOINTS YUMER API v2.2.1 ============
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
      description: 'Status público da API v2.2.1'
    },
    
    // 📱 Instance CRUD - API v2.2.1
    { 
      name: 'Create Instance', 
      url: '/instance/create', 
      method: 'POST', 
      category: 'instance',
      description: 'Criar nova instância',
      headers: headers,
      body: { instanceName: '', description: 'Test Instance from Diagnostic v2.2.1' }
    },
    { 
      name: 'Fetch All Instances', 
      url: '/instance/fetchInstances', 
      method: 'GET', 
      category: 'instance',
      description: 'Listar todas as instâncias',
      headers: headers
    },
    { 
      name: 'Fetch Single Instance', 
      url: '/instance/fetchInstance/{instance}', 
      method: 'GET', 
      category: 'instance',
      description: 'Buscar instância específica',
      headers: headers,
      requiresInstance: true
    },
    { 
      name: 'Update Instance', 
      url: '/instance/update/{instance}', 
      method: 'PATCH', 
      category: 'instance',
      description: 'Atualizar configurações da instância',
      headers: headers,
      requiresInstance: true,
      body: { description: 'Updated from Diagnostic v2.2.1' }
    },
    { 
      name: 'Delete Instance', 
      url: '/instance/delete/{instance}', 
      method: 'DELETE', 
      category: 'instance',
      description: 'Deletar instância',
      headers: headers,
      requiresInstance: true
    },
    
    // 🔗 Conexão e QR - API v2.2.1
    { 
      name: 'Connect Instance', 
      url: '/instance/connect/{instance}', 
      method: 'GET', 
      category: 'connection',
      description: 'Conectar instância e gerar QR code',
      headers: headers,
      requiresInstance: true
    },
    { 
      name: 'Connection State', 
      url: '/instance/connectionState/{instance}', 
      method: 'GET', 
      category: 'connection',
      description: 'Verificar estado da conexão',
      headers: headers,
      requiresInstance: true
    },
    { 
      name: 'QR Code Direct', 
      url: '/instance/qrcode/{instance}', 
      method: 'GET', 
      category: 'connection',
      description: 'Obter QR code diretamente',
      headers: headers,
      requiresInstance: true
    },
    { 
      name: 'Logout Instance', 
      url: '/instance/logout/{instance}', 
      method: 'DELETE', 
      category: 'connection',
      description: 'Desconectar instância',
      headers: headers,
      requiresInstance: true
    }
  ];

  const categories = {
    basic: { name: '🔧 Básicos v2.2.1', icon: Shield },
    instance: { name: '📱 Instâncias v2.2.1', icon: Database },
    connection: { name: '🔗 Conexão v2.2.1', icon: Network },
    webhook: { name: '🔔 Webhook v2.2.1', icon: Webhook },
    performance: { name: '⚡ Performance v2.2.1', icon: Activity }
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

  // Executar teste único usando configuração dinâmica
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
      let url = `${config.serverUrl}${endpoint.url}`;
      let finalInstanceName = instanceName;
      
      // Para testes que precisam de instância, garantir que temos uma disponível
      if (endpoint.requiresInstance) {
        // Se não foi fornecido instanceName ou é um placeholder
        if (!finalInstanceName || finalInstanceName === 'test_single') {
          try {
            console.log(`🔍 [API-TEST-v2.2.1] Buscando instâncias existentes para ${endpoint.name}...`);
            
            // Buscar instâncias existentes primeiro
            const instancesResponse = await fetch(`${config.serverUrl}/instance/fetchInstances`, {
              headers: { ...headers, 'Content-Type': 'application/json' }
            });
            
            if (instancesResponse.ok) {
              const instances = await instancesResponse.json();
              console.log(`📊 [API-TEST-v2.2.1] Resposta fetchInstances:`, instances);
              
              // Verificar se temos instâncias
              if (Array.isArray(instances) && instances.length > 0) {
                // Tentar diferentes campos para o nome da instância
                const firstInstance = instances[0];
                finalInstanceName = firstInstance.name || firstInstance.instanceName || firstInstance.id?.toString();
                console.log(`🎯 [API-TEST-v2.2.1] Usando instância existente: ${finalInstanceName}`);
              } else if (instances && typeof instances === 'object' && (instances.name || instances.instanceName || instances.id)) {
                // Se não for array, pode ser objeto único
                finalInstanceName = instances.name || instances.instanceName || instances.id?.toString();
                console.log(`🎯 [API-TEST-v2.2.1] Usando instância única: ${finalInstanceName}`);
              } else {
                console.log(`⚠️ [API-TEST-v2.2.1] Nenhuma instância encontrada:`, instances);
                // Se não há instâncias, vamos falhar com mensagem clara
                return {
                  status: 'warning',
                  message: 'Nenhuma instância disponível - crie uma instância primeiro',
                  details: { 
                    fetchInstancesResponse: instances,
                    suggestion: 'Use o endpoint "Create Instance" para criar uma instância primeiro'
                  },
                  duration: Date.now() - startTime,
                  endpoint: endpoint.url,
                  method: endpoint.method
                };
              }
            } else {
              console.warn(`⚠️ [API-TEST-v2.2.1] Erro ao buscar instâncias: ${instancesResponse.status}`);
              // Se busca falhou mas temos um nome, usar ele
              finalInstanceName = instanceName || 'default_instance';
            }
          } catch (error) {
            console.warn(`⚠️ [API-TEST-v2.2.1] Erro ao buscar instâncias existentes:`, error);
            // Se erro, usar o nome fornecido ou fallback
            finalInstanceName = instanceName || 'default_instance';
          }
        }
        
        // Validar se temos um nome válido de instância
        if (!finalInstanceName || finalInstanceName === 'test_single') {
          return {
            status: 'error',
            message: 'Falha ao obter nome de instância válido',
            details: { 
              error: 'Não foi possível determinar uma instância para usar no teste',
              providedInstanceName: instanceName,
              endpoint: endpoint.url
            },
            duration: Date.now() - startTime,
            endpoint: endpoint.url,
            method: endpoint.method
          };
        }
        
        // Substituir placeholder de instância
        url = url.replace('{instance}', finalInstanceName);
        console.log(`🔗 [API-TEST-v2.2.1] URL final: ${url}`);
      }

      // Preparar body para create instance
      let body = endpoint.body;
      if (endpoint.name === 'Create Instance' && finalInstanceName) {
        body = { 
          instanceName: finalInstanceName,
          description: `Test Instance v2.2.1: ${finalInstanceName}` 
        };
      }

      console.log(`🧪 [API-TEST-v2.2.1] ${endpoint.method} ${url}`, body ? { body } : '');

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

      // Análise inteligente dos resultados
      let status: TestResult['status'] = response.ok ? 'success' : 'error';
      let message = `${endpoint.method} ${response.status} - ${response.ok ? 'OK' : response.statusText}`;
      
      // Adicionar contexto específico para erros comuns
      if (!response.ok) {
        if (response.status === 403) {
          message += ' (Sem permissão - verificar API Key ou plano)';
        } else if (response.status === 400 && endpoint.requiresInstance) {
          message += ' (Instância não encontrada - usar instância existente)';
        } else if (response.status === 401) {
          message += ' (Não autorizado - verificar autenticação)';
        }
      }

      const result: TestResult = {
        status,
        message,
        details: { 
          status: response.status, 
          data: responseData,
          url: url,
          usedInstance: instanceName || 'N/A',
          apiVersion: 'v2.2.1'
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
        details: { error: error.message, url: `${config.serverUrl}${endpoint.url}`, apiVersion: 'v2.2.1' },
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
    
    const testInstanceName = `test_diagnostic_v221_${Date.now()}`;
    setCurrentTestInstance(testInstanceName);
    
    try {
      // Organizar endpoints por ordem de execução
      const basicEndpoints = endpoints.filter(e => e.category === 'basic');
      const instanceEndpoints = endpoints.filter(e => e.category === 'instance');
      const connectionEndpoints = endpoints.filter(e => e.category === 'connection');
      
      // Ordem específica para instâncias (criar primeiro, deletar por ÚLTIMO)
      const orderedInstanceEndpoints = [
        'Create Instance',
        'Fetch All Instances',
        'Fetch Single Instance',
        'Update Instance'
      ].map(name => instanceEndpoints.find(e => e.name === name)).filter(Boolean);
      
      // Ordem específica para conexão 
      const orderedConnectionEndpoints = [
        'Connect Instance',
        'Connection State', 
        'QR Code Direct',
        'Logout Instance'
      ].map(name => connectionEndpoints.find(e => e.name === name)).filter(Boolean);
      
      // Delete Instance deve ser o ÚLTIMO de todos
      const deleteEndpoint = instanceEndpoints.find(e => e.name === 'Delete Instance');
      
      // Sequência completa: Básicos → Instâncias → Conexão → Delete
      const allEndpoints = [
        ...basicEndpoints,
        ...orderedInstanceEndpoints,
        ...orderedConnectionEndpoints,
        ...(deleteEndpoint ? [deleteEndpoint] : [])
      ];
      
      console.log(`🔄 [SEQUENTIAL-v2.2.1] Iniciando teste sequencial com ${allEndpoints.length} endpoints`);
      console.log(`📝 [SEQUENTIAL-v2.2.1] Sequência:`, allEndpoints.map(e => `${e.category}/${e.name}`));

      for (let i = 0; i < allEndpoints.length; i++) {
        const endpoint = allEndpoints[i];
        
        console.log(`🔄 [SEQUENTIAL-v2.2.1] (${i+1}/${allEndpoints.length}) Executando: ${endpoint.category}/${endpoint.name}`);
        
        // Para endpoints básicos, não usar instanceName
        const instanceToUse = endpoint.category === 'basic' ? undefined : testInstanceName;
        
        const result = await executeTest(endpoint, instanceToUse);
        
        // Pausas estratégicas para operações que precisam de tempo
        if (['Create Instance', 'Connect Instance'].includes(endpoint.name)) {
          console.log(`⏱️ [SEQUENTIAL-v2.2.1] Aguardando 2s após ${endpoint.name}...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          // Pausa menor entre testes para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        setProgress(((i + 1) / allEndpoints.length) * 100);
        
        // Se criação da instância falhar, interromper teste
        if (endpoint.name === 'Create Instance' && result.status === 'error') {
          console.error(`❌ [SEQUENTIAL-v2.2.1] Falha crítica na criação da instância`);
          toast({
            title: "Teste Sequencial Interrompido",
            description: "Falha ao criar instância de teste - verificar API Key e permissões",
            variant: "destructive"
          });
          break;
        }
        
        // Se algum endpoint básico falhar, continuar mas avisar
        if (endpoint.category === 'basic' && result.status === 'error') {
          console.warn(`⚠️ [SEQUENTIAL-v2.2.1] Endpoint básico falhou: ${endpoint.name}`);
        }
      }

      const successCount = Object.values(testResults).filter(r => r.status === 'success').length;
      const errorCount = Object.values(testResults).filter(r => r.status === 'error').length;
      const warningCount = Object.values(testResults).filter(r => r.status === 'warning').length;

      toast({
        title: "Teste Sequencial Concluído",
        description: `✅ ${successCount} sucessos, ❌ ${errorCount} erros, ⚠️ ${warningCount} avisos`,
      });

      console.log(`🏁 [SEQUENTIAL-v2.2.1] Teste concluído: ${successCount}/${allEndpoints.length} sucessos`);

    } finally {
      setIsRunningSequential(false);
      setCurrentTestInstance('');
    }
  };

  // Teste de categoria específica
  const testCategory = async (category: string) => {
    const categoryEndpoints = endpoints.filter(e => e.category === category);
    
    // Para categoria de instâncias, primeiro verificar se há instâncias disponíveis
    let existingInstanceName = 'test_category_instance_v221';
    let hasInstances = false;
    
    if (category === 'instance') {
      try {
        console.log(`🔍 [CATEGORY-TEST-v2.2.1] Verificando instâncias disponíveis...`);
        
        const response = await fetch(`${config.serverUrl}/instance/fetchInstances`, {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const instances = await response.json();
          console.log(`📊 [CATEGORY-TEST-v2.2.1] Resposta fetchInstances:`, instances);
          
          if (Array.isArray(instances) && instances.length > 0) {
            const firstInstance = instances[0];
            existingInstanceName = firstInstance.name || firstInstance.instanceName || firstInstance.id?.toString();
            hasInstances = true;
            console.log(`🎯 [CATEGORY-TEST-v2.2.1] Usando instância existente: ${existingInstanceName}`);
          } else if (instances && typeof instances === 'object' && (instances.name || instances.instanceName)) {
            existingInstanceName = instances.name || instances.instanceName || instances.id?.toString();
            hasInstances = true;
            console.log(`🎯 [CATEGORY-TEST-v2.2.1] Usando instância única: ${existingInstanceName}`);
          } else {
            console.log(`⚠️ [CATEGORY-TEST-v2.2.1] Nenhuma instância encontrada`);
            hasInstances = false;
          }
        }
      } catch (error) {
        console.warn(`⚠️ [CATEGORY-TEST-v2.2.1] Erro ao buscar instâncias:`, error);
      }
    }
    
    for (const endpoint of categoryEndpoints) {
      if (endpoint.requiresInstance) {
        if (hasInstances || category !== 'instance') {
          await executeTest(endpoint, existingInstanceName);
        } else {
          // Se não há instâncias, marcar como warning em vez de tentar testar
          const testKey = `${endpoint.category}-${endpoint.name}`;
          setTestResults(prev => ({
            ...prev,
            [testKey]: {
              status: 'warning',
              message: 'Nenhuma instância disponível - crie uma instância primeiro',
              details: { suggestion: 'Use "Create Instance" antes de testar outros endpoints', apiVersion: 'v2.2.1' },
              endpoint: endpoint.url,
              method: endpoint.method
            }
          }));
        }
      } else {
        await executeTest(endpoint);
      }
      
      // Pequena pausa entre testes
      await new Promise(resolve => setTimeout(resolve, 500));
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
            📊 Diagnóstico Avançado da API YUMER v2.2.1
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
          <InstanceStatusChecker />
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-3 border rounded">
              <p className="text-sm font-medium">Servidor YUMER v2.2.1</p>
              <p className="text-xs text-muted-foreground">{config.serverUrl}</p>
            </div>
            <div className="p-3 border rounded">
              <p className="text-sm font-medium">API Key Global</p>
              <p className="text-xs text-muted-foreground">
                {config.globalApiKey ? '✅ Configurada' : '❌ Não configurada'}
              </p>
            </div>
            <div className="p-3 border rounded">
              <p className="text-sm font-medium">Endpoints v2.2.1</p>
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
