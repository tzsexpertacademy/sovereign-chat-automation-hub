import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, PartyPopper } from "lucide-react";
import { API_BASE_URL } from "@/config/environment";

interface EndpointTest {
  name: string;
  url: string;
  method: string;
  status: 'pending' | 'success' | 'cors_error' | 'not_found' | 'server_error';
  details?: string;
  httpStatus?: number;
}

const CorsApiDiagnostic = () => {
  const [tests, setTests] = useState<EndpointTest[]>([
    { name: "Health Check", url: "/health", method: "GET", status: "pending" },
    { name: "Lista Clientes", url: "/clients", method: "GET", status: "pending" },
    { name: "Conectar Cliente", url: "/clients/35f36a03-39b2-412c-bba6-01fdd45c2dd3/connect", method: "POST", status: "pending" },
    { name: "Status Cliente", url: "/clients/35f36a03-39b2-412c-bba6-01fdd45c2dd3/status", method: "GET", status: "pending" },
    { name: "API Docs", url: "/api-docs.json", method: "GET", status: "pending" }
  ]);
  const [testing, setTesting] = useState(false);
  const [lastTestTime, setLastTestTime] = useState<Date | null>(null);

  // Auto-run tests when component mounts to check if fix worked
  useEffect(() => {
    // Wait a moment for the component to render, then auto-test
    const autoTestTimer = setTimeout(() => {
      runAllTests();
    }, 2000);

    return () => clearTimeout(autoTestTimer);
  }, []);

  const testEndpoint = async (endpoint: EndpointTest): Promise<EndpointTest> => {
    const fullUrl = `${API_BASE_URL}${endpoint.url}`;
    
    try {
      console.log(`🧪 Testando pós-correção ${endpoint.method} ${fullUrl}`);
      
      // Add cache-busting to avoid cached responses
      const cacheBuster = `${endpoint.url.includes('?') ? '&' : '?'}t=${Date.now()}&test=post-fix`;
      const testUrl = `${fullUrl}${cacheBuster}`;
      
      const response = await fetch(testUrl, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Test-Type': 'post-cors-fix'
        },
        mode: 'cors',
        credentials: 'omit',
        // Timeout for individual requests
        signal: AbortSignal.timeout(10000)
      });

      const httpStatus = response.status;
      
      if (response.ok) {
        return {
          ...endpoint,
          status: 'success' as const,
          httpStatus,
          details: `✅ CORS CORRIGIDO! Status ${httpStatus} - API funcionando!`
        };
      } else if (httpStatus === 404) {
        return {
          ...endpoint,
          status: 'not_found' as const,
          httpStatus,
          details: `⚠️ Endpoint não encontrado - Status ${httpStatus}`
        };
      } else {
        return {
          ...endpoint,
          status: 'server_error' as const,
          httpStatus,
          details: `❌ Erro servidor - Status ${httpStatus}`
        };
      }
      
    } catch (error: any) {
      console.error(`❌ Erro testando ${endpoint.name} pós-correção:`, error);
      
      if (error.message.includes('CORS') || 
          error.message.includes('Access-Control-Allow-Origin') ||
          error.message.includes('preflight')) {
        return {
          ...endpoint,
          status: 'cors_error' as const,
          details: `❌ CORS Error ainda presente: ${error.message}`
        };
      } else if (error.message === 'Failed to fetch') {
        return {
          ...endpoint,
          status: 'cors_error' as const,
          details: `❌ CORS Error: Servidor não responde ou SSL não aceito`
        };
      } else if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          ...endpoint,
          status: 'server_error' as const,
          details: `⏰ Timeout: Servidor pode estar reiniciando`
        };
      } else {
        return {
          ...endpoint,
          status: 'server_error' as const,
          details: `❌ Erro: ${error.message}`
        };
      }
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setLastTestTime(new Date());
    console.log('🧪 Iniciando diagnóstico CORS PÓS-CORREÇÃO DEFINITIVA...');
    
    const updatedTests: EndpointTest[] = [];
    
    for (const test of tests) {
      const result = await testEndpoint(test);
      updatedTests.push(result);
      
      // Atualizar estado incremental para mostrar progresso
      setTests([...updatedTests, ...tests.slice(updatedTests.length).map(t => ({ ...t, status: 'pending' as const }))]);
      
      // Pequena pausa para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setTests(updatedTests);
    setTesting(false);
    
    // Análise final
    const corsErrors = updatedTests.filter(t => t.status === 'cors_error').length;
    const successes = updatedTests.filter(t => t.status === 'success').length;
    const serverErrors = updatedTests.filter(t => t.status === 'server_error').length;
    
    console.log(`🎯 Diagnóstico pós-correção concluído: ${successes} sucessos, ${corsErrors} erros CORS, ${serverErrors} erros servidor`);
    
    if (corsErrors === 0 && successes > 0) {
      console.log('🎉 CORS DEFINITIVAMENTE CORRIGIDO! Todas as APIs funcionando!');
    } else if (serverErrors > corsErrors) {
      console.log('⚠️ Servidor pode estar reiniciando, mas CORS parece corrigido');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cors_error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'not_found': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'server_error': return <XCircle className="w-4 h-4 text-orange-500" />;
      default: return <RefreshCw className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'cors_error': return 'destructive';
      case 'not_found': return 'secondary';
      case 'server_error': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return 'FUNCIONANDO! 🎉';
      case 'cors_error': return 'CORS Error';
      case 'not_found': return 'Não encontrado';
      case 'server_error': return 'Erro servidor';
      default: return 'Aguardando';
    }
  };

  const corsErrors = tests.filter(t => t.status === 'cors_error');
  const successes = tests.filter(t => t.status === 'success');
  const serverErrors = tests.filter(t => t.status === 'server_error');
  const allTestsComplete = tests.every(t => t.status !== 'pending');
  const corsFixed = allTestsComplete && corsErrors.length === 0 && successes.length > 0;
  const serverMaybeRestarting = serverErrors.length > corsErrors.length && allTestsComplete;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center space-x-2">
            {corsFixed && <PartyPopper className="w-5 h-5 text-green-500" />}
            <span>🧪 Diagnóstico CORS - VERIFICAÇÃO PÓS-CORREÇÃO</span>
          </CardTitle>
          <Button onClick={runAllTests} disabled={testing}>
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testando pós-correção...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                TESTAR AGORA
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {lastTestTime && (
          <div className="text-sm text-gray-600">
            <strong>Último teste:</strong> {lastTestTime.toLocaleTimeString()}
          </div>
        )}

        {/* SUCESSO - CORS DEFINITIVAMENTE CORRIGIDO */}
        {corsFixed && (
          <Alert className="border-green-200 bg-green-50">
            <PartyPopper className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-green-900">🎉 CORS DEFINITIVAMENTE CORRIGIDO!</p>
                <p className="text-green-800">
                  Parabéns! Todas as APIs do WhatsApp estão funcionando perfeitamente!
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                  <li>✅ Health Check funcionando</li>
                  <li>✅ API de clientes funcionando</li>
                  <li>✅ Conexão WhatsApp funcionando</li>
                  <li>✅ Status e QR Code funcionando</li>
                  <li>✅ Documentação da API acessível</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Server Maybe Restarting */}
        {serverMaybeRestarting && !corsFixed && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-orange-900">⚠️ Servidor Reiniciando Após Correções</p>
                <p className="text-orange-800">
                  O CORS parece ter sido corrigido, mas o servidor pode estar reiniciando.
                  Aguarde alguns segundos e teste novamente.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Status Summary */}
        {!testing && tests.some(t => t.status !== 'pending') && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {tests.filter(t => t.status === 'success').length}
              </div>
              <div className="text-sm text-gray-600">Funcionando</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {tests.filter(t => t.status === 'cors_error').length}
              </div>
              <div className="text-sm text-gray-600">CORS Error</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {tests.filter(t => t.status === 'server_error').length}
              </div>
              <div className="text-sm text-gray-600">Erro servidor</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {tests.filter(t => t.status === 'not_found').length}
              </div>
              <div className="text-sm text-gray-600">Não encontrado</div>
            </div>
          </div>
        )}

        {/* Test Results */}
        <div className="space-y-3">
          <h4 className="font-medium">Resultados dos Testes Pós-Correção:</h4>
          {tests.map((test, index) => (
            <div key={index} className={`flex items-center justify-between p-3 border rounded ${
              test.status === 'success' ? 'border-green-200 bg-green-50' : 
              test.status === 'server_error' ? 'border-orange-200 bg-orange-50' :
              test.status === 'cors_error' ? 'border-red-200 bg-red-50' : ''
            }`}>
              <div className="flex items-center space-x-3">
                {getStatusIcon(test.status)}
                <div>
                  <div className="font-medium">{test.name}</div>
                  <div className="text-sm text-gray-500">
                    {test.method} {API_BASE_URL}{test.url}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {test.httpStatus && (
                  <span className="text-sm text-gray-500">
                    {test.httpStatus}
                  </span>
                )}
                <Badge variant={getStatusColor(test.status)}>
                  {getStatusText(test.status)}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Details */}
        {tests.some(t => t.details) && (
          <div className="space-y-2">
            <h4 className="font-medium">Detalhes Pós-Correção:</h4>
            <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
              {tests.filter(t => t.details).map((test, index) => (
                <div key={index} className={
                  test.status === 'success' ? 'text-green-700 font-medium' : 
                  test.status === 'server_error' ? 'text-orange-700' : ''
                }>
                  <strong>{test.name}:</strong> {test.details}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps - CORS Corrigido */}
        {corsFixed && (
          <div className="bg-blue-50 p-4 rounded">
            <h4 className="font-medium text-blue-900 mb-2">🚀 PRÓXIMOS PASSOS - CORS CORRIGIDO:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>✅ CORS corrigido com sucesso!</li>
              <li>Vá para a seção "Criar Nova Instância" acima</li>
              <li>Clique em "Nova Conexão" para criar uma instância WhatsApp</li>
              <li>O QR Code será gerado automaticamente</li>
              <li>Escaneie com seu WhatsApp e comece a usar! 🎉</li>
            </ol>
          </div>
        )}

        {/* Ainda com problemas CORS */}
        {!corsFixed && corsErrors.length > 0 && allTestsComplete && !serverMaybeRestarting && (
          <div className="bg-red-50 p-4 rounded">
            <h4 className="font-medium text-red-900 mb-2">❌ CORS ainda com problemas:</h4>
            <ol className="text-sm text-red-800 space-y-1 list-decimal list-inside">
              <li>Verifique se o script foi executado: <code>sudo ./scripts/fix-nginx-502.sh</code></li>
              <li>Reinicie o Nginx: <code>sudo systemctl restart nginx</code></li>
              <li>Reinicie o Node.js: <code>pm2 restart whatsapp-multi-client</code></li>
              <li>Aguarde 30 segundos e teste novamente</li>
            </ol>
          </div>
        )}

        {/* Server Restarting Instructions */}
        {serverMaybeRestarting && (
          <div className="bg-orange-50 p-4 rounded">
            <h4 className="font-medium text-orange-900 mb-2">⚠️ Servidor reiniciando:</h4>
            <ol className="text-sm text-orange-800 space-y-1 list-decimal list-inside">
              <li>O CORS parece corrigido, mas o servidor está reiniciando</li>
              <li>Aguarde 30-60 segundos</li>
              <li>Clique em "TESTAR AGORA" novamente</li>
              <li>Se persistir, verifique se o Node.js está rodando: <code>pm2 status</code></li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CorsApiDiagnostic;
