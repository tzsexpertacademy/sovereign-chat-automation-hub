import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  QrCode, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Server,
  Webhook,
  Smartphone,
  Trash2,
  Eye
} from "lucide-react";
import { SERVER_URL, getYumerGlobalApiKey } from "@/config/environment";
import { useToast } from '@/hooks/use-toast';

interface QRTestResult {
  status: 'idle' | 'testing' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  duration?: number;
  qrCode?: string;
  endpoint?: string;
  method?: string;
}

interface QREndpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  description: string;
  headers?: Record<string, string>;
  body?: any;
  requiresInstance?: boolean;
  expectedBehavior?: 'success' | 'warning_if_not_connected' | 'creates_qr';
}

const QRCodeAdvancedDiagnostic = () => {
  const [testResults, setTestResults] = useState<Record<string, QRTestResult>>({});
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [currentInstance, setCurrentInstance] = useState('');
  const [progress, setProgress] = useState(0);
  const [manualInstance, setManualInstance] = useState(`qr_test_${Date.now()}`);
  const { toast } = useToast();

  const apiKey = getYumerGlobalApiKey();

  // ============ ENDPOINTS ESPECÍFICOS PARA QR CODE ============
  const qrEndpoints: QREndpoint[] = [
    // 🔧 Básico
    { 
      name: 'Health Check', 
      url: '/health', 
      method: 'GET',
      description: 'Verificar se YUMER API está online',
      expectedBehavior: 'success'
    },
    
    // 📱 Lifecycle da Instância
    { 
      name: 'Create Instance', 
      url: '/instance/create', 
      method: 'POST',
      description: 'Criar instância para teste de QR',
      headers: { 'Authorization': `Bearer ${apiKey || ''}` },
      body: { instanceName: '', description: 'QR Diagnostic Test Instance' },
      expectedBehavior: 'success'
    },
    { 
      name: 'Fetch All Instances', 
      url: '/instance/fetchInstances', 
      method: 'GET',
      description: 'Verificar se instância foi criada',
      headers: { 'Authorization': `Bearer ${apiKey || ''}` },
      expectedBehavior: 'success'
    },
    
    // 🔗 Conexão e QR
    { 
      name: 'Connect Instance', 
      url: '/instance/connect/{instance}', 
      method: 'GET',
      description: 'Conectar instância e tentar obter QR',
      headers: { 'Authorization': `Bearer ${apiKey || ''}` },
      requiresInstance: true,
      expectedBehavior: 'creates_qr'
    },
    { 
      name: 'Connection State', 
      url: '/instance/connectionState/{instance}', 
      method: 'GET',
      description: 'Verificar estado da conexão',
      headers: { 'Authorization': `Bearer ${apiKey || ''}` },
      requiresInstance: true,
      expectedBehavior: 'success'
    },
    { 
      name: 'QR Code Direct', 
      url: '/instance/qrcode/{instance}', 
      method: 'GET',
      description: 'Obter QR code via endpoint direto',
      headers: { 'Authorization': `Bearer ${apiKey || ''}` },
      requiresInstance: true,
      expectedBehavior: 'creates_qr'
    },
    
    // ⚠️ Endpoints que ESPERAM erro se não conectado
    { 
      name: 'Fetch Single Instance', 
      url: '/instance/fetchInstance/{instance}', 
      method: 'GET',
      description: 'Buscar detalhes da instância (pode falhar se não conectada)',
      headers: { 'Authorization': `Bearer ${apiKey || ''}` },
      requiresInstance: true,
      expectedBehavior: 'warning_if_not_connected'
    },
    
    // 🧹 Limpeza
    { 
      name: 'Logout Instance', 
      url: '/instance/logout/{instance}', 
      method: 'DELETE',
      description: 'Desconectar instância',
      headers: { 'Authorization': `Bearer ${apiKey || ''}` },
      requiresInstance: true,
      expectedBehavior: 'warning_if_not_connected'
    },
    { 
      name: 'Delete Instance', 
      url: '/instance/delete/{instance}', 
      method: 'DELETE',
      description: 'Deletar instância de teste',
      headers: { 'Authorization': `Bearer ${apiKey || ''}` },
      requiresInstance: true,
      expectedBehavior: 'success'
    }
  ];

  const getStatusIcon = (status: QRTestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'testing': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default: return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusBadge = (status: QRTestResult['status']) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500">Sucesso</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      case 'warning': return <Badge className="bg-yellow-500">Comportamento Esperado</Badge>;
      case 'testing': return <Badge variant="secondary">Testando...</Badge>;
      default: return <Badge variant="outline">Não testado</Badge>;
    }
  };

  // Executar teste único com debug detalhado e fallback de autenticação
  const executeQRTest = async (endpoint: QREndpoint, instanceName?: string, retryWithApiKey = false): Promise<QRTestResult> => {
    const startTime = Date.now();
    const testKey = endpoint.name;
    
    // Marcar como testing
    setTestResults(prev => ({
      ...prev,
      [testKey]: { 
        status: 'testing', 
        message: retryWithApiKey ? 'Tentando com apikey...' : 'Executando...', 
        endpoint: endpoint.url,
        method: endpoint.method 
      }
    }));

    try {
      let url = `${SERVER_URL}${endpoint.url}`;
      let finalInstanceName = instanceName;
      
      // Substituir placeholder de instância
      if (endpoint.requiresInstance && finalInstanceName) {
        url = url.replace('{instance}', finalInstanceName);
      }

      // Preparar body para create instance
      let body = endpoint.body;
      if (endpoint.name === 'Create Instance') {
        // Garantir que sempre temos um nome de instância válido
        const validInstanceName = finalInstanceName || `qr_diagnostic_${Date.now()}`;
        body = { 
          instanceName: validInstanceName,
          description: `QR Diagnostic: ${validInstanceName}` 
        };
        // Atualizar finalInstanceName para uso posterior
        finalInstanceName = validInstanceName;
      }

      // 🔍 DEBUG DETALHADO DOS HEADERS
      const currentApiKey = getYumerGlobalApiKey();
      console.log(`🔑 [API-KEY-DEBUG] API Key atual:`, currentApiKey ? `${currentApiKey.substring(0, 8)}***` : 'NÃO ENCONTRADA');
      
      // 🔄 ESTRATÉGIA HÍBRIDA DE AUTENTICAÇÃO
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Adicionar autenticação baseado no retry
      if (retryWithApiKey) {
        // Tentar com apikey (método antigo)
        headers['apikey'] = currentApiKey || '';
        console.log(`🔑 [AUTH-STRATEGY] Usando apikey header`);
      } else {
        // Tentar com Authorization Bearer (método padrão)
        headers['Authorization'] = `Bearer ${currentApiKey || ''}`;
        console.log(`🔑 [AUTH-STRATEGY] Usando Authorization Bearer`);
      }

      // Adicionar headers do endpoint se existirem
      if (endpoint.headers) {
        Object.assign(headers, endpoint.headers);
      }

      console.log(`🧪 [QR-TEST] ${endpoint.method} ${url}`);
      console.log(`📋 [HEADERS-DEBUG] Headers enviados:`, headers);
      
      if (body) {
        console.log(`📦 [BODY-DEBUG] Body enviado:`, body);
      }

      const response = await fetch(url, {
        method: endpoint.method,
        headers,
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

      console.log(`📊 [RESPONSE-DEBUG] Status: ${response.status}`);
      console.log(`📄 [RESPONSE-DEBUG] Data:`, responseData);

      // 🔍 ANÁLISE ESPECÍFICA DO ERRO 403 COM FALLBACK
      if (response.status === 403 && !retryWithApiKey) {
        console.warn(`⚠️ [403-FALLBACK] Bearer falhou, tentando com apikey...`);
        // Tentar novamente com apikey
        return await executeQRTest(endpoint, instanceName, true);
      } else if (response.status === 403) {
        const authHeader = headers['Authorization'] || headers['apikey'] || headers['apiKey'] || headers['x-api-key'];
        console.error(`🚨 [403-DEBUG] Método ${retryWithApiKey ? 'apikey' : 'Bearer'} falhou`);
        console.error(`🚨 [403-DEBUG] Authorization header:`, authHeader ? `${authHeader.substring(0, 20)}***` : 'AUSENTE');
        console.error(`🚨 [403-DEBUG] Headers de resposta:`, Object.fromEntries(response.headers.entries()));
      }

      // Análise inteligente dos resultados baseada no comportamento esperado
      let status: QRTestResult['status'] = 'error';
      let message = `${endpoint.method} ${response.status} - ${response.statusText}`;
      let qrCode: string | undefined;

      // Buscar QR Code na resposta
      if (responseData && typeof responseData === 'object') {
        // Verificar diferentes formatos de QR
        qrCode = responseData.qrCode || 
                 responseData.qr_code || 
                 responseData.base64 ||
                 (responseData.data && responseData.data.qrCode);
        
        // Para resposta HTML (endpoint /qrcode), tentar extrair QR
        if (!qrCode && typeof responseData === 'string' && responseData.includes('qrcode')) {
          // É HTML, QR será gerado dinamicamente
          if (endpoint.expectedBehavior === 'creates_qr') {
            status = 'warning';
            message += ' (Interface HTML - QR gerado via JavaScript)';
          }
        }
      }

      // Avaliar resultado baseado no comportamento esperado
      if (response.ok) {
        status = 'success';
        if (qrCode) {
          message += ' - QR Code encontrado!';
        } else if (endpoint.name === 'QR Code Direct' && typeof responseData === 'string' && responseData.includes('Generate QRCode')) {
          message = `${endpoint.method} ${response.status} - Página QR carregada (interface disponível)`;
        }
        
        // Indicar qual método de auth funcionou
        if (retryWithApiKey) {
          message += ' (✅ apikey funcionou)';
        } else {
          message += ' (✅ Bearer funcionou)';
        }
      } else {
        // Para endpoints que esperam erro quando não conectado
        if (endpoint.expectedBehavior === 'warning_if_not_connected' && 
            response.status === 400 && 
            responseText.includes('not connected')) {
          status = 'warning';
          message += ' (Comportamento esperado - instância não conectada)';
        } else if (endpoint.name === 'Connect Instance' && response.status === 404) {
          status = 'warning';
          message += ' (Instância ainda não pronta - normal após criação)';
        } else if (response.status === 403) {
          message += ` (Sem permissão - ${retryWithApiKey ? 'apikey' : 'Bearer'} rejeitado)`;
        } else if (response.status === 404) {
          message += ' (Instância não encontrada)';
        }
      }

      const result: QRTestResult = {
        status,
        message,
        details: { 
          status: response.status, 
          data: responseData,
          url: url,
          usedInstance: finalInstanceName || 'N/A',
          responseSize: responseText.length,
          authMethod: retryWithApiKey ? 'apikey' : 'Bearer'
        },
        duration,
        endpoint: endpoint.url,
        method: endpoint.method,
        qrCode
      };

      setTestResults(prev => ({ ...prev, [testKey]: result }));
      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result: QRTestResult = {
        status: 'error',
        message: `Erro: ${error.message}`,
        details: { error: error.message, url: `${SERVER_URL}${endpoint.url}`, authMethod: retryWithApiKey ? 'apikey' : 'Bearer' },
        duration,
        endpoint: endpoint.url,
        method: endpoint.method
      };

      setTestResults(prev => ({ ...prev, [testKey]: result }));
      return result;
    }
  };

  // Teste completo de QR Code com sequência otimizada
  const runQRCodeFullTest = async () => {
    setIsRunningTest(true);
    setProgress(0);
    setTestResults({}); // Limpar resultados anteriores
    
    const testInstanceName = `qr_diagnostic_${Date.now()}`;
    setCurrentInstance(testInstanceName);
    
    try {
      console.log(`🔄 [QR-DIAGNOSTIC] Iniciando teste completo com instância: ${testInstanceName}`);

      // SEQUÊNCIA OTIMIZADA PARA QR CODE - ORDEM CRÍTICA
      const orderedTests = [
        // 1. 🏥 VERIFICAR INFRAESTRUTURA
        'Health Check',              // Garantir que API está online
        
        // 2. 📱 CRIAR INSTÂNCIA DE TESTE  
        'Create Instance',           // Criar nova instância limpa
        
        // 3. ✅ CONFIRMAR CRIAÇÃO
        'Fetch All Instances',       // Verificar se aparece na lista
        
        // 4. 🔌 CONECTAR INSTÂNCIA (MOMENTO CRÍTICO PARA QR)
        'Connect Instance',          // AQUI É ONDE O QR DEVE SER GERADO!
        
        // 5. 📊 VERIFICAR ESTADO APÓS CONNECT
        'Connection State',          // Ver se mudou para 'connecting' ou 'open'
        
        // 6. 🎯 BUSCAR QR DIRETAMENTE (BACKUP)
        'QR Code Direct',            // Caso o connect não retorne QR, buscar aqui
        
        // 7. 🔍 TESTES DE DETALHES (podem falhar - esperado)
        'Fetch Single Instance',     // Detalhes da instância (400 = esperado)
        
        // 8. 🧹 LIMPEZA FINAL
        'Logout Instance',           // Desconectar (400 = esperado se não conectou)
        'Delete Instance'            // Remover instância de teste
      ];

      let qrCodeFound = false;
      
      for (let i = 0; i < orderedTests.length; i++) {
        const testName = orderedTests[i];
        const endpoint = qrEndpoints.find(e => e.name === testName);
        
        if (!endpoint) continue;
        
        console.log(`🔄 [QR-DIAGNOSTIC] (${i+1}/${orderedTests.length}) Executando: ${endpoint.name}`);
        
        const instanceToUse = endpoint.requiresInstance ? testInstanceName : undefined;
        const result = await executeQRTest(endpoint, instanceToUse);
        
        // 🎯 VERIFICAR SE QR FOI ENCONTRADO
        if (result.qrCode && !qrCodeFound) {
          qrCodeFound = true;
          console.log(`🎉 [QR-DIAGNOSTIC] QR CODE ENCONTRADO em: ${endpoint.name}!`);
          toast({
            title: "QR Code Encontrado!",
            description: `QR gerado com sucesso no teste: ${endpoint.name}`,
          });
        }
        
        // ⏱️ PAUSAS ESTRATÉGICAS AUMENTADAS PARA QR
        if (endpoint.name === 'Create Instance') {
          console.log(`⏱️ [QR-DIAGNOSTIC] Aguardando 6s após criação da instância...`);
          await new Promise(resolve => setTimeout(resolve, 6000));
        } else if (endpoint.name === 'Connect Instance') {
          console.log(`⏱️ [QR-DIAGNOSTIC] Aguardando 10s após connect para QR gerar...`);
          // PAUSA LONGA AQUI - MOMENTO CRÍTICO PARA QR
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else if (endpoint.name === 'QR Code Direct') {
          console.log(`⏱️ [QR-DIAGNOSTIC] Aguardando 5s após QR direto...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else if (endpoint.name === 'Connection State') {
          console.log(`⏱️ [QR-DIAGNOSTIC] Aguardando 3s após verificação de estado...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        setProgress(((i + 1) / orderedTests.length) * 100);
        
        // ❌ INTERROMPER SE CRIAÇÃO FALHAR
        if (endpoint.name === 'Create Instance' && result.status === 'error') {
          console.error(`❌ [QR-DIAGNOSTIC] Falha crítica na criação da instância`);
          toast({
            title: "Teste QR Interrompido",
            description: "Falha ao criar instância - verificar API Key e servidor",
            variant: "destructive"
          });
          break;
        }
      }

      const successCount = Object.values(testResults).filter(r => r.status === 'success').length;
      const warningCount = Object.values(testResults).filter(r => r.status === 'warning').length;
      const errorCount = Object.values(testResults).filter(r => r.status === 'error').length;
      const qrFound = Object.values(testResults).some(r => r.qrCode);

      toast({
        title: "Diagnóstico QR Concluído",
        description: `✅ ${successCount} sucessos, ⚠️ ${warningCount} esperados, ❌ ${errorCount} erros${qrFound ? ' - QR encontrado!' : ''}`,
      });

    } finally {
      setIsRunningTest(false);
      setCurrentInstance('');
    }
  };

  // Novo: Teste WebSocket com instância real (JWT válido) - VERSÃO MELHORADA
  const runWebSocketRealTest = async () => {
    setIsRunningTest(true);
    setTestResults({});
    setProgress(0);
    
    const testInstanceName = `ws_real_test_${Date.now()}`;
    setCurrentInstance(testInstanceName);
    
    let realJwtToken = '';
    
    try {
      console.log('🔧 [WS-REAL-TEST] ETAPA 1: Criando instância real para ter JWT válido...');
      
      // ETAPA 1: Criar instância real
      const createEndpoint = qrEndpoints.find(e => e.name === 'Create Instance')!;
      const createResult = await executeQRTest(createEndpoint, testInstanceName);
      setProgress(15);
      
      if (createResult.status === 'error') {
        toast({
          title: "❌ Erro Crítico",
          description: "Falha ao criar instância - não conseguimos prosseguir com WebSocket",
          variant: "destructive"
        });
        return;
      }
      
      // ETAPA 2: Gerar JWT local com secret correto (NUNCA usar JWT da API!)
      const { yumerJwtService } = await import('@/services/yumerJwtService');
      try {
        realJwtToken = await yumerJwtService.generateLocalJWT(testInstanceName);
        console.log('🎯 [WS-REAL-TEST] JWT gerado localmente com secret correto:', realJwtToken.substring(0, 20) + '...');
      } catch (jwtError) {
        console.error('❌ [WS-REAL-TEST] Erro ao gerar JWT local:', jwtError);
        throw new Error('Falha crítica: não foi possível gerar JWT local');
      }
      
      // Salvar na base de dados
      const { whatsappInstancesService } = await import('@/services/whatsappInstancesService');
      try {
        await whatsappInstancesService.createInstance({
          instance_id: testInstanceName,
          auth_token: realJwtToken,
          status: 'created',
          yumer_instance_name: testInstanceName
        });
        console.log('💾 [WS-REAL-TEST] Instância salva na base de dados');
      } catch (dbError) {
        console.warn('⚠️ [WS-REAL-TEST] Erro ao salvar na base:', dbError);
      }
      
      setProgress(30);
      
      // ETAPA 3: Aguardar mais tempo e verificar se instância está pronta
      console.log('⏳ [WS-REAL-TEST] ETAPA 3: Aguardando 15s para instância ficar pronta...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      setProgress(45);
      
      // ETAPA 4: Verificar estado da instância antes de conectar WebSocket
      console.log('🔍 [WS-REAL-TEST] ETAPA 4: Verificando estado da instância...');
      const connectionStateEndpoint = qrEndpoints.find(e => e.name === 'Connection State')!;
      let instanceReady = false;
      
      // Tentar verificar estado até 5 vezes
      for (let i = 0; i < 5; i++) {
        const stateResult = await executeQRTest(connectionStateEndpoint, testInstanceName);
        console.log(`🔍 [WS-REAL-TEST] Tentativa ${i+1}/5 - Estado:`, stateResult.details?.data?.state || 'unknown');
        
        if (stateResult.status !== 'error') {
          instanceReady = true;
          break;
        }
        
        if (i < 4) { // Não esperar na última tentativa
          console.log('⏳ [WS-REAL-TEST] Aguardando mais 5s...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      if (!instanceReady) {
        console.warn('⚠️ [WS-REAL-TEST] Instância não está pronta, mas vamos tentar WebSocket mesmo assim');
      }
      
      setProgress(60);
      
      // ETAPA 5: Tentar conectar via connect endpoint primeiro (pode gerar QR)
      console.log('🔌 [WS-REAL-TEST] ETAPA 5: Tentando connect da instância...');
      const connectEndpoint = qrEndpoints.find(e => e.name === 'Connect Instance')!;
      await executeQRTest(connectEndpoint, testInstanceName);
      
      // Aguardar um pouco após connect
      console.log('⏳ [WS-REAL-TEST] Aguardando 8s após connect...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      setProgress(75);
      
      // ETAPA 6: Testar WebSocket
      console.log('🔌 [WS-REAL-TEST] ETAPA 6: Testando WebSocket com JWT válido...');
      
      const wsUrl = `wss://yumer.yumerflow.app:8083/ws/events?event=qrcode.updated&token=${realJwtToken}`;
      
      const wsTestResult = await new Promise<{success: boolean, message: string, error?: string}>((resolve) => {
        console.log('🌐 [WS-REAL-TEST] Conectando em:', wsUrl);
        
        const ws = new WebSocket(wsUrl);
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve({
              success: false, 
              message: 'Timeout - WebSocket não conectou em 15s',
              error: 'TIMEOUT'
            });
          }
        }, 15000); // Aumentado para 15s
        
        ws.onopen = () => {
          console.log('✅ [WS-REAL-TEST] WebSocket CONECTADO com sucesso!');
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            // Manter conexão por 3s para teste completo
            setTimeout(() => ws.close(), 3000);
            resolve({
              success: true,
              message: 'WebSocket conectou com sucesso usando JWT local!'
            });
          }
        };
        
        ws.onerror = (error) => {
          console.error('❌ [WS-REAL-TEST] Erro WebSocket:', error);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({
              success: false,
              message: 'Erro de conexão WebSocket - possível problema de autenticação',
              error: 'CONNECTION_ERROR'
            });
          }
        };
        
        ws.onclose = (event) => {
          console.log('🔒 [WS-REAL-TEST] WebSocket fechado:', event.code, event.reason);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({
              success: false,
              message: `WebSocket fechado: ${event.code} - ${event.reason || 'Sem motivo específico'}`,
              error: `CLOSE_${event.code}`
            });
          }
        };
        
        ws.onmessage = (event) => {
          console.log('📨 [WS-REAL-TEST] Mensagem recebida:', event.data);
        };
      });
      
      setProgress(85);
      
      // Registrar resultado do teste WebSocket
      setTestResults(prev => ({
        ...prev,
        'WebSocket Real Test': {
          status: wsTestResult.success ? 'success' : 'error',
          message: wsTestResult.message,
          details: { 
            wsUrl,
            jwtUsed: realJwtToken.substring(0, 20) + '...',
            error: wsTestResult.error
          },
          endpoint: '/ws/events',
          method: 'WebSocket'
        }
      }));
      
      console.log('🧹 [WS-REAL-TEST] ETAPA 7: Limpeza - deletando instância de teste...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // ETAPA 4: Limpar instância de teste
      const deleteEndpoint = qrEndpoints.find(e => e.name === 'Delete Instance')!;
      await executeQRTest(deleteEndpoint, testInstanceName);
      setProgress(100);
      
      toast({
        title: wsTestResult.success ? "🎉 WebSocket Funcionou!" : "❌ WebSocket Falhou",
        description: wsTestResult.success 
          ? "Conexão WebSocket estabelecida com JWT local!" 
          : `Falha: ${wsTestResult.message}`,
        variant: wsTestResult.success ? "default" : "destructive"
      });
      
    } catch (error: any) {
      console.error('💥 [WS-REAL-TEST] Erro geral:', error);
      setTestResults(prev => ({
        ...prev,
        'WebSocket Real Test': {
          status: 'error',
          message: `Erro geral: ${error.message}`,
          details: { error: error.message },
          endpoint: '/ws/events',
          method: 'WebSocket'
        }
      }));
      
      toast({
        title: "💥 Erro no Teste WebSocket",
        description: `Erro: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsRunningTest(false);
      setCurrentInstance('');
      setProgress(0);
    }
  };

  // Teste de múltiplas URLs WebSocket (mantido para compatibilidade)
  const runWebSocketUrlTest = async () => {
    setIsRunningTest(true);
    setTestResults({});
    
    const testInstanceName = `ws_test_${Date.now()}`;
    setCurrentInstance(testInstanceName);
    
    // URLs alternativas para testar (exatamente como implementei no codechatQRService)
    const webSocketUrls = [
      `/events?event=qrcode.updated`,
      `/websocket?event=qrcode.updated`, 
      `/socket?event=qrcode.updated`,
      `/instance/${testInstanceName}/events`,
      `/?event=qrcode.updated`,
      `/ws/events?event=qrcode.updated` // Original como fallback
    ];
    
    try {
      // Primeiro, criar uma instância para ter o token
      console.log('🔧 Criando instância para teste WebSocket...');
      const createResult = await executeQRTest(
        qrEndpoints.find(e => e.name === 'Create Instance')!, 
        testInstanceName
      );
      
      if (createResult.status === 'error') {
        toast({
          title: "Erro",
          description: "Falha ao criar instância para teste WebSocket",
          variant: "destructive"
        });
        return;
      }
      
      // Aguardar criação
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Agora testar cada URL WebSocket
      for (let i = 0; i < webSocketUrls.length; i++) {
        const wsPath = webSocketUrls[i];
        const testKey = `WebSocket URL ${i + 1}`;
        
        console.log(`🌐 Testando WebSocket: wss://yumer.yumerflow.app:8083${wsPath}`);
        
        setTestResults(prev => ({
          ...prev,
          [testKey]: {
            status: 'testing',
            message: `Testando WebSocket: ${wsPath}`,
            endpoint: wsPath,
            method: 'WebSocket'
          }
        }));
        
        try {
          const wsUrl = `wss://yumer.yumerflow.app:8083${wsPath}&token=test_token`;
          const result = await testWebSocketConnection(wsUrl, 5000); // 5s timeout
          
          setTestResults(prev => ({
            ...prev,
            [testKey]: {
              status: result.success ? 'success' : 'error',
              message: result.message,
              details: { url: wsUrl, error: result.error },
              endpoint: wsPath,
              method: 'WebSocket'
            }
          }));
          
        } catch (error: any) {
          setTestResults(prev => ({
            ...prev,
            [testKey]: {
              status: 'error',
              message: `Erro WebSocket: ${error.message}`,
              details: { error: error.message },
              endpoint: wsPath,
              method: 'WebSocket'
            }
          }));
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Limpar instância de teste
      await executeQRTest(
        qrEndpoints.find(e => e.name === 'Delete Instance')!, 
        testInstanceName
      );
      
      toast({
        title: "Teste WebSocket Concluído",
        description: `Testadas ${webSocketUrls.length} URLs diferentes. Verifique os resultados.`
      });
      
    } finally {
      setIsRunningTest(false);
      setCurrentInstance('');
    }
  };
  
  // Função auxiliar para testar conexão WebSocket
  const testWebSocketConnection = (url: string, timeout: number = 5000): Promise<{success: boolean, message: string, error?: string}> => {
    return new Promise((resolve) => {
      const ws = new WebSocket(url);
      let resolved = false;
      
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve({
            success: false,
            message: `Timeout após ${timeout}ms`,
            error: 'Connection timeout'
          });
        }
      }, timeout);
      
      ws.onopen = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          ws.close();
          resolve({
            success: true,
            message: '✅ Conexão WebSocket estabelecida com sucesso!'
          });
        }
      };
      
      ws.onerror = (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({
            success: false,
            message: `❌ Erro na conexão WebSocket`,
            error: 'Connection failed'
          });
        }
      };
      
      ws.onclose = (event) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({
            success: false,
            message: `❌ WebSocket fechou: ${event.code} - ${event.reason || 'Sem motivo específico'}`,
            error: `Close code: ${event.code}`
          });
        }
      };
    });
  };

  // Teste com instância manual
  const testWithManualInstance = async () => {
    if (!manualInstance.trim()) {
      toast({
        title: "Nome Necessário",
        description: "Digite o nome de uma instância para testar",
        variant: "destructive"
      });
      return;
    }

    setIsRunningTest(true);
    setCurrentInstance(manualInstance);
    
    // Testar apenas endpoints de QR com instância existente
    const qrSpecificEndpoints = qrEndpoints.filter(e => 
      ['Connect Instance', 'QR Code Direct', 'Connection State'].includes(e.name)
    );

    for (let i = 0; i < qrSpecificEndpoints.length; i++) {
      const endpoint = qrSpecificEndpoints[i];
      await executeQRTest(endpoint, manualInstance);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsRunningTest(false);
    setCurrentInstance('');
  };

  // Limpar resultados
  const clearResults = () => {
    setTestResults({});
    setProgress(0);
  };

  // Renderizar resultado de teste
  const renderQRTestResult = (endpoint: QREndpoint) => {
    const testKey = endpoint.name;
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
          <p className="text-sm">{result.message}</p>
        )}

        {result?.qrCode && (
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-sm font-medium text-green-700 mb-2">🎯 QR Code encontrado!</p>
            <div className="bg-white p-2 rounded border text-center">
              <img 
                src={result.qrCode} 
                alt="QR Code" 
                className="max-w-[150px] max-h-[150px] mx-auto"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const next = target.nextElementSibling as HTMLElement;
                  if (next) next.style.display = 'block';
                }}
              />
              <div style={{ display: 'none' }} className="text-xs text-gray-500">
                QR Code válido (formato não renderizável)
              </div>
            </div>
          </div>
        )}

        {result?.details && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Ver detalhes técnicos</summary>
            <pre className="mt-2 bg-gray-50 p-2 rounded overflow-auto max-h-32 text-xs">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          </details>
        )}

        <Button 
          onClick={() => executeQRTest(endpoint, currentInstance || manualInstance)} 
          size="sm" 
          variant="outline"
          disabled={isRunningTest}
        >
          <Eye className="w-3 h-3 mr-1" />
          Testar
        </Button>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5" />
            <span>Diagnóstico Avançado de QR Code</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={clearResults} variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-1" />
              Limpar
            </Button>
            <Button onClick={runWebSocketRealTest} disabled={isRunningTest || !apiKey} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white">
              {isRunningTest ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando WS Real...
                </>
              ) : (
                <>
                  <Server className="w-4 h-4 mr-2" />
                  🚀 Teste WebSocket REAL
                </>
              )}
            </Button>
            <Button onClick={runWebSocketUrlTest} disabled={isRunningTest || !apiKey} variant="secondary">
              {isRunningTest ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando URLs...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Teste WebSocket URLs
                </>
              )}
            </Button>
            <Button onClick={runQRCodeFullTest} disabled={isRunningTest || !apiKey}>
              {isRunningTest ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {!apiKey ? 'Configure API Key' : 'Teste Completo'}
                </>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* DEBUG: Status da API Key */}
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="font-medium mb-2">🔍 Debug API Key</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>API Key configurada:</span>
              <span className={apiKey ? 'text-green-600' : 'text-red-600'}>
                {apiKey ? `${apiKey.substring(0, 8)}***` : 'Não encontrada'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Servidor YUMER:</span>
              <span className="text-blue-600">{SERVER_URL}</span>
            </div>
          </div>
        </div>
        {!apiKey && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-700">API Key não configurada!</p>
                <p className="text-sm text-red-600 mt-1">
                  Configure a API Key do YUMER para executar os testes. Vá para as configurações do sistema.
                </p>
              </div>
            </div>
          </div>
        )}

        {isRunningTest && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso do teste</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
            {currentInstance && (
              <p className="text-xs text-muted-foreground">Instância: {currentInstance}</p>
            )}
          </div>
        )}

        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-medium">Teste com Instância Específica</h3>
          <div className="flex space-x-2">
            <Input
              placeholder="Nome da instância existente"
              value={manualInstance}
              onChange={(e) => setManualInstance(e.target.value)}
              disabled={isRunningTest}
            />
            <Button onClick={() => setManualInstance(`qr_test_${Date.now()}`)} variant="outline">
              Gerar
            </Button>
            <Button 
              onClick={testWithManualInstance} 
              disabled={isRunningTest || !manualInstance.trim() || !apiKey}
            >
              <Smartphone className="w-4 h-4 mr-1" />
              Testar QR
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use esta opção para testar QR code com uma instância já existente no YUMER
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {qrEndpoints.map(renderQRTestResult)}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 Interpretação dos Resultados</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><span className="font-medium">Sucesso:</span> Endpoint funcionou conforme esperado</li>
            <li><span className="font-medium">Comportamento Esperado:</span> "Erro" normal da API (instância não conectada)</li>
            <li><span className="font-medium">Erro:</span> Problema real que precisa investigação</li>
            <li><span className="font-medium">QR Code:</span> Se encontrado, significa que o sistema está funcionando!</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default QRCodeAdvancedDiagnostic;