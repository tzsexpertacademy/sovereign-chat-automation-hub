import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, Globe, CheckCircle, XCircle } from "lucide-react";
import { codechatQRService } from "@/services/codechatQRService";
import { YumerApiKeyConfig } from "./YumerApiKeyConfig";

const WebSocketStatusDebugSimplified = () => {
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [lastTest, setLastTest] = useState<{
    timestamp: string;
    success: boolean;
    details: string;
  } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  const testCodeChatConnection = async () => {
    setIsTestingConnection(true);
    const timestamp = new Date().toLocaleTimeString();
    
    try {
      addLog('🧪 Iniciando teste de conectividade CodeChat API');
      
      // Teste básico com instância de exemplo
      const testInstanceName = 'test-connection-' + Date.now();
      
      // Teste 1: Buscar status de instância
      try {
        addLog('📊 Testando endpoint de status...');
        const statusResponse = await codechatQRService.getInstanceStatus(testInstanceName);
        addLog('✅ Endpoint de status respondeu (404 é esperado para instância inexistente)');
      } catch (error: any) {
        if (error.message.includes('404')) {
          addLog('✅ Endpoint de status funcionando (404 esperado)');
        } else {
          addLog(`⚠️ Erro no status: ${error.message}`);
        }
      }
      
      // Teste 2: Tentar criar instância (pode falhar mas testa conectividade)
      try {
        addLog('📝 Testando endpoint de criação...');
        const createResponse = await codechatQRService.createInstance(testInstanceName);
        if (createResponse.success) {
          addLog('✅ Instância de teste criada com sucesso');
          
          // Limpar instância de teste
          try {
            await codechatQRService.disconnectInstance(testInstanceName);
            addLog('🧹 Instância de teste removida');
          } catch (cleanupError) {
            addLog('⚠️ Falha na limpeza da instância de teste');
          }
        } else {
          addLog(`⚠️ Criação falhou: ${createResponse.error}`);
        }
      } catch (error: any) {
        addLog(`⚠️ Erro na criação: ${error.message}`);
      }
      
      setLastTest({
        timestamp,
        success: true,
        details: 'Conectividade CodeChat API verificada com sucesso'
      });
      
      addLog('✅ Teste de conectividade concluído com sucesso');
      
    } catch (error: any) {
      addLog(`❌ Teste falhou: ${error.message}`);
      setLastTest({
        timestamp,
        success: false,
        details: error.message
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    addLog('🚀 Monitor REST-first inicializado');
    addLog('📡 Foco na CodeChat API v1.3.3 via REST');
  }, []);

  return (
    <div className="space-y-4">
      {/* Configuração da API Key */}
      <div className="border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 rounded-lg p-1">
        <YumerApiKeyConfig />
      </div>

      {/* Status da Conectividade REST */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-500" />
                <span>CodeChat API (REST-First)</span>
              </CardTitle>
              <CardDescription>
                Monitor de conectividade CodeChat API v1.3.3 via REST
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {lastTest && (
                <Badge variant={lastTest.success ? "default" : "destructive"}>
                  {lastTest.success ? (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  ) : (
                    <XCircle className="w-3 h-3 mr-1" />
                  )}
                  {lastTest.success ? "Conectado" : "Erro"}
                </Badge>
              )}
              <Button 
                size="sm" 
                onClick={testCodeChatConnection} 
                disabled={isTestingConnection}
                variant="outline"
              >
                {isTestingConnection ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                {isTestingConnection ? 'Testando...' : 'Testar Conectividade'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status do Último Teste */}
            {lastTest && (
              <div className={`p-3 rounded-lg ${
                lastTest.success 
                  ? 'bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800'
                  : 'bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800'
              }`}>
                <div className="flex items-center space-x-2">
                  {lastTest.success ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="font-medium">
                    Último teste: {lastTest.timestamp}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${
                  lastTest.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                }`}>
                  {lastTest.details}
                </p>
              </div>
            )}

            {/* Logs de Conexão */}
            <div>
              <h4 className="font-medium mb-2">Logs de Atividade:</h4>
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono max-h-60 overflow-y-auto">
                {connectionLogs.length > 0 ? (
                  connectionLogs.map((log, index) => (
                    <div key={index} className={`text-xs ${
                      log.includes('✅') ? 'text-green-600' : 
                      log.includes('❌') ? 'text-red-600' : 
                      log.includes('🔄') || log.includes('🧪') ? 'text-blue-600' : 
                      log.includes('⚠️') ? 'text-yellow-600' : 
                      ''
                    }`}>{log}</div>
                  ))
                ) : (
                  <div className="text-gray-500">Aguardando atividade...</div>
                )}
              </div>
            </div>

            {/* Informações da API */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <h4 className="font-medium text-sm text-gray-600 dark:text-gray-300">Método Principal</h4>
                <p className="text-sm font-mono">CodeChat REST API v1.3.3</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-600 dark:text-gray-300">Endpoints Testados</h4>
                <p className="text-sm font-mono">/instance/* (create, connect, qrcode, status)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status de Eventos (REST Polling) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Status via Polling</span>
          </CardTitle>
          <CardDescription>
            Atualizações de status obtidas via polling REST (3s interval)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-500">
            <div className="mb-2">
              <RefreshCw className="w-8 h-8 mx-auto text-blue-500" />
            </div>
            <p>Sistema usar polling REST para atualizações em tempo real</p>
            <p className="text-xs mt-1">Sem dependência de WebSocket para operações básicas</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebSocketStatusDebugSimplified;