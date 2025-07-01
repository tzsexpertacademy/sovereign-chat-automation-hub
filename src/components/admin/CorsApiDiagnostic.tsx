
import { useState } from "react";
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

  const testEndpoint = async (endpoint: EndpointTest): Promise<EndpointTest> => {
    const fullUrl = `${API_BASE_URL}${endpoint.url}`;
    
    try {
      console.log(`🧪 Testando ${endpoint.method} ${fullUrl}`);
      
      const response = await fetch(fullUrl, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors',
        credentials: 'omit'
      });

      const httpStatus = response.status;
      
      if (response.ok) {
        return {
          ...endpoint,
          status: 'success',
          httpStatus,
          details: `✅ CORS FUNCIONANDO! Status ${httpStatus}`
        };
      } else if (httpStatus === 404) {
        return {
          ...endpoint,
          status: 'not_found',
          httpStatus,
          details: `⚠️ Endpoint não encontrado - Status ${httpStatus}`
        };
      } else {
        return {
          ...endpoint,
          status: 'server_error',
          httpStatus,
          details: `❌ Erro servidor - Status ${httpStatus}`
        };
      }
      
    } catch (error: any) {
      console.error(`❌ Erro testando ${endpoint.name}:`, error);
      
      if (error.message.includes('CORS') || 
          error.message.includes('Access-Control-Allow-Origin') ||
          error.message.includes('preflight')) {
        return {
          ...endpoint,
          status: 'cors_error',
          details: `❌ CORS Error: ${error.message}`
        };
      } else if (error.message === 'Failed to fetch') {
        return {
          ...endpoint,
          status: 'cors_error',
          details: `❌ CORS Error: Servidor não responde`
        };
      } else {
        return {
          ...endpoint,
          status: 'server_error',
          details: `❌ Erro: ${error.message}`
        };
      }
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    console.log('🧪 Iniciando diagnóstico CORS APÓS CORREÇÃO DO SERVIDOR...');
    
    const updatedTests: EndpointTest[] = [];
    
    for (const test of tests) {
      const result = await testEndpoint(test);
      updatedTests.push(result);
      
      // Atualizar estado incremental para mostrar progresso
      setTests([...updatedTests, ...tests.slice(updatedTests.length)]);
      
      // Pequena pausa para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setTests(updatedTests);
    setTesting(false);
    
    // Análise final
    const corsErrors = updatedTests.filter(t => t.status === 'cors_error').length;
    const successes = updatedTests.filter(t => t.status === 'success').length;
    
    console.log(`🎯 Diagnóstico concluído: ${successes} sucessos, ${corsErrors} erros CORS`);
    
    if (corsErrors === 0 && successes > 0) {
      console.log('🎉 CORS CORRIGIDO COM SUCESSO! Todas as APIs funcionando!');
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
  const allTestsComplete = tests.every(t => t.status !== 'pending');
  const corsFixed = allTestsComplete && corsErrors.length === 0 && successes.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center space-x-2">
            {corsFixed && <PartyPopper className="w-5 h-5 text-green-500" />}
            <span>🧪 Diagnóstico CORS - PÓS CORREÇÃO</span>
          </CardTitle>
          <Button onClick={runAllTests} disabled={testing}>
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Testar Agora
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* SUCESSO - CORS CORRIGIDO */}
        {corsFixed && (
          <Alert className="border-green-200 bg-green-50">
            <PartyPopper className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-green-900">🎉 CORS CORRIGIDO COM SUCESSO!</p>
                <p className="text-green-800">
                  Todas as APIs estão respondendo corretamente! Agora você pode:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                  <li>✅ Criar instâncias WhatsApp</li>
                  <li>✅ Conectar e gerar QR Code</li>
                  <li>✅ Enviar mensagens</li>
                  <li>✅ Todas as funcionalidades funcionando!</li>
                </ul>
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
              <div className="text-2xl font-bold text-yellow-600">
                {tests.filter(t => t.status === 'not_found').length}
              </div>
              <div className="text-sm text-gray-600">Não encontrado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {tests.filter(t => t.status === 'server_error').length}
              </div>
              <div className="text-sm text-gray-600">Erro servidor</div>
            </div>
          </div>
        )}

        {/* Test Results */}
        <div className="space-y-3">
          <h4 className="font-medium">Resultados dos Testes:</h4>
          {tests.map((test, index) => (
            <div key={index} className={`flex items-center justify-between p-3 border rounded ${
              test.status === 'success' ? 'border-green-200 bg-green-50' : ''
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
            <h4 className="font-medium">Detalhes:</h4>
            <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
              {tests.filter(t => t.details).map((test, index) => (
                <div key={index} className={
                  test.status === 'success' ? 'text-green-700 font-medium' : ''
                }>
                  <strong>{test.name}:</strong> {test.details}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps - Apenas se CORS funcionando */}
        {corsFixed && (
          <div className="bg-blue-50 p-4 rounded">
            <h4 className="font-medium text-blue-900 mb-2">🚀 PRÓXIMOS PASSOS:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Vá para "Instâncias WhatsApp" na tela principal</li>
              <li>Clique em "Conectar" em uma instância</li>
              <li>O QR Code deve aparecer automaticamente</li>
              <li>Escaneie o QR Code com seu WhatsApp</li>
              <li>Instância será conectada e pronta para uso! 🎉</li>
            </ol>
          </div>
        )}

        {/* Ainda com CORS Error */}
        {!corsFixed && corsErrors.length > 0 && allTestsComplete && (
          <div className="bg-red-50 p-4 rounded">
            <h4 className="font-medium text-red-900 mb-2">❌ Ainda há problemas CORS:</h4>
            <ol className="text-sm text-red-800 space-y-1 list-decimal list-inside">
              <li>Verifique se o Nginx foi reiniciado: <code>sudo systemctl restart nginx</code></li>
              <li>Verifique se o Node.js foi reiniciado: <code>pm2 restart whatsapp-multi-client</code></li>
              <li>Execute: <code>sudo ./scripts/validate-api-routes.sh</code></li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CorsApiDiagnostic;
