
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  Zap, 
  RefreshCw,
  QrCode,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, getYumerGlobalApiKey } from '@/config/environment';
import { whatsappInstancesService } from '@/services/whatsappInstancesService';
import { yumerJwtService } from '@/services/yumerJwtService';

interface TestLog {
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'warning';
  message: string;
  details?: any;
}

export const QRCodeAdvancedDiagnostic: React.FC = () => {
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [customInstanceName, setCustomInstanceName] = useState('');

  const addLog = (type: TestLog['type'], message: string, details?: any) => {
    const log: TestLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details
    };
    
    setTestLogs(prev => [...prev.slice(-49), log]);
    console.log(`🔧 [QR-DIAGNOSTIC] ${type.toUpperCase()}: ${message}`, details || '');
  };

  // Função simplificada para fazer requisições REST com auth correta
  const executeQRTest = async (endpoint: string, options: RequestInit = {}) => {
    const apiKey = getYumerGlobalApiKey();
    if (!apiKey) {
      throw new Error('API Key não configurada');
    }

    addLog('info', `🔑 [API-KEY-DEBUG] API Key atual: ${apiKey.substring(0, 8)}***`);
    
    // Para endpoints de instância, usar SEMPRE apenas apikey header
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': apiKey, // NUNCA usar Authorization Bearer para esses endpoints
      ...options.headers
    };

    addLog('info', `🔑 [AUTH-STRATEGY] Usando APENAS apikey header (sem Bearer)`);
    addLog('info', `🧪 [QR-TEST] ${options.method || 'GET'} ${endpoint}`);
    addLog('info', `📋 [HEADERS-DEBUG] Headers enviados:`, headers);
    
    if (options.body) {
      addLog('info', `📦 [BODY-DEBUG] Body enviado:`, JSON.parse(options.body as string));
    }

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    addLog('info', `📊 [RESPONSE-DEBUG] Status: ${response.status}`);
    
    const data = await response.json();
    addLog('info', `📄 [RESPONSE-DEBUG] Data:`, data);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || data.message || 'Unknown error'}`);
    }

    return data;
  };

  // Aguardar instância ficar em estado adequado
  const waitForInstanceReady = async (instanceName: string, maxAttempts = 10): Promise<any> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      addLog('info', `🔍 [INSTANCE-STATE] Tentativa ${attempt}/${maxAttempts} - Verificando estado...`);
      
      try {
        const stateData = await executeQRTest(
          `${API_BASE_URL}/instance/connectionState/${instanceName}`
        );
        
        addLog('info', `📊 [INSTANCE-STATE] Estado atual: ${stateData.state}, Reason: ${stateData.statusReason}`);
        
        // Estados adequados para WebSocket
        if (stateData.state === 'open') {
          addLog('success', `✅ [INSTANCE-STATE] Instância ONLINE! Estado: ${stateData.state}`);
          return stateData;
        } else if (stateData.state === 'qr' || stateData.state === 'connecting') {
          addLog('success', `📱 [INSTANCE-STATE] Instância pronta para QR! Estado: ${stateData.state}`);
          return stateData;
        } else if (stateData.state === 'close') {
          // Se statusReason for 200, pode estar inicializando
          if (stateData.statusReason === 200) {
            addLog('warning', `⏳ [INSTANCE-STATE] Instância inicializando... Aguardando mais tempo`);
          } else {
            addLog('warning', `⚠️ [INSTANCE-STATE] Instância fechada (reason: ${stateData.statusReason})`);
          }
        }
        
      } catch (error: any) {
        addLog('error', `❌ [INSTANCE-STATE] Erro ao verificar estado: ${error.message}`);
      }
      
      if (attempt < maxAttempts) {
        addLog('info', `⏳ [INSTANCE-STATE] Aguardando 5s antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    throw new Error('Instância não ficou pronta após múltiplas tentativas');
  };

  const runCompleteQRTest = async () => {
    setIsRunning(true);
    setTestLogs([]);
    setTestResults(null);
    
    let testInstanceName = '';
    let createdInstanceId = '';

    try {
      addLog('info', '🔧 [QR-COMPLETE-TEST] Iniciando teste completo de QR Code...');
      
      // ETAPA 1: Criar instância real
      testInstanceName = customInstanceName.trim() || `qr_test_${Date.now()}`;
      addLog('info', `🔧 [QR-COMPLETE-TEST] ETAPA 1: Criando instância: ${testInstanceName}`);
      
      const createData = await executeQRTest(`${API_BASE_URL}/instance/create`, {
        method: 'POST',
        body: JSON.stringify({
          instanceName: testInstanceName,
          description: `QR Test: ${testInstanceName}`
        })
      });
      
      addLog('success', `✅ [QR-COMPLETE-TEST] Instância criada:`, createData);
      
      // Salvar na base de dados
      const dbInstance = await whatsappInstancesService.createInstance({
        instance_id: testInstanceName,
        auth_token: createData.Auth?.token || '',
        status: 'created',
        yumer_instance_name: testInstanceName
      });
      
      createdInstanceId = dbInstance.id;
      addLog('success', '💾 [QR-COMPLETE-TEST] Instância salva na base de dados');
      
      // ETAPA 2: Aguardar 10 segundos para instância se inicializar
      addLog('info', '⏳ [QR-COMPLETE-TEST] ETAPA 2: Aguardando 10s para inicialização...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // ETAPA 3: Verificar estado e aguardar ficar pronta
      addLog('info', '🔍 [QR-COMPLETE-TEST] ETAPA 3: Verificando estado da instância...');
      await waitForInstanceReady(testInstanceName, 8);
      
      // ETAPA 4: Tentar connect para gerar QR
      addLog('info', '🔌 [QR-COMPLETE-TEST] ETAPA 4: Iniciando conexão para QR...');
      
      const connectData = await executeQRTest(`${API_BASE_URL}/instance/connect/${testInstanceName}`);
      addLog('success', '📱 [QR-COMPLETE-TEST] Connect executado:', connectData);
      
      // ETAPA 5: Aguardar e verificar QR
      addLog('info', '⏳ [QR-COMPLETE-TEST] ETAPA 5: Aguardando 8s após connect...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // ETAPA 6: Tentar WebSocket com JWT correto
      addLog('info', '🔌 [QR-COMPLETE-TEST] ETAPA 6: Testando WebSocket...');
      
      const jwt = await yumerJwtService.generateLocalJWT('sfdgs8152g5s1s5', testInstanceName);
      addLog('success', '🎯 [QR-COMPLETE-TEST] JWT gerado para WebSocket');
      
      const wsTest = await testWebSocketConnection(testInstanceName, jwt);
      addLog(wsTest.success ? 'success' : 'warning', 
        `🌐 [QR-COMPLETE-TEST] WebSocket: ${wsTest.success ? 'Sucesso' : 'Falha'}`, wsTest);
      
      // ETAPA 7: Fallback - buscar QR via REST se WebSocket falhou
      if (!wsTest.success) {
        addLog('info', '🔄 [QR-COMPLETE-TEST] ETAPA 7: Fallback - buscando QR via REST...');
        
        try {
          const instanceDetails = await executeQRTest(`${API_BASE_URL}/instance/fetchInstance/${testInstanceName}`);
          addLog('info', '📋 [QR-COMPLETE-TEST] Detalhes da instância:', instanceDetails);
          
          // Verificar se tem QR code disponível
          if (instanceDetails.qrCode || (instanceDetails.Whatsapp?.qr)) {
            addLog('success', '📱 [QR-COMPLETE-TEST] QR Code encontrado via REST!');
          } else {
            addLog('warning', '⚠️ [QR-COMPLETE-TEST] QR Code não encontrado via REST');
          }
        } catch (error: any) {
          addLog('error', `❌ [QR-COMPLETE-TEST] Erro no fallback REST: ${error.message}`);
        }
      }
      
      setTestResults({
        success: true,
        instanceName: testInstanceName,
        webSocketSuccess: wsTest.success,
        timestamp: new Date().toISOString()
      });
      
      toast.success('Teste de QR Code concluído com sucesso!');
      
    } catch (error: any) {
      addLog('error', `❌ [QR-COMPLETE-TEST] Erro no teste: ${error.message}`);
      setTestResults({
        success: false,
        error: error.message,
        instanceName: testInstanceName,
        timestamp: new Date().toISOString()
      });
      toast.error(`Erro no teste: ${error.message}`);
    } finally {
      // ETAPA FINAL: Limpeza
      if (testInstanceName) {
        addLog('info', '🧹 [QR-COMPLETE-TEST] ETAPA FINAL: Limpeza...');
        try {
          await executeQRTest(`${API_BASE_URL}/instance/delete/${testInstanceName}`, {
            method: 'DELETE'
          });
          addLog('success', '🗑️ [QR-COMPLETE-TEST] Instância deletada do servidor');
          
          if (createdInstanceId) {
            await whatsappInstancesService.deleteInstance(createdInstanceId);
            addLog('success', '🗑️ [QR-COMPLETE-TEST] Instância removida da base de dados');
          }
        } catch (cleanupError: any) {
          addLog('warning', `⚠️ [QR-COMPLETE-TEST] Erro na limpeza: ${cleanupError.message}`);
        }
      }
      
      setIsRunning(false);
    }
  };

  const testWebSocketConnection = (instanceName: string, jwt: string): Promise<{success: boolean; error?: string}> => {
    return new Promise((resolve) => {
      const wsUrl = `wss://yumer.yumerflow.app:8083/ws/events?event=qrcode.updated&token=${jwt}`;
      addLog('info', `🌐 [WS-TEST] Conectando em: ${wsUrl.substring(0, 100)}...`);
      
      const ws = new WebSocket(wsUrl);
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          addLog('warning', '⏰ [WS-TEST] Timeout na conexão WebSocket');
          resolve({ success: false, error: 'Timeout' });
        }
      }, 15000);
      
      ws.onopen = () => {
        if (!resolved) {
          addLog('success', '✅ [WS-TEST] WebSocket conectado com sucesso!');
          clearTimeout(timeout);
          resolved = true;
          ws.close();
          resolve({ success: true });
        }
      };
      
      ws.onerror = (error) => {
        if (!resolved) {
          addLog('error', '❌ [WS-TEST] Erro WebSocket:', error);
          clearTimeout(timeout);
          resolved = true;
          resolve({ success: false, error: 'Connection failed' });
        }
      };
      
      ws.onclose = (event) => {
        addLog('info', `🔒 [WS-TEST] WebSocket fechado: ${event.code} ${event.reason}`);
      };
      
      ws.onmessage = (event) => {
        addLog('success', `📨 [WS-TEST] Mensagem recebida:`, JSON.parse(event.data));
      };
    });
  };

  const getLogIcon = (type: TestLog['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getLogColor = (type: TestLog['type']) => {
    switch (type) {
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-500" />
            Diagnóstico Avançado de QR Code
          </CardTitle>
          <CardDescription>
            Teste completo de criação de instância, geração de QR Code e conexão WebSocket
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customInstance">Nome da Instância (opcional)</Label>
              <Input
                id="customInstance"
                placeholder="Deixe vazio para auto-gerar"
                value={customInstanceName}
                onChange={(e) => setCustomInstanceName(e.target.value)}
                disabled={isRunning}
              />
            </div>
          </div>
          
          <Button 
            onClick={runCompleteQRTest} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Executando Teste Completo...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Executar Teste Completo de QR Code
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResults.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              Resultados do Teste
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Status Geral</Label>
                <Badge variant={testResults.success ? "default" : "destructive"}>
                  {testResults.success ? "Sucesso" : "Falha"}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium">WebSocket</Label>
                <Badge variant={testResults.webSocketSuccess ? "default" : "secondary"}>
                  {testResults.webSocketSuccess ? "Funcionando" : "Falhou"}
                </Badge>
              </div>
              {testResults.instanceName && (
                <div>
                  <Label className="text-sm font-medium">Instância Testada</Label>
                  <p className="text-sm font-mono">{testResults.instanceName}</p>
                </div>
              )}
              {testResults.error && (
                <div>
                  <Label className="text-sm font-medium">Erro</Label>
                  <p className="text-sm text-red-600">{testResults.error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs do Teste */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Logs do Teste</CardTitle>
            <Button
              onClick={() => setTestLogs([])}
              variant="outline"
              size="sm"
              disabled={isRunning}
            >
              Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {testLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum log ainda. Execute o teste para ver os detalhes.
              </p>
            ) : (
              <div className="space-y-2">
                {testLogs.map((log, index) => (
                  <div key={index} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{log.timestamp}</span>
                      <span className={getLogColor(log.type)}>
                        {getLogIcon(log.type)} {log.message}
                      </span>
                    </div>
                    {log.details && (
                      <pre className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                    <Separator className="mt-2" />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
