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
  QrCode
} from "lucide-react";
import { SERVER_URL, getServerConfig, getYumerGlobalApiKey } from "@/config/environment";
import { supabase } from "@/integrations/supabase/client";

import QRCodeAdvancedDiagnostic from "./QRCodeAdvancedDiagnostic";
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

const ConnectionDiagnostics = () => {
  const [corsTest, setCorsTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [apiTests, setApiTests] = useState<Record<string, TestResult>>({});
  const [webhookTest, setWebhookTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [multiInstanceTest, setMultiInstanceTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [supabaseTest, setSupabaseTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [isRunningAll, setIsRunningAll] = useState(false);

  const config = getServerConfig();
  const apiKey = getYumerGlobalApiKey();

  // Endpoints para testar
  const endpoints: EndpointTest[] = [
    { name: 'Health Check', url: '/health', method: 'GET' },
    { name: 'Status Público', url: '/', method: 'GET' },
    { name: 'Fetch Instances', url: '/instance/fetchInstances', method: 'GET', headers: { 'apikey': apiKey || '' } },
    { name: 'Connection State', url: '/instance/connectionState/test', method: 'GET', headers: { 'apikey': apiKey || '' } },
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

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500">Sucesso</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      case 'warning': return <Badge className="bg-yellow-500">Atenção</Badge>;
      case 'testing': return <Badge variant="secondary">Testando...</Badge>;
      default: return <Badge variant="outline">Não testado</Badge>;
    }
  };

  // Teste CORS específico
  const testCORS = async () => {
    setCorsTest({ status: 'testing', message: 'Testando política CORS...' });
    const startTime = Date.now();

    try {
      const testUrl = `${SERVER_URL}/health`;
      console.log('🧪 [CORS] Testando:', testUrl);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': window.location.origin,
          'X-Requested-With': 'XMLHttpRequest'
        },
        mode: 'cors',
        credentials: 'omit'
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        setCorsTest({
          status: 'success',
          message: 'CORS configurado corretamente',
          details: { 
            status: response.status, 
            headers: Object.fromEntries(response.headers.entries()),
            data
          },
          duration
        });
      } else {
        setCorsTest({
          status: 'error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          duration
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error.message.includes('CORS') || error.message === 'Failed to fetch') {
        setCorsTest({
          status: 'error',
          message: 'Bloqueado por CORS - servidor precisa permitir origem: ' + window.location.origin,
          details: { error: error.message, origin: window.location.origin },
          duration
        });
      } else {
        setCorsTest({
          status: 'error',
          message: error.message,
          duration
        });
      }
    }
  };

  // Teste de endpoints da API
  const testAPIEndpoints = async () => {
    const results: Record<string, TestResult> = {};
    
    for (const endpoint of endpoints) {
      const testKey = endpoint.name;
      results[testKey] = { status: 'testing', message: 'Testando...' };
      setApiTests({ ...results });

      const startTime = Date.now();

      try {
        const url = `${SERVER_URL}${endpoint.url}`;
        console.log(`🧪 [API] Testando ${endpoint.name}:`, url);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...endpoint.headers
        };

        const response = await fetch(url, {
          method: endpoint.method,
          headers,
          body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
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

        if (response.ok) {
          results[testKey] = {
            status: 'success',
            message: `${endpoint.method} ${response.status} - OK`,
            details: { status: response.status, data: responseData },
            duration
          };
        } else {
          results[testKey] = {
            status: 'error',
            message: `${endpoint.method} ${response.status} - ${response.statusText}`,
            details: { status: response.status, data: responseData },
            duration
          };
        }
      } catch (error: any) {
        const duration = Date.now() - startTime;
        results[testKey] = {
          status: 'error',
          message: `Erro: ${error.message}`,
          details: { error: error.message },
          duration
        };
      }

      setApiTests({ ...results });
    }
  };

  // Teste de Webhook
  const testWebhook = async () => {
    setWebhookTest({ status: 'testing', message: 'Testando configuração de webhook...' });
    const startTime = Date.now();

    try {
      // Verificar se webhook está configurado no servidor
      const response = await fetch(`${SERVER_URL}/webhook`, {
        headers: { 'apikey': apiKey || '' }
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        setWebhookTest({
          status: 'success',
          message: 'Webhook configurado',
          details: data,
          duration
        });
      } else {
        setWebhookTest({
          status: 'warning',
          message: 'Webhook endpoint não encontrado - pode estar em rota diferente',
          duration
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setWebhookTest({
        status: 'error',
        message: `Erro ao testar webhook: ${error.message}`,
        duration
      });
    }
  };

  // Teste de múltiplas instâncias
  const testMultipleInstances = async () => {
    setMultiInstanceTest({ status: 'testing', message: 'Testando suporte a múltiplas instâncias...' });
    const startTime = Date.now();

    try {
      // Simular criação de múltiplas instâncias
      const testInstances = [
        'test-client-1_' + Date.now(),
        'test-client-2_' + Date.now(),
        'test-client-3_' + Date.now()
      ];

      const results = [];
      
      for (const instanceId of testInstances) {
        try {
          const response = await fetch(`${SERVER_URL}/instance/connectionState/${instanceId}`, {
            headers: { 'apikey': apiKey || '' }
          });
          
          if (response.ok) {
            const data = await response.json();
            results.push({ instanceId, status: data.state });
          }
        } catch (error) {
          // Esperado para instâncias de teste
          results.push({ instanceId, status: 'not_found' });
        }
      }

      const duration = Date.now() - startTime;
      
      setMultiInstanceTest({
        status: 'success',
        message: `Servidor responde para múltiplas instâncias (${results.length} testadas)`,
        details: { instances: results, supportMultiple: true },
        duration
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setMultiInstanceTest({
        status: 'error',
        message: `Erro ao testar múltiplas instâncias: ${error.message}`,
        duration
      });
    }
  };

  // Teste Supabase
  const testSupabase = async () => {
    setSupabaseTest({ status: 'testing', message: 'Testando conexão com Supabase...' });
    const startTime = Date.now();

    try {
      // Testar read no Supabase
      const { data, error, count } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact' })
        .limit(1);

      const duration = Date.now() - startTime;

      if (error) {
        setSupabaseTest({
          status: 'error',
          message: `Erro Supabase: ${error.message}`,
          duration
        });
        return;
      }

      // Testar insert de teste
      const testInstance = {
        instance_id: `test_${Date.now()}`,
        status: 'test',
        client_id: null
      };

      const { data: inserted, error: insertError } = await supabase
        .from('whatsapp_instances')
        .insert(testInstance)
        .select()
        .single();

      if (inserted) {
        // Limpar teste
        await supabase
          .from('whatsapp_instances')
          .delete()
          .eq('id', inserted.id);
      }

      setSupabaseTest({
        status: 'success',
        message: `Supabase OK - ${count || 0} instâncias no banco`,
        details: { 
          totalInstances: count,
          canRead: true,
          canWrite: !insertError,
          testCleanedUp: true
        },
        duration
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setSupabaseTest({
        status: 'error',
        message: `Erro Supabase: ${error.message}`,
        duration
      });
    }
  };

  // Executar todos os testes
  const runAllTests = async () => {
    setIsRunningAll(true);
    
    try {
      await testCORS();
      await testAPIEndpoints();
      await testWebhook();
      await testMultipleInstances();
      await testSupabase();
    } finally {
      setIsRunningAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🔬 Diagnóstico Avançado de Conexão
            <Button onClick={runAllTests} disabled={isRunningAll}>
              {isRunningAll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Executando...
                </>
              ) : (
                'Executar Todos os Testes'
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="p-3 border rounded">
              <p className="text-sm font-medium">Frontend</p>
              <p className="text-xs text-muted-foreground">{window.location.origin}</p>
            </div>
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
          </div>

          <Tabs defaultValue="cors" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="cors" className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>CORS</span>
              </TabsTrigger>
              <TabsTrigger value="api" className="flex items-center space-x-2">
                <Server className="w-4 h-4" />
                <span>API</span>
              </TabsTrigger>
              <TabsTrigger value="advanced-api" className="flex items-center space-x-2">
                <Network className="w-4 h-4" />
                <span>API Avançada</span>
              </TabsTrigger>
              <TabsTrigger value="webhook" className="flex items-center space-x-2">
                <Webhook className="w-4 h-4" />
                <span>Webhook</span>
              </TabsTrigger>
              <TabsTrigger value="qr" className="flex items-center space-x-2">
                <QrCode className="w-4 h-4" />
                <span>QR Code</span>
              </TabsTrigger>
              <TabsTrigger value="instances" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Instâncias</span>
              </TabsTrigger>
              <TabsTrigger value="supabase" className="flex items-center space-x-2">
                <Database className="w-4 h-4" />
                <span>Supabase</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-5 h-5" />
                      <span>Teste CORS</span>
                    </div>
                    {getStatusBadge(corsTest.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={testCORS} disabled={corsTest.status === 'testing'}>
                    Testar CORS
                  </Button>
                  
                  {corsTest.message && (
                    <div className="mt-4 p-3 border rounded">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(corsTest.status)}
                        <span className="font-medium">{corsTest.message}</span>
                        {corsTest.duration && (
                          <span className="text-xs text-muted-foreground">
                            ({corsTest.duration}ms)
                          </span>
                        )}
                      </div>
                      
                      {corsTest.details && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm">Ver detalhes</summary>
                          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
                            {JSON.stringify(corsTest.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced-api" className="space-y-4">
              <AdvancedApiDiagnostic />
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center space-x-2">
                      <Server className="w-5 h-5" />
                      <span>Endpoints da API</span>
                    </div>
                    <Button onClick={testAPIEndpoints} size="sm">
                      Testar APIs
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {endpoints.map((endpoint) => {
                      const test = apiTests[endpoint.name];
                      return (
                        <div key={endpoint.name} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(test?.status || 'idle')}
                            <div>
                              <p className="font-medium">{endpoint.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {endpoint.method} {endpoint.url}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {test && (
                              <>
                                {getStatusBadge(test.status)}
                                {test.duration && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {test.duration}ms
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhook" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center space-x-2">
                      <Webhook className="w-5 h-5" />
                      <span>Configuração Webhook</span>
                    </div>
                    {getStatusBadge(webhookTest.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={testWebhook} disabled={webhookTest.status === 'testing'}>
                    Testar Webhook
                  </Button>
                  
                  {webhookTest.message && (
                    <div className="mt-4 p-3 border rounded">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(webhookTest.status)}
                        <span>{webhookTest.message}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="instances" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>Múltiplas Instâncias</span>
                    </div>
                    {getStatusBadge(multiInstanceTest.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={testMultipleInstances} disabled={multiInstanceTest.status === 'testing'}>
                    Testar Múltiplas Instâncias
                  </Button>
                  
                  {multiInstanceTest.message && (
                    <div className="mt-4 p-3 border rounded">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(multiInstanceTest.status)}
                        <span>{multiInstanceTest.message}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qr" className="space-y-4">
              <QRCodeAdvancedDiagnostic />
            </TabsContent>

            <TabsContent value="supabase" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center space-x-2">
                      <Database className="w-5 h-5" />
                      <span>Supabase</span>
                    </div>
                    {getStatusBadge(supabaseTest.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={testSupabase} disabled={supabaseTest.status === 'testing'}>
                    Testar Supabase
                  </Button>
                  
                  {supabaseTest.message && (
                    <div className="mt-4 p-3 border rounded">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(supabaseTest.status)}
                        <span>{supabaseTest.message}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConnectionDiagnostics;