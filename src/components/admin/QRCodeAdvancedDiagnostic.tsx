
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
import { codechatQRService } from '@/services/codechatQRService';

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
  const [qrCode, setQrCode] = useState<string | null>(null);

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

  // NOVO FLUXO SIMPLIFICADO - BASEADO NA SUA IMAGEM
  const runSimplifiedQRTest = async () => {
    setIsRunning(true);
    setTestLogs([]);
    setTestResults(null);
    setQrCode(null);
    
    let testInstanceName = '';
    let createdInstanceId = '';

    try {
      addLog('info', '🚀 [QR-SIMPLIFIED] Iniciando teste SIMPLIFICADO de QR Code...');
      
      // ETAPA 1: Criar instância
      testInstanceName = customInstanceName.trim() || `qr_simple_${Date.now()}`;
      addLog('info', `📝 [QR-SIMPLIFIED] ETAPA 1: Criando instância: ${testInstanceName}`);
      
      const createData = await codechatQRService.createInstance(testInstanceName, `QR Simplified Test: ${testInstanceName}`);
      addLog('success', `✅ [QR-SIMPLIFIED] Instância criada com sucesso!`, createData);
      
      // Salvar na base de dados
      const dbInstance = await whatsappInstancesService.createInstance({
        instance_id: testInstanceName,
        auth_token: createData.Auth?.token || '',
        status: 'created',
        yumer_instance_name: testInstanceName
      });
      
      createdInstanceId = dbInstance.id;
      addLog('success', '💾 [QR-SIMPLIFIED] Instância salva na base de dados');
      
      // ETAPA 2: Aguardar inicialização (15-20 segundos como sugerido)
      addLog('info', '⏳ [QR-SIMPLIFIED] ETAPA 2: Aguardando 18s para inicialização completa...');
      await new Promise(resolve => setTimeout(resolve, 18000));
      
      // ETAPA 3: Conectar instância
      addLog('info', '🔌 [QR-SIMPLIFIED] ETAPA 3: Conectando instância...');
      const connectResult = await codechatQRService.connectInstance(testInstanceName);
      addLog('success', '📡 [QR-SIMPLIFIED] Connect executado', connectResult);
      
      // ETAPA 4: Aguardar estabilização pós-connect
      addLog('info', '⏳ [QR-SIMPLIFIED] ETAPA 4: Aguardando 12s após connect...');
      await new Promise(resolve => setTimeout(resolve, 12000));
      
      // ETAPA 5: Buscar QR Code diretamente - MÉTODO SIMPLIFICADO
      addLog('info', '📱 [QR-SIMPLIFIED] ETAPA 5: Buscando QR Code via fetchInstance...');
      
      const qrResult = await codechatQRService.getQRCodeSimple(testInstanceName);
      
      if (qrResult.success && qrResult.qrCode) {
        addLog('success', '🎉 [QR-SIMPLIFIED] QR Code obtido com SUCESSO!');
        setQrCode(qrResult.qrCode);
        
        setTestResults({
          success: true,
          instanceName: testInstanceName,
          qrCodeFound: true,
          method: 'fetchInstance_direct',
          timestamp: new Date().toISOString()
        });
        
        toast.success('🎉 QR Code obtido com sucesso!');
        
      } else {
        addLog('warning', `⚠️ [QR-SIMPLIFIED] QR Code não encontrado: ${qrResult.error}`);
        
        // ETAPA 6: Retry único após mais 10s
        addLog('info', '🔄 [QR-SIMPLIFIED] ETAPA 6: Retry após 10s adicionais...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const retryResult = await codechatQRService.getQRCodeSimple(testInstanceName);
        
        if (retryResult.success && retryResult.qrCode) {
          addLog('success', '🎉 [QR-SIMPLIFIED] QR Code obtido no RETRY!');
          setQrCode(retryResult.qrCode);
          
          setTestResults({
            success: true,
            instanceName: testInstanceName,
            qrCodeFound: true,
            method: 'fetchInstance_retry',
            timestamp: new Date().toISOString()
          });
          
        } else {
          addLog('error', `❌ [QR-SIMPLIFIED] QR Code não obtido após retry: ${retryResult.error}`);
          
          setTestResults({
            success: false,
            instanceName: testInstanceName,
            qrCodeFound: false,
            error: retryResult.error,
            timestamp: new Date().toISOString()
          });
        }
      }
      
    } catch (error: any) {
      addLog('error', `❌ [QR-SIMPLIFIED] Erro no teste: ${error.message}`);
      setTestResults({
        success: false,
        error: error.message,
        instanceName: testInstanceName,
        timestamp: new Date().toISOString()
      });
      toast.error(`Erro no teste: ${error.message}`);
    } finally {
      // LIMPEZA
      if (testInstanceName) {
        addLog('info', '🧹 [QR-SIMPLIFIED] Iniciando limpeza...');
        try {
          await codechatQRService.deleteInstance(testInstanceName);
          addLog('success', '🗑️ [QR-SIMPLIFIED] Instância deletada do servidor');
          
          if (createdInstanceId) {
            await whatsappInstancesService.deleteInstance(createdInstanceId);
            addLog('success', '🗑️ [QR-SIMPLIFIED] Instância removida da base de dados');
          }
        } catch (cleanupError: any) {
          addLog('warning', `⚠️ [QR-SIMPLIFIED] Erro na limpeza: ${cleanupError.message}`);
        }
      }
      
      setIsRunning(false);
    }
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
            QR Code - Teste Simplificado
          </CardTitle>
          <CardDescription>
            Teste direto e simplificado - baseado no método que funciona na sua imagem
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
            onClick={runSimplifiedQRTest} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Executando Teste Simplificado...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Executar Teste Simplificado (REST Direto)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* QR Code Display */}
      {qrCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              QR Code Obtido!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <img 
              src={qrCode} 
              alt="QR Code WhatsApp" 
              className="max-w-full max-h-80 mx-auto border-2 border-green-500 rounded-lg"
            />
            <p className="text-sm text-green-600 mt-4 font-medium">
              ✅ QR Code gerado com sucesso! Escaneie com seu WhatsApp.
            </p>
          </CardContent>
        </Card>
      )}

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
                <Label className="text-sm font-medium">QR Code</Label>
                <Badge variant={testResults.qrCodeFound ? "default" : "secondary"}>
                  {testResults.qrCodeFound ? "Encontrado" : "Não Encontrado"}
                </Badge>
              </div>
              {testResults.method && (
                <div>
                  <Label className="text-sm font-medium">Método</Label>
                  <p className="text-sm font-mono">{testResults.method}</p>
                </div>
              )}
              {testResults.instanceName && (
                <div>
                  <Label className="text-sm font-medium">Instância Testada</Label>
                  <p className="text-sm font-mono">{testResults.instanceName}</p>
                </div>
              )}
              {testResults.error && (
                <div className="col-span-full">
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
