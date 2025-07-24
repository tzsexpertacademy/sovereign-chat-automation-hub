import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Play, 
  PlayCircle, 
  Square, 
  RefreshCw, 
  ExternalLink, 
  Book, 
  TestTube, 
  Activity, 
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  ChevronDown,
  ChevronRight,
  Settings,
  BarChart3,
  FileText,
  Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useServerConfig } from '@/hooks/useServerConfig';

interface TestResult {
  endpoint: string;
  status: 'success' | 'error' | 'pending' | 'skipped';
  message: string;
  duration?: number;
  timestamp?: number;
  details?: any;
  response?: any;
  error?: string;
}

interface ApiEndpoint {
  name: string;
  url: string;
  method: string;
  category: string;
  description: string;
  requiresAuth: boolean;
  requiresBusinessId?: boolean;
  requiresInstanceId?: boolean;
  payload?: any;
  dependencies?: string[];
}

const ApiCodechat = () => {
  const { toast } = useToast();
  const { config, isServerOnline, apiUrl } = useServerConfig();
  
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult }>({});
  const [isSequentialRunning, setIsSequentialRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [diagnosticState, setDiagnosticState] = useState({
    createdBusinessId: null as string | null,
    createdInstanceId: null as string | null,
    businessToken: null as string | null,
    instanceToken: null as string | null
  });

  // Definição completa dos endpoints da API CodeChat v2.2.1
  const endpoints: ApiEndpoint[] = [
    // Documentação
    {
      name: 'API Documentation',
      url: '/docs',
      method: 'GET',
      category: 'docs',
      description: 'Documentação da API CodeChat',
      requiresAuth: false
    },
    {
      name: 'Health Check',
      url: '/health',
      method: 'GET', 
      category: 'docs',
      description: 'Verificação de saúde do servidor',
      requiresAuth: false
    },
    
    // Admin
    {
      name: 'Create API Key',
      url: '/admin/api-key',
      method: 'POST',
      category: 'admin',
      description: 'Criar nova chave de API',
      requiresAuth: true,
      payload: { name: 'Test API Key' }
    },
    {
      name: 'List API Keys',
      url: '/admin/api-key',
      method: 'GET',
      category: 'admin',
      description: 'Listar chaves de API existentes',
      requiresAuth: true
    },
    
    // Business
    {
      name: 'List Businesses',
      url: '/business',
      method: 'GET',
      category: 'business',
      description: 'Listar todas as empresas',
      requiresAuth: true
    },
    {
      name: 'Create Business',
      url: '/business',
      method: 'POST',
      category: 'business',
      description: 'Criar nova empresa',
      requiresAuth: true,
      payload: { 
        name: 'Test Business',
        description: 'Empresa criada para testes' 
      }
    },
    {
      name: 'Get Business',
      url: '/business/{businessId}',
      method: 'GET',
      category: 'business',
      description: 'Obter detalhes de uma empresa específica',
      requiresAuth: true,
      requiresBusinessId: true,
      dependencies: ['Create Business']
    },
    
    // Instances
    {
      name: 'List Instances',
      url: '/business/{businessId}/instance',
      method: 'GET',
      category: 'instance',
      description: 'Listar instâncias de uma empresa',
      requiresAuth: true,
      requiresBusinessId: true,
      dependencies: ['Create Business']
    },
    {
      name: 'Create Instance',
      url: '/business/{businessId}/instance',
      method: 'POST',
      category: 'instance', 
      description: 'Criar nova instância WhatsApp',
      requiresAuth: true,
      requiresBusinessId: true,
      dependencies: ['Create Business'],
      payload: {
        instanceName: 'test-instance',
        token: 'test-token-123'
      }
    },
    {
      name: 'Get Instance',
      url: '/business/{businessId}/instance/{instanceName}',
      method: 'GET',
      category: 'instance',
      description: 'Obter detalhes de uma instância',
      requiresAuth: true,
      requiresBusinessId: true,
      requiresInstanceId: true,
      dependencies: ['Create Business', 'Create Instance']
    },
    {
      name: 'Connect Instance',
      url: '/business/{businessId}/instance/{instanceName}/connect',
      method: 'POST',
      category: 'instance',
      description: 'Conectar instância WhatsApp',
      requiresAuth: true,
      requiresBusinessId: true,
      requiresInstanceId: true,
      dependencies: ['Create Business', 'Create Instance']
    },
    {
      name: 'Get QR Code',
      url: '/business/{businessId}/instance/{instanceName}/connect/qr',
      method: 'GET',
      category: 'instance',
      description: 'Obter código QR para conexão',
      requiresAuth: true,
      requiresBusinessId: true,
      requiresInstanceId: true,
      dependencies: ['Create Business', 'Create Instance']
    },
    
    // Messages
    {
      name: 'Send Text Message',
      url: '/business/{businessId}/instance/{instanceName}/message/text',
      method: 'POST',
      category: 'message',
      description: 'Enviar mensagem de texto',
      requiresAuth: true,
      requiresBusinessId: true,
      requiresInstanceId: true,
      dependencies: ['Create Business', 'Create Instance'],
      payload: {
        number: '5511999999999',
        text: 'Mensagem de teste da API'
      }
    },
    {
      name: 'Send Media Message',
      url: '/business/{businessId}/instance/{instanceName}/message/media',
      method: 'POST',
      category: 'message',
      description: 'Enviar mensagem com mídia',
      requiresAuth: true,
      requiresBusinessId: true,
      requiresInstanceId: true,
      dependencies: ['Create Business', 'Create Instance'],
      payload: {
        number: '5511999999999',
        mediatype: 'image',
        media: 'https://via.placeholder.com/300x200.png',
        caption: 'Imagem de teste'
      }
    },
    
    // Chat
    {
      name: 'Find Chats',
      url: '/business/{businessId}/instance/{instanceName}/chat/find',
      method: 'GET',
      category: 'chat',
      description: 'Buscar conversas',
      requiresAuth: true,
      requiresBusinessId: true,
      requiresInstanceId: true,
      dependencies: ['Create Business', 'Create Instance']
    },
    {
      name: 'Find Messages',
      url: '/business/{businessId}/instance/{instanceName}/chat/findMessages',
      method: 'POST',
      category: 'chat',
      description: 'Buscar mensagens',
      requiresAuth: true,
      requiresBusinessId: true,
      requiresInstanceId: true,
      dependencies: ['Create Business', 'Create Instance'],
      payload: {
        where: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net'
          }
        }
      }
    }
  ];

  const categories = {
    docs: { name: 'Documentação', icon: Book },
    admin: { name: 'Administração', icon: Settings },
    business: { name: 'Empresas', icon: BarChart3 },
    instance: { name: 'Instâncias', icon: Activity },
    message: { name: 'Mensagens', icon: FileText },
    chat: { name: 'Conversas', icon: Globe }
  };

  useEffect(() => {
    // Auto-refresh ao carregar a página
    if (isServerOnline) {
      checkServerHealth();
    }
  }, [isServerOnline]);

  const checkServerHealth = async () => {
    try {
      const healthEndpoint = endpoints.find(e => e.name === 'Health Check');
      if (healthEndpoint) {
        await executeTest(healthEndpoint);
      }
    } catch (error) {
      console.error('Erro ao verificar saúde do servidor:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending': return <Clock className="h-4 w-4 text-warning animate-pulse" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      success: "default",
      error: "destructive", 
      pending: "secondary",
      skipped: "outline"
    };
    
    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'apikey': config.globalApiKey || ''
    };
  };

  const buildEndpointUrl = (endpoint: ApiEndpoint, localState: any = diagnosticState) => {
    let url = apiUrl + endpoint.url;
    
    if (endpoint.requiresBusinessId && localState.createdBusinessId) {
      url = url.replace('{businessId}', localState.createdBusinessId);
    }
    
    if (endpoint.requiresInstanceId && localState.createdInstanceId) {
      url = url.replace('{instanceName}', localState.createdInstanceId);
    }
    
    return url;
  };

  const executeTest = async (endpoint: ApiEndpoint, localState: any = diagnosticState) => {
    const testKey = endpoint.name;
    
    setTestResults(prev => ({
      ...prev,
      [testKey]: {
        endpoint: endpoint.name,
        status: 'pending',
        message: 'Executando teste...'
      }
    }));

    const startTime = Date.now();
    
    try {
      const url = buildEndpointUrl(endpoint, localState);
      const options: RequestInit = {
        method: endpoint.method,
        headers: endpoint.requiresAuth ? getAuthHeaders() : { 'Content-Type': 'application/json' }
      };

      if (endpoint.payload && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        options.body = JSON.stringify(endpoint.payload);
      }

      const response = await fetch(url, options);
      const responseData = await response.json();
      const duration = Date.now() - startTime;

      if (response.ok) {
        // Salvar IDs criados para uso posterior
        if (endpoint.name === 'Create Business' && responseData.id) {
          const newState = { ...localState, createdBusinessId: responseData.id };
          setDiagnosticState(newState);
          return newState;
        }
        
        if (endpoint.name === 'Create Instance' && responseData.instanceName) {
          const newState = { ...localState, createdInstanceId: responseData.instanceName };
          setDiagnosticState(newState);
          return newState;
        }

        setTestResults(prev => ({
          ...prev,
          [testKey]: {
            endpoint: endpoint.name,
            status: 'success',
            message: 'Teste executado com sucesso',
            duration,
            timestamp: Date.now(),
            response: responseData
          }
        }));

        toast({
          title: "✅ Teste bem-sucedido",
          description: `${endpoint.name} executado em ${duration}ms`
        });

        return localState;
      } else {
        throw new Error(`${response.status}: ${responseData.message || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      setTestResults(prev => ({
        ...prev,
        [testKey]: {
          endpoint: endpoint.name,
          status: 'error',
          message: error.message,
          duration,
          timestamp: Date.now(),
          error: error.message
        }
      }));

      toast({
        variant: "destructive",
        title: "❌ Erro no teste",
        description: `${endpoint.name}: ${error.message}`
      });

      return localState;
    }
  };

  const runSequentialTest = async () => {
    setIsSequentialRunning(true);
    setProgress(0);
    
    let localState = { ...diagnosticState };
    const totalTests = endpoints.length;
    
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      
      // Verificar dependências
      if (endpoint.dependencies?.length) {
        const hasFailedDependency = endpoint.dependencies.some(dep => {
          const depResult = testResults[dep];
          return depResult && depResult.status === 'error';
        });
        
        if (hasFailedDependency) {
          setTestResults(prev => ({
            ...prev,
            [endpoint.name]: {
              endpoint: endpoint.name,
              status: 'skipped',
              message: 'Pulado devido a dependência falhada'
            }
          }));
          continue;
        }
      }
      
      localState = await executeTest(endpoint, localState);
      setProgress(((i + 1) / totalTests) * 100);
      
      // Pausa entre testes para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsSequentialRunning(false);
    
    toast({
      title: "🏁 Diagnóstico concluído",
      description: "Todos os testes foram executados"
    });
  };

  const testCategory = async (category: string) => {
    const categoryEndpoints = endpoints.filter(e => e.category === category);
    
    for (const endpoint of categoryEndpoints) {
      await executeTest(endpoint);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    toast({
      title: "✅ Categoria testada",
      description: `Todos os testes de ${categories[category as keyof typeof categories]?.name} foram executados`
    });
  };

  const clearResults = () => {
    setTestResults({});
    setDiagnosticState({
      createdBusinessId: null,
      createdInstanceId: null,
      businessToken: null,
      instanceToken: null
    });
    
    toast({
      title: "🧹 Resultados limpos",
      description: "Todos os resultados de teste foram removidos"
    });
  };

  const exportResults = () => {
    const results = {
      timestamp: new Date().toISOString(),
      serverConfig: {
        url: apiUrl,
        hasApiKey: !!config.globalApiKey
      },
      diagnosticState,
      testResults
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-codechat-diagnostic-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "📁 Resultados exportados",
      description: "Arquivo JSON baixado com sucesso"
    });
  };

  const renderTestResult = (result: TestResult) => (
    <Card key={result.endpoint} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{result.endpoint}</CardTitle>
          {getStatusBadge(result.status)}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
        {result.duration && (
          <p className="text-xs text-muted-foreground">
            ⏱️ Duração: {result.duration}ms
          </p>
        )}
        {result.error && (
          <Alert className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{result.error}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2 mt-3">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              const endpoint = endpoints.find(e => e.name === result.endpoint);
              if (endpoint) executeTest(endpoint);
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Testar novamente
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const getOverallStatus = () => {
    const results = Object.values(testResults);
    if (results.length === 0) return 'idle';
    
    const hasErrors = results.some(r => r.status === 'error');
    const hasPending = results.some(r => r.status === 'pending');
    
    if (hasPending) return 'running';
    if (hasErrors) return 'error';
    return 'success';
  };

  const getStats = () => {
    const results = Object.values(testResults);
    return {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      error: results.filter(r => r.status === 'error').length,
      pending: results.filter(r => r.status === 'pending').length,
      skipped: results.filter(r => r.status === 'skipped').length
    };
  };

  const stats = getStats();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Api Codechat</h1>
          <p className="text-muted-foreground">
            Ferramenta completa para testar e monitorar endpoints da API CodeChat v2.2.1
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isServerOnline ? "default" : "destructive"} className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {isServerOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <TestTube className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sucesso</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.success}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Erro</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.error}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pulado</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.skipped}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Controles de Teste
          </CardTitle>
          <CardDescription>
            Execute testes individuais, por categoria ou diagnóstico completo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSequentialRunning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Executando diagnóstico sequencial...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={runSequentialTest} 
              disabled={isSequentialRunning || !isServerOnline}
              className="flex items-center gap-2"
            >
              {isSequentialRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Diagnóstico Completo
            </Button>
            
            <Button 
              variant="outline" 
              onClick={clearResults}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Limpar Resultados
            </Button>
            
            <Button 
              variant="outline" 
              onClick={exportResults}
              disabled={Object.keys(testResults).length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="tests" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tests">🧪 Testes por Categoria</TabsTrigger>
          <TabsTrigger value="docs">📚 Documentação</TabsTrigger>
          <TabsTrigger value="results">📊 Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(categories).map(([key, category]) => {
              const categoryEndpoints = endpoints.filter(e => e.category === key);
              const categoryResults = categoryEndpoints.map(e => testResults[e.name]).filter(Boolean);
              const hasSuccess = categoryResults.some(r => r.status === 'success');
              const hasError = categoryResults.some(r => r.status === 'error');
              
              return (
                <Card key={key} className="hover-scale">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <category.icon className="h-5 w-5" />
                      {category.name}
                    </CardTitle>
                    <CardDescription>
                      {categoryEndpoints.length} endpoint{categoryEndpoints.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      {hasError && <XCircle className="h-4 w-4 text-destructive" />}
                      {hasSuccess && !hasError && <CheckCircle className="h-4 w-4 text-success" />}
                      {!hasSuccess && !hasError && <Clock className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm">
                        {categoryResults.length > 0 
                          ? `${categoryResults.filter(r => r.status === 'success').length}/${categoryResults.length} sucessos`
                          : 'Não testado'
                        }
                      </span>
                    </div>
                    
                    <Button 
                      onClick={() => testCategory(key)}
                      disabled={!isServerOnline}
                      className="w-full"
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Testar Categoria
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="hover-scale">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  API Yumer - Documentação do Servidor
                </CardTitle>
                <CardDescription>
                  Documentação oficial da API do servidor Yumer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Acesse a documentação completa dos endpoints disponíveis no seu servidor.
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => window.open('https://api.yumer.com.br/docs', '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Documentação
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-scale">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  CodeChat v2.2.1 - Documentação do Desenvolvedor
                </CardTitle>
                <CardDescription>
                  Documentação oficial do CodeChat v2.2.1
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Referência completa da API CodeChat com exemplos e especificações.
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => window.open('https://docs.codechat.dev/api/v2.2.1', '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Documentação
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Configuração Atual do Servidor</CardTitle>
              <CardDescription>
                Configurações sendo utilizadas para os testes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">URL da API:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs">{apiUrl}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Key:</span>
                  <span>{config.globalApiKey ? '✅ Configurada' : '❌ Não configurada'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={isServerOnline ? "default" : "destructive"}>
                    {isServerOnline ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {Object.keys(testResults).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <TestTube className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum teste executado</h3>
                <p className="text-muted-foreground text-center">
                  Execute alguns testes para ver os resultados aqui
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {Object.values(testResults)
                  .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                  .map(renderTestResult)}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApiCodechat;