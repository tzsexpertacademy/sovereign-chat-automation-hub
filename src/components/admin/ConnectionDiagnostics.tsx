import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Wifi, 
  WifiOff, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Network,
  Lock,
  Globe
} from "lucide-react";
import { API_BASE_URL, SOCKET_URL, YUMER_API_URL } from "@/config/environment";
import { yumerWhatsAppService } from "@/services/yumerWhatsappService";

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  details?: string;
  duration?: number;
}

const ConnectionDiagnostics = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (result: DiagnosticResult) => {
    setDiagnostics(prev => [...prev, result]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setDiagnostics([]);

    // Test 1: Network Connectivity
    addResult({
      test: "Conectividade de Rede",
      status: 'pending',
      message: "Testando conectividade básica..."
    });

    try {
      const start = Date.now();
      const response = await fetch('https://httpbin.org/status/200', { 
        method: 'GET',
        mode: 'cors'
      });
      const duration = Date.now() - start;
      
      if (response.ok) {
        addResult({
          test: "Conectividade de Rede",
          status: 'success',
          message: "Internet funcionando normalmente",
          duration
        });
      }
    } catch (error: any) {
      addResult({
        test: "Conectividade de Rede",
        status: 'error',
        message: "Sem conectividade com a internet",
        details: error.message
      });
    }

    // Test 2: DNS Resolution
    addResult({
      test: "Resolução DNS",
      status: 'pending',
      message: "Verificando resolução DNS do servidor..."
    });

    try {
      const start = Date.now();
      const url = new URL(API_BASE_URL);
      const response = await fetch(`https://dns.google/resolve?name=${url.hostname}&type=A`);
      const duration = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        addResult({
          test: "Resolução DNS",
          status: 'success',
          message: `DNS resolvido: ${url.hostname}`,
          details: `IP: ${data.Answer?.[0]?.data || 'N/A'}`,
          duration
        });
      }
    } catch (error: any) {
      addResult({
        test: "Resolução DNS",
        status: 'warning',
        message: "Não foi possível verificar DNS",
        details: error.message
      });
    }

    // Test 3: SSL/TLS Certificate
    addResult({
      test: "Certificado SSL/TLS",
      status: 'pending',
      message: "Verificando certificado SSL..."
    });

    try {
      const start = Date.now();
      const response = await fetch(API_BASE_URL, { 
        method: 'HEAD',
        mode: 'no-cors'
      });
      const duration = Date.now() - start;
      
      addResult({
        test: "Certificado SSL/TLS",
        status: 'success',
        message: "Certificado SSL válido",
        duration
      });
    } catch (error: any) {
      if (error.message.includes('SSL') || error.message.includes('certificate')) {
        addResult({
          test: "Certificado SSL/TLS",
          status: 'error',
          message: "Problema com certificado SSL",
          details: "Certificado inválido ou autoassinado"
        });
      } else {
        addResult({
          test: "Certificado SSL/TLS",
          status: 'warning',
          message: "Não foi possível verificar SSL",
          details: error.message
        });
      }
    }

    // Test 4: CORS Headers
    addResult({
      test: "Configuração CORS",
      status: 'pending',
      message: "Verificando headers CORS..."
    });

    try {
      const start = Date.now();
      const response = await fetch(`${API_BASE_URL}/instance/fetchInstances`, {
        method: 'OPTIONS'
      });
      const duration = Date.now() - start;
      
      const corsHeaders = {
        origin: response.headers.get('access-control-allow-origin'),
        methods: response.headers.get('access-control-allow-methods'),
        headers: response.headers.get('access-control-allow-headers')
      };

      if (corsHeaders.origin) {
        addResult({
          test: "Configuração CORS",
          status: 'success',
          message: "CORS configurado corretamente",
          details: `Origin: ${corsHeaders.origin}`,
          duration
        });
      } else {
        addResult({
          test: "Configuração CORS",
          status: 'warning',
          message: "CORS pode estar mal configurado",
          details: "Headers CORS não encontrados"
        });
      }
    } catch (error: any) {
      addResult({
        test: "Configuração CORS",
        status: 'error',
        message: "Erro na verificação CORS",
        details: error.message
      });
    }

    // Test 5A: YUMER Basic Connectivity
    addResult({
      test: "Conectividade YUMER Básica",
      status: 'pending',
      message: "Testando rota pública /..."
    });

    try {
      const start = Date.now();
      const response = await fetch(`${API_BASE_URL}/`, { method: 'GET' });
      const duration = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        addResult({
          test: "Conectividade YUMER Básica",
          status: 'success',
          message: "Servidor YUMER online (rota pública)",
          details: `Status: ${data.status || 'OK'}`,
          duration
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      addResult({
        test: "Conectividade YUMER Básica",
        status: 'error',
        message: "Falha na rota pública",
        details: error.message
      });
    }

    // Test 5B: YUMER Health Check
    addResult({
      test: "YUMER Health Check",
      status: 'pending',
      message: "Testando /health..."
    });

    try {
      const start = Date.now();
      const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
      const duration = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        addResult({
          test: "YUMER Health Check",
          status: 'success',
          message: "Health check passou",
          details: `Status: ${data.status || 'OK'}`,
          duration
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      addResult({
        test: "YUMER Health Check",
        status: 'warning',
        message: "Health check falhou",
        details: error.message
      });
    }

    // Test 5C: YUMER Authenticated APIs
    addResult({
      test: "APIs YUMER Autenticadas",
      status: 'pending',
      message: "Testando APIs com autenticação..."
    });

    try {
      const start = Date.now();
      const healthCheck = await yumerWhatsAppService.checkServerHealth();
      const duration = Date.now() - start;
      
      if (healthCheck.status === 'online' && healthCheck.details.level === 'authenticated') {
        addResult({
          test: "APIs YUMER Autenticadas",
          status: 'success',
          message: "APIs funcionais",
          details: `${healthCheck.details.instanceCount || 0} instâncias encontradas`,
          duration
        });
      } else if (healthCheck.status === 'online') {
        addResult({
          test: "APIs YUMER Autenticadas",
          status: 'warning',
          message: "Servidor online mas APIs podem precisar auth",
          details: `Nível: ${healthCheck.details.level}`
        });
      } else {
        addResult({
          test: "APIs YUMER Autenticadas",
          status: 'error',
          message: "APIs não funcionais",
          details: healthCheck.details.error
        });
      }
    } catch (error: any) {
      addResult({
        test: "APIs YUMER Autenticadas",
        status: 'error',
        message: "Falha nas APIs autenticadas",
        details: error.message
      });
    }

    // Test 6: WebSocket Connection
    addResult({
      test: "Conexão WebSocket",
      status: 'pending',
      message: "Testando conexão WebSocket..."
    });

    try {
      const socket = yumerWhatsAppService.getSocket();
      
      if (socket && socket.connected) {
        addResult({
          test: "Conexão WebSocket",
          status: 'success',
          message: "WebSocket conectado",
          details: `Socket ID: ${socket.id}`
        });
      } else {
        // Try to connect
        try {
          await yumerWhatsAppService.connectWebSocket('test-instance', 'MESSAGE_RECEIVED');
          
          addResult({
            test: "Conexão WebSocket",
            status: 'success',
            message: "WebSocket conectado com sucesso",
            details: `WebSocket nativo YUMER conectado`
          });
        } catch (error: any) {
          throw new Error(`Falha na conexão: ${error.message}`);
        }
      }
    } catch (error: any) {
      addResult({
        test: "Conexão WebSocket",
        status: 'error',
        message: "Falha na conexão WebSocket",
        details: error.message
      });
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'pending':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'warning':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Network className="w-5 h-5" />
              <span>Diagnóstico de Conectividade</span>
            </CardTitle>
            <CardDescription>
              Verifica a conectividade com o servidor YUMER e identifica problemas
            </CardDescription>
          </div>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            variant="outline"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isRunning ? 'Executando...' : 'Executar Diagnóstico'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Configuration Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <h4 className="font-medium text-sm text-gray-600 dark:text-gray-300">API URL</h4>
              <p className="text-sm font-mono break-all">{API_BASE_URL}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-600 dark:text-gray-300">WebSocket URL</h4>
              <p className="text-sm font-mono break-all">{SOCKET_URL}</p>
            </div>
          </div>

          <Separator />

          {/* Diagnostic Results */}
          <div className="space-y-3">
            {diagnostics.length === 0 && !isRunning && (
              <div className="text-center py-8 text-gray-500">
                Clique em "Executar Diagnóstico" para verificar a conectividade
              </div>
            )}

            {diagnostics.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <div className="font-medium">{result.test}</div>
                    <div className="text-sm text-gray-600">{result.message}</div>
                    {result.details && (
                      <div className="text-xs text-gray-500 mt-1">{result.details}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {result.duration && (
                    <span className="text-xs text-gray-500">{result.duration}ms</span>
                  )}
                  <Badge variant={getStatusBadge(result.status)}>
                    {result.status === 'pending' ? 'Testando' : 
                     result.status === 'success' ? 'OK' :
                     result.status === 'warning' ? 'Aviso' : 'Erro'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {diagnostics.some(d => d.status === 'error') && (
            <>
              <Separator />
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                  Problemas Detectados
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  <li>• Verifique se o servidor YUMER está rodando</li>
                  <li>• Confirme se a URL está correta</li>
                  <li>• Verifique configurações de firewall</li>
                  <li>• Teste em navegador diferente</li>
                  <li>• Contate o administrador do sistema</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectionDiagnostics;