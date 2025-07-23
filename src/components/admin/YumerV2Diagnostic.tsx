
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
  MessageSquare,
  Activity,
  Trash2,
  RefreshCw,
  Eye,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useServerConfig } from "@/hooks/useServerConfig";

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error' | 'warning' | 'skipped';
  message: string;
  details?: any;
  duration?: number;
  endpoint?: string;
  method?: string;
  httpStatus?: number;
  usedRealId?: boolean;
}

interface ApiEndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  category: string;
  description: string;
  requiresBusinessId?: boolean;
  requiresInstanceId?: boolean;
  tokenType: 'admin' | 'business' | 'instance';
  body?: any;
  dependency?: string; // ID do teste que deve ser executado antes
}

interface DiagnosticState {
  realBusinessId?: string;
  realBusinessToken?: string;
  realInstanceId?: string;
  realInstanceToken?: string;
}

const YumerV2Diagnostic = () => {
  const { config } = useServerConfig();
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isRunningSequential, setIsRunningSequential] = useState(false);
  const [progress, setProgress] = useState(0);
  const [diagnosticState, setDiagnosticState] = useState<DiagnosticState>({});
  const { toast } = useToast();

  // ============ ENDPOINTS CORRIGIDOS PARA API CodeChat v2.2.1 ============
  const endpoints: ApiEndpoint[] = [
    // 🔧 Básicos (não precisam de autenticação - públicos)
    { 
      name: 'API Documentation', 
      url: '/docs', 
      method: 'GET', 
      category: 'docs',
      description: 'Documentação Swagger da API',
      tokenType: 'admin' // Será ignorado para endpoints públicos
    },
    { 
      name: 'Swagger/OpenAPI', 
      url: '/api/v2/reference/swagger.json', 
      method: 'GET', 
      category: 'docs',
      description: 'Especificação OpenAPI completa',
      tokenType: 'admin' // Será ignorado para endpoints públicos
    },
    
    // 🏢 Admin Controller - ADMIN_TOKEN
    { 
      name: 'List All Businesses', 
      url: '/api/v2/admin/business', 
      method: 'GET', 
      category: 'admin',
      description: 'Listar todos os negócios (Admin)',
      tokenType: 'admin'
    },
    { 
      name: 'Create Business', 
      url: '/api/v2/admin/business', 
      method: 'POST', 
      category: 'admin',
      description: 'Criar novo negócio (Admin)',
      tokenType: 'admin',
      body: {
        name: 'Test Business v2.2.1',
        attributes: {
          category: 'diagnostic',
          environment: 'test',
          createdBy: 'YumerDiagnostic'
        }
      }
    },
    
    // 🏪 Business Controller - BUSINESS_TOKEN
    { 
      name: 'Get Business Info', 
      url: '/api/v2/business/{businessId}', 
      method: 'GET', 
      category: 'business',
      description: 'Buscar informações do negócio',
      requiresBusinessId: true,
      tokenType: 'business',
      dependency: 'Create Business'
    },
    { 
      name: 'Create Business Instance', 
      url: '/api/v2/business/{businessId}/instance', 
      method: 'POST', 
      category: 'business',
      description: 'Criar instância no negócio',
      requiresBusinessId: true,
      tokenType: 'business',
      dependency: 'Create Business',
      body: {
        name: 'diagnostic-instance-v221'
      }
    },
    { 
      name: 'Get Business Webhook', 
      url: '/api/v2/business/{businessId}/webhook', 
      method: 'GET', 
      category: 'business',
      description: 'Buscar webhook do negócio',
      requiresBusinessId: true,
      tokenType: 'business',
      dependency: 'Create Business'
    },
    
    // 📱 Instance Controller - INSTANCE_TOKEN
    { 
      name: 'Get Instance Info', 
      url: '/api/v2/instance/{instanceId}', 
      method: 'GET', 
      category: 'instance',
      description: 'Buscar informações da instância',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance'
    },
    { 
      name: 'Connect Instance', 
      url: '/api/v2/instance/{instanceId}/connect', 
      method: 'GET', 
      category: 'instance',
      description: 'Conectar instância ao WhatsApp',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance'
    },
    { 
      name: 'Connection State', 
      url: '/api/v2/instance/{instanceId}/connection-state', 
      method: 'GET', 
      category: 'instance',
      description: 'Verificar estado da conexão',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance'
    },
    { 
      name: 'Get QR Code', 
      url: '/api/v2/instance/{instanceId}/qrcode', 
      method: 'GET', 
      category: 'instance',
      description: 'Obter QR code para conexão',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance'
    },
    
    // 🔔 Webhook Controller - INSTANCE_TOKEN
    { 
      name: 'Set Instance Webhook', 
      url: '/api/v2/instance/{instanceId}/webhook', 
      method: 'POST', 
      category: 'webhook',
      description: 'Configurar webhook da instância',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance',
      body: {
        url: 'https://webhook.site/test-diagnostic-v221',
        enabled: true
      }
    },
    { 
      name: 'Get Instance Webhook', 
      url: '/api/v2/instance/{instanceId}/webhook', 
      method: 'GET', 
      category: 'webhook',
      description: 'Buscar webhook da instância',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance'
    },
    
    // 💬 Message Controller - INSTANCE_TOKEN
    { 
      name: 'Send Text Message', 
      url: '/api/v2/instance/{instanceId}/send/text', 
      method: 'POST', 
      category: 'message',
      description: 'Enviar mensagem de texto',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance',
      body: {
        number: '5511999999999',
        text: 'Test message from YumerDiagnostic v2.2.1'
      }
    },
    { 
      name: 'Send Media Message', 
      url: '/api/v2/instance/{instanceId}/send/media', 
      method: 'POST', 
      category: 'message',
      description: 'Enviar mensagem com mídia',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance',
      body: {
        number: '5511999999999',
        mediatype: 'image',
        media: 'https://picsum.photos/300/200',
        caption: 'Test image from diagnostic'
      }
    },
    
    // 💬 Chat Controller - INSTANCE_TOKEN
    { 
      name: 'Search Contacts', 
      url: '/api/v2/instance/{instanceId}/chat/search/contacts', 
      method: 'GET', 
      category: 'chat',
      description: 'Buscar contatos da instância',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance'
    },
    { 
      name: 'Search Chats', 
      url: '/api/v2/instance/{instanceId}/chat/search/chats', 
      method: 'GET', 
      category: 'chat',
      description: 'Buscar conversas da instância',
      requiresInstanceId: true,
      tokenType: 'instance',
      dependency: 'Create Business Instance'
    }
  ];

  const categories = {
    docs: { name: '📖 Documentação', icon: Shield },
    admin: { name: '🔧 Administração', icon: Settings },
    business: { name: '🏪 Negócios', icon: Database },
    instance: { name: '📱 Instâncias', icon: Server },
    webhook: { name: '🔔 Webhooks', icon: Webhook },
    message: { name: '💬 Mensagens', icon: MessageSquare },
    chat: { name: '💬 Chat', icon: MessageSquare }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'testing': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'skipped': return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
      default: return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500">✅ Sucesso</Badge>;
      case 'error': return <Badge variant="destructive">❌ Erro</Badge>;
      case 'warning': return <Badge className="bg-yellow-500">⚠️ Aviso</Badge>;
      case 'testing': return <Badge variant="secondary">🔄 Testando</Badge>;
      case 'skipped': return <Badge variant="outline">⏭️ Pulado</Badge>;
      default: return <Badge variant="outline">⏸️ Aguardando</Badge>;
    }
  };

  // Obter token correto baseado no tipo
  const getAuthToken = (tokenType: 'admin' | 'business' | 'instance'): string => {
    switch (tokenType) {
      case 'admin':
        return config.globalApiKey || '';
      case 'business':
        return diagnosticState.realBusinessToken || config.globalApiKey || '';
      case 'instance':
        return diagnosticState.realInstanceToken || diagnosticState.realBusinessToken || config.globalApiKey || '';
      default:
        return config.globalApiKey || '';
    }
  };

  // Obter header de autenticação correto baseado na documentação CodeChat v2.2.1
  const getAuthHeaders = (endpoint: ApiEndpoint): Record<string, string> => {
    // Endpoints públicos não precisam de autenticação
    if (endpoint.category === 'docs') {
      return {};
    }
    
    const token = getAuthToken(endpoint.tokenType);
    
    if (!token) {
      return {};
    }

    // Todos os endpoints autenticados usam Authorization Bearer
    return { 'authorization': `Bearer ${token}` };
  };

  // Substituir IDs dinâmicos nas URLs
  const buildEndpointUrl = (endpoint: ApiEndpoint): string => {
    let url = `${config.serverUrl}${endpoint.url}`;
    
    // Substituir businessId real se necessário
    if (endpoint.requiresBusinessId && diagnosticState.realBusinessId) {
      url = url.replace('{businessId}', diagnosticState.realBusinessId);
    }
    
    // Substituir instanceId real se necessário
    if (endpoint.requiresInstanceId && diagnosticState.realInstanceId) {
      url = url.replace('{instanceId}', diagnosticState.realInstanceId);
    }
    
    return url;
  };

  // Executar teste único
  const executeTest = async (endpoint: ApiEndpoint): Promise<TestResult> => {
    const startTime = Date.now();
    const testKey = `${endpoint.category}-${endpoint.name}`;
    
    // Verificar dependências
    if (endpoint.dependency) {
      const dependencyKey = endpoints.find(e => e.name === endpoint.dependency);
      const dependencyResult = testResults[`${dependencyKey?.category}-${endpoint.dependency}`];
      
      if (!dependencyResult || dependencyResult.status !== 'success') {
        return {
          status: 'skipped',
          message: `❌ Dependência falhou: ${endpoint.dependency}`,
          details: { dependency: endpoint.dependency, reason: 'Teste anterior falhou' },
          duration: 0,
          endpoint: endpoint.url,
          method: endpoint.method
        };
      }
    }

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
      const url = buildEndpointUrl(endpoint);
      const authHeaders = getAuthHeaders(endpoint);
      
      console.log(`🧪 [API-TEST-v2.2.1] ${endpoint.method} ${url}`);
      console.log(`🔑 [API-TEST-v2.2.1] Token Type: ${endpoint.tokenType}`, {
        hasToken: !!getAuthToken(endpoint.tokenType),
        authHeaders: Object.keys(authHeaders)
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders
      };

      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
        mode: 'cors',
        credentials: 'omit'
      });

      const duration = Date.now() - startTime;
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      console.log(`📊 [API-TEST-v2.2.1] Response ${response.status}:`, {
        url,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData
      });

      // Processar sucesso e armazenar dados importantes
      if (response.ok) {
        // Armazenar businessId e businessToken se criarmos um business
        if (endpoint.name === 'Create Business' && responseData) {
          setDiagnosticState(prev => ({
            ...prev,
            realBusinessId: responseData.businessId,
            realBusinessToken: responseData.businessToken
          }));
          console.log(`🏪 [BUSINESS-CREATED] ID: ${responseData.businessId}, Token: ${responseData.businessToken?.substring(0, 10)}...`);
        }
        
        // Armazenar instanceId se criarmos uma instância
        if (endpoint.name === 'Create Business Instance' && responseData) {
          setDiagnosticState(prev => ({
            ...prev,
            realInstanceId: responseData.instanceId,
            realInstanceToken: responseData.Auth?.jwt
          }));
          console.log(`📱 [INSTANCE-CREATED] ID: ${responseData.instanceId}, Token: ${responseData.Auth?.jwt?.substring(0, 10)}...`);
        }

        return {
          status: 'success',
          message: `✅ Sucesso - ${duration}ms - Status ${response.status}`,
          details: { 
            httpStatus: response.status,
            data: responseData,
            url,
            tokenType: endpoint.tokenType,
            usedRealIds: !!(endpoint.requiresBusinessId ? diagnosticState.realBusinessId : true) && 
                        !!(endpoint.requiresInstanceId ? diagnosticState.realInstanceId : true)
          },
          duration,
          endpoint: endpoint.url,
          method: endpoint.method,
          httpStatus: response.status,
          usedRealId: true
        };
      }

      // Processar erros
      let status: TestResult['status'] = 'error';
      let message = `❌ Erro HTTP ${response.status}`;
      
      if (response.status === 401) {
        message = `🔐 Não autorizado (${response.status}) - Token inválido ou expirado`;
        status = 'warning';
      } else if (response.status === 403) {
        message = `🚫 Acesso negado (${response.status}) - Sem permissões`;
        status = 'warning';
      } else if (response.status === 404) {
        message = `🔍 Não encontrado (${response.status}) - Endpoint inexistente`;
        status = 'error';
      }

      return {
        status,
        message: `${message} - ${duration}ms`,
        details: { 
          httpStatus: response.status,
          response: responseData,
          url,
          tokenType: endpoint.tokenType
        },
        duration,
        endpoint: endpoint.url,
        method: endpoint.method,
        httpStatus: response.status
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ [API-TEST-v2.2.1] Erro testando ${endpoint.name}:`, error);

      let status: TestResult['status'] = 'error';
      let message = `❌ ${error.message}`;

      if (error.message === 'Failed to fetch' || error.message.includes('CORS')) {
        message = `🌐 Network Error: ${error.message} - Pode ser CORS, conectividade ou endpoint inexistente`;
        status = 'error';
      } else if (error.message.includes('timeout')) {
        message = `⏱️ Timeout: ${error.message}`;
        status = 'warning';
      }

      return {
        status,
        message: `${message} - ${duration}ms`,
        details: { 
          error: error.message,
          url: buildEndpointUrl(endpoint),
          tokenType: endpoint.tokenType
        },
        duration,
        endpoint: endpoint.url,
        method: endpoint.method
      };
    }
  };

  // Executar teste único com estado local (para sequencial)
  const executeTestWithLocalState = async (endpoint: ApiEndpoint, localState: any): Promise<TestResult> => {
    const startTime = Date.now();
    const testKey = `${endpoint.category}-${endpoint.name}`;
    
    // Verificar dependências
    if (endpoint.dependency) {
      const dependencyKey = endpoints.find(e => e.name === endpoint.dependency);
      const dependencyResult = testResults[`${dependencyKey?.category}-${endpoint.dependency}`];
      
      if (!dependencyResult || dependencyResult.status !== 'success') {
        console.log(`⏭️ [SEQUENTIAL-v2.2.1] Pulando ${endpoint.name} - dependência ${endpoint.dependency} falhou`);
        return {
          status: 'skipped',
          message: `❌ Dependência falhou: ${endpoint.dependency}`,
          details: { dependency: endpoint.dependency, reason: 'Teste anterior falhou' },
          duration: 0,
          endpoint: endpoint.url,
          method: endpoint.method
        };
      }
    }

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
      // Construir URL usando estado local
      let url = `${config.serverUrl}${endpoint.url}`;
      
      if (endpoint.requiresBusinessId && localState.realBusinessId) {
        url = url.replace('{businessId}', localState.realBusinessId);
      }
      
      if (endpoint.requiresInstanceId && localState.realInstanceId) {
        url = url.replace('{instanceId}', localState.realInstanceId);
      }

      // Obter token do estado local
      const getLocalAuthToken = (tokenType: 'admin' | 'business' | 'instance'): string => {
        switch (tokenType) {
          case 'admin':
            return config.globalApiKey || '';
          case 'business':
            return localState.realBusinessToken || config.globalApiKey || '';
          case 'instance':
            return localState.realInstanceToken || localState.realBusinessToken || config.globalApiKey || '';
          default:
            return config.globalApiKey || '';
        }
      };

      // Headers de autenticação usando estado local
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Endpoints públicos não precisam de autenticação
      if (endpoint.category !== 'docs') {
        const token = getLocalAuthToken(endpoint.tokenType);
        if (token) {
          headers['authorization'] = `Bearer ${token}`;
        }
      }
      
      console.log(`🧪 [API-TEST-v2.2.1] ${endpoint.method} ${url}`);
      console.log(`🔑 [API-TEST-v2.2.1] Token Type: ${endpoint.tokenType}`, {
        hasToken: !!getLocalAuthToken(endpoint.tokenType),
        authHeaders: Object.keys(headers).filter(h => h.includes('auth'))
      });

      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
        mode: 'cors',
        credentials: 'omit'
      });

      const duration = Date.now() - startTime;
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      console.log(`📊 [API-TEST-v2.2.1] Response ${response.status}:`, {
        url,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData
      });

      // Processar sucesso e armazenar dados importantes no estado local
      if (response.ok) {
        // Armazenar businessId e businessToken se criarmos um business
        if (endpoint.name === 'Create Business' && responseData) {
          localState.realBusinessId = responseData.businessId;
          localState.realBusinessToken = responseData.businessToken;
          
          // Também atualizar o estado React para a UI
          setDiagnosticState(prev => ({
            ...prev,
            realBusinessId: responseData.businessId,
            realBusinessToken: responseData.businessToken
          }));
          
          console.log(`🏪 [BUSINESS-CREATED] ID: ${responseData.businessId}, Token: ${responseData.businessToken?.substring(0, 10)}...`);
        }
        
        // Armazenar instanceId se criarmos uma instância
        if (endpoint.name === 'Create Business Instance' && responseData) {
          localState.realInstanceId = responseData.instanceId;
          localState.realInstanceToken = responseData.Auth?.jwt;
          
          // Também atualizar o estado React para a UI
          setDiagnosticState(prev => ({
            ...prev,
            realInstanceId: responseData.instanceId,
            realInstanceToken: responseData.Auth?.jwt
          }));
          
          console.log(`📱 [INSTANCE-CREATED] ID: ${responseData.instanceId}, Token: ${responseData.Auth?.jwt?.substring(0, 10)}...`);
        }

        return {
          status: 'success',
          message: `✅ Sucesso - ${duration}ms - Status ${response.status}`,
          details: { 
            httpStatus: response.status,
            data: responseData,
            url,
            tokenType: endpoint.tokenType,
            usedLocalState: true
          },
          duration,
          endpoint: endpoint.url,
          method: endpoint.method,
          httpStatus: response.status,
          usedRealId: true
        };
      }

      // Processar erros
      let status: TestResult['status'] = 'error';
      let message = `❌ Erro HTTP ${response.status}`;
      
      if (response.status === 401) {
        message = `🔐 Não autorizado (${response.status}) - Token inválido ou expirado`;
        status = 'warning';
      } else if (response.status === 403) {
        message = `🚫 Acesso negado (${response.status}) - Sem permissões`;
        status = 'warning';
      } else if (response.status === 404) {
        message = `🔍 Não encontrado (${response.status}) - Endpoint inexistente`;
        status = 'error';
      }

      return {
        status,
        message: `${message} - ${duration}ms`,
        details: { 
          httpStatus: response.status,
          response: responseData,
          url,
          tokenType: endpoint.tokenType
        },
        duration,
        endpoint: endpoint.url,
        method: endpoint.method,
        httpStatus: response.status
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ [API-TEST-v2.2.1] Erro testando ${endpoint.name}:`, error);

      let status: TestResult['status'] = 'error';
      let message = `❌ ${error.message}`;

      if (error.message === 'Failed to fetch' || error.message.includes('CORS')) {
        message = `🌐 Network Error: ${error.message} - Pode ser CORS, conectividade ou endpoint inexistente`;
        status = 'error';
      } else if (error.message.includes('timeout')) {
        message = `⏱️ Timeout: ${error.message}`;
        status = 'warning';
      }

      return {
        status,
        message: `${message} - ${duration}ms`,
        details: { 
          error: error.message,
          url: `${config.serverUrl}${endpoint.url}`,
          tokenType: endpoint.tokenType
        },
        duration,
        endpoint: endpoint.url,
        method: endpoint.method
      };
    }
  };

  // Teste sequencial completo COM ESTADO LOCAL
  const runSequentialTest = async () => {
    setIsRunningSequential(true);
    setProgress(0);
    
    // Limpar estado anterior
    setDiagnosticState({});
    setTestResults({});
    
    // Estado local para manter IDs/tokens durante o loop sequencial
    let localState = {
      realBusinessId: '',
      realBusinessToken: '',
      realInstanceId: '',
      realInstanceToken: ''
    };
    
    console.log(`🚀 [SEQUENTIAL-v2.2.1] Iniciando diagnóstico completo da API CodeChat v2.2.1...`);
    console.log(`📍 [SEQUENTIAL-v2.2.1] Servidor: ${config.serverUrl}`);
    console.log(`🔑 [SEQUENTIAL-v2.2.1] API Key configurada: ${config.globalApiKey ? 'Sim' : 'Não'}`);
    console.log(`🌐 [SEQUENTIAL-v2.2.1] Frontend Origin: ${window.location.origin}`);
    console.log(`📝 [SEQUENTIAL-v2.2.1] Sequência de teste: ${endpoints.map(e => `${e.category}/${e.name}`).join(', ')}`);
    
    try {
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];
        const testKey = `${endpoint.category}-${endpoint.name}`;
        
        console.log(`🔄 [SEQUENTIAL-v2.2.1] (${i+1}/${endpoints.length}) Executando: ${endpoint.category}/${endpoint.name}`);
        
        // Executar teste com estado local
        const result = await executeTestWithLocalState(endpoint, localState);
        
        setTestResults(prev => ({ ...prev, [testKey]: result }));
        setProgress(((i + 1) / endpoints.length) * 100);
        
        // Se criação de business falhar, interromper alguns testes dependentes
        if (endpoint.name === 'Create Business' && result.status === 'error') {
          console.error(`❌ [SEQUENTIAL-v2.2.1] Falha crítica na criação do business`);
          toast({
            title: "Teste Sequencial com Problemas",
            description: "Falha ao criar business - alguns testes serão pulados",
            variant: "destructive"
          });
        }
        
        // Pausas estratégicas
        if (['Create Business', 'Create Business Instance'].includes(endpoint.name)) {
          console.log(`⏱️ [SEQUENTIAL-v2.2.1] Aguardando 1s após ${endpoint.name}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      const results = Object.values(testResults);
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      const warningCount = results.filter(r => r.status === 'warning').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;

      console.log(`🎯 [SEQUENTIAL-v2.2.1] Diagnóstico concluído:`, {
        total: endpoints.length,
        success: successCount,
        errors: errorCount,
        warnings: warningCount,
        skipped: skippedCount,
        realBusinessId: diagnosticState.realBusinessId,
        realInstanceId: diagnosticState.realInstanceId
      });

      toast({
        title: "Diagnóstico Concluído",
        description: `✅ ${successCount} sucessos, ❌ ${errorCount} erros, ⚠️ ${warningCount} avisos, ⏭️ ${skippedCount} pulados`,
      });

    } finally {
      setIsRunningSequential(false);
    }
  };

  // Teste de categoria específica
  const testCategory = async (category: string) => {
    const categoryEndpoints = endpoints.filter(e => e.category === category);
    
    for (const endpoint of categoryEndpoints) {
      const testKey = `${endpoint.category}-${endpoint.name}`;
      const result = await executeTest(endpoint);
      setTestResults(prev => ({ ...prev, [testKey]: result }));
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // Limpar todos os resultados
  const clearResults = () => {
    setTestResults({});
    setDiagnosticState({});
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
              {endpoint.requiresBusinessId && (
                <p className="text-xs text-blue-600">🏪 Requer businessId</p>
              )}
              {endpoint.requiresInstanceId && (
                <p className="text-xs text-green-600">📱 Requer instanceId</p>
              )}
              {endpoint.tokenType !== 'admin' && (
                <p className="text-xs text-purple-600">🔐 Token: {endpoint.tokenType}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            {getStatusBadge(result?.status || 'idle')}
            {result?.duration && (
              <p className="text-xs text-muted-foreground mt-1">
                {result.duration}ms
              </p>
            )}
            {result?.httpStatus && (
              <p className="text-xs text-muted-foreground">
                {result.httpStatus}
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
              result.status === 'skipped' ? 'text-gray-600' :
              'text-gray-600'
            }>
              {result.message}
            </span>
          </div>
        )}
        
        {result?.details && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Ver detalhes</summary>
            <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto max-h-40">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          </details>
        )}
        
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => executeTest(endpoint).then(result => {
            setTestResults(prev => ({ ...prev, [testKey]: result }));
          })}
          disabled={result?.status === 'testing'}
        >
          {result?.status === 'testing' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Testar
        </Button>
      </div>
    );
  };

  // Cálculo de estatísticas
  const results = Object.values(testResults);
  const stats = {
    total: endpoints.length,
    tested: results.length,
    success: results.filter(r => r.status === 'success').length,
    error: results.filter(r => r.status === 'error').length,
    warning: results.filter(r => r.status === 'warning').length,
    skipped: results.filter(r => r.status === 'skipped').length
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🚀 Diagnóstico API CodeChat v2.2.1 (Corrigido)
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
                    Testar API v2.2.1
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
          {isRunningSequential && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso do diagnóstico</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Status do Sistema */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg mb-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Servidor</p>
              <p className="text-sm truncate">{config.serverUrl}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Versão</p>
              <p className="text-sm">v2.2.1</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Endpoints corrigidos</p>
              <p className="text-sm">{endpoints.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">API Key</p>
              <p className={`text-sm ${config.globalApiKey ? 'text-green-600' : 'text-red-600'}`}>
                {config.globalApiKey ? '✅ Configurada' : '❌ Não configurada'}
              </p>
            </div>
          </div>

          {/* Estado do Diagnóstico */}
          {(diagnosticState.realBusinessId || diagnosticState.realInstanceId) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg mb-6">
              <div>
                <p className="text-sm font-medium text-blue-700">Business ID</p>
                <p className="text-xs font-mono">{diagnosticState.realBusinessId || 'Não obtido'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700">Instance ID</p>
                <p className="text-xs font-mono">{diagnosticState.realInstanceId || 'Não obtido'}</p>
              </div>
            </div>
          )}

          {/* Estatísticas */}
          {stats.tested > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-lg font-bold">{stats.tested}</div>
                <div className="text-xs text-gray-600">Testados</div>
              </div>
              <div className="text-center p-2 bg-green-50 rounded">
                <div className="text-lg font-bold text-green-600">{stats.success}</div>
                <div className="text-xs text-green-600">Funcionando</div>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded">
                <div className="text-lg font-bold text-yellow-600">{stats.warning}</div>
                <div className="text-xs text-yellow-600">Auth Error</div>
              </div>
              <div className="text-center p-2 bg-red-50 rounded">
                <div className="text-lg font-bold text-red-600">{stats.error}</div>
                <div className="text-xs text-red-600">Rede/CORS</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-lg font-bold text-gray-600">{stats.skipped}</div>
                <div className="text-xs text-gray-600">Pulados</div>
              </div>
              <div className="text-center p-2 bg-purple-50 rounded">
                <div className="text-lg font-bold text-purple-600">{stats.total - stats.tested}</div>
                <div className="text-xs text-purple-600">Pendentes</div>
              </div>
            </div>
          )}

          <Tabs defaultValue="docs" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              {Object.entries(categories).map(([key, category]) => (
                <TabsTrigger key={key} value={key} className="flex items-center space-x-1">
                  <category.icon className="w-3 h-3" />
                  <span className="hidden sm:inline text-xs">{category.name.split(' ')[1]}</span>
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

export default YumerV2Diagnostic;
