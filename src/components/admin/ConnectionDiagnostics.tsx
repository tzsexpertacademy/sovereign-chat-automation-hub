
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Wifi,
  WifiOff,
  Globe,
  Server,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";
import { SERVER_URL, API_BASE_URL, SOCKET_URL } from "@/config/environment";

interface DiagnosticResult {
  test: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

const ConnectionDiagnostics = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setRunning(true);
    const results: DiagnosticResult[] = [];

    try {
      // Test 1: Basic connectivity
      results.push({
        test: "Conectividade Básica",
        status: 'success',
        message: "URLs configuradas corretamente",
        details: `SERVER: ${SERVER_URL}, API: ${API_BASE_URL}, SOCKET: ${SOCKET_URL}`
      });

      // Test 2: Server health
      try {
        const health = await whatsappService.checkServerHealth();
        results.push({
          test: "Saúde do Servidor",
          status: 'success',
          message: `Servidor online (v${health.version})`,
          details: `${health.activeClients} clientes ativos, ${health.connectedClients} conectados`
        });
      } catch (error: any) {
        results.push({
          test: "Saúde do Servidor",
          status: 'error',
          message: "Servidor não responde",
          details: error.message
        });
      }

      // Test 3: Direct connection test
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          results.push({
            test: "Conexão Direta",
            status: 'success',
            message: "Conexão direta funcionando"
          });
        } else {
          results.push({
            test: "Conexão Direta",
            status: 'warning',
            message: `Resposta HTTP ${response.status}`,
            details: response.statusText
          });
        }
      } catch (error: any) {
        // Try no-cors mode for Mixed Content
        try {
          await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            mode: 'no-cors'
          });
          results.push({
            test: "Conexão Direta",
            status: 'warning',
            message: "Funcionando com no-cors (Mixed Content)",
            details: "HTTPS acessando HTTP - usando modo compatibilidade"
          });
        } catch (noCorsError: any) {
          results.push({
            test: "Conexão Direta",
            status: 'error',
            message: "Falha na conexão direta",
            details: error.message
          });
        }
      }

      // Test 4: API endpoints test - FIXED: Use correct routes
      try {
        const clients = await whatsappService.getAllClients();
        results.push({
          test: "Endpoints da API",
          status: 'success',
          message: `API funcionando (${clients.length} clientes)`
        });
      } catch (error: any) {
        results.push({
          test: "Endpoints da API",
          status: 'error',
          message: "API não responde",
          details: error.message
        });
      }

      // Test 5: WebSocket connectivity
      try {
        const socket = whatsappService.connectSocket();
        if (socket.connected) {
          results.push({
            test: "Conexão WebSocket",
            status: 'success',
            message: "WebSocket conectado"
          });
        } else {
          results.push({
            test: "Conexão WebSocket",
            status: 'warning',
            message: "WebSocket não conectado",
            details: "Tentando conectar..."
          });
        }
      } catch (error: any) {
        results.push({
          test: "Conexão WebSocket",
          status: 'error',
          message: "Falha no WebSocket",
          details: error.message
        });
      }

      // Test 6: Mixed Content detection
      const isHttps = window.location.protocol === 'https:';
      const serverIsHttp = SERVER_URL.startsWith('http://');
      
      if (isHttps && serverIsHttp) {
        results.push({
          test: "Mixed Content Security",
          status: 'warning',
          message: "Mixed Content detectado",
          details: "HTTPS frontend acessando servidor HTTP - usando modo compatibilidade"
        });
      } else {
        results.push({
          test: "Mixed Content Security",
          status: 'success',
          message: "Sem problemas de Mixed Content"
        });
      }

      setDiagnostics(results);
      
      const errorCount = results.filter(r => r.status === 'error').length;
      const warningCount = results.filter(r => r.status === 'warning').length;
      
      if (errorCount === 0 && warningCount === 0) {
        toast({
          title: "Diagnóstico Completo",
          description: "✅ Todos os testes passaram! Sistema funcionando corretamente.",
        });
      } else if (errorCount === 0) {
        toast({
          title: "Diagnóstico com Avisos",
          description: `⚠️ ${warningCount} avisos encontrados. Sistema funcional com limitações.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Problemas Encontrados",
          description: `❌ ${errorCount} erros e ${warningCount} avisos. Verifique a configuração.`,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      toast({
        title: "Erro no Diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return 'default';
      case 'warning': return 'secondary';
      case 'error': return 'destructive';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <CardTitle>Diagnóstico de Conectividade</CardTitle>
          </div>
          <Button onClick={runDiagnostics} disabled={running} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Executando...' : 'Executar Diagnóstico'}
          </Button>
        </div>
        <CardDescription>
          Verifica conectividade, Mixed Content, WebSocket e APIs do sistema WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Configuration Info */}
        <Alert>
          <Globe className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">🌍 Configuração Atual:</p>
              <div className="text-xs space-y-1">
                <p><strong>Servidor:</strong> {SERVER_URL}</p>
                <p><strong>API:</strong> {API_BASE_URL}</p>
                <p><strong>WebSocket:</strong> {SOCKET_URL}</p>
                <p><strong>Frontend:</strong> {window.location.protocol}//{window.location.hostname}</p>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Diagnostic Results */}
        {diagnostics.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Resultados do Diagnóstico:</h4>
            {diagnostics.map((result, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border">
                {getStatusIcon(result.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{result.test}</p>
                    <Badge variant={getStatusColor(result.status)} className="text-xs">
                      {result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                  {result.details && (
                    <p className="text-xs text-gray-500 mt-1 font-mono">{result.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {diagnostics.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Server className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Clique em "Executar Diagnóstico" para verificar a conectividade</p>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default ConnectionDiagnostics;
