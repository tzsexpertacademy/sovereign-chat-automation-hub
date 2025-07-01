
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
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
    { name: "Conectar Cliente", url: "/clients/test-instance/connect", method: "POST", status: "pending" },
    { name: "Desconectar Cliente", url: "/clients/test-instance/disconnect", method: "POST", status: "pending" },
    { name: "Status Cliente", url: "/clients/test-instance/status", method: "GET", status: "pending" },
    { name: "Enviar Mensagem", url: "/clients/test-instance/send-message", method: "POST", status: "pending" },
    { name: "Listar Chats", url: "/clients/test-instance/chats", method: "GET", status: "pending" },
    { name: "API Docs JSON", url: "/api-docs.json", method: "GET", status: "pending" },
    { name: "API Docs Interface", url: "/api-docs", method: "GET", status: "pending" }
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
          details: `✅ Success - Status ${httpStatus}`
        };
      } else if (httpStatus === 404) {
        return {
          ...endpoint,
          status: 'not_found',
          httpStatus,
          details: `⚠️ Endpoint não implementado - Status ${httpStatus}`
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
          details: `❌ CORS Error: Sem header Access-Control-Allow-Origin`
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
    console.log('🧪 Iniciando diagnóstico CORS dos endpoints da API...');
    
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
      case 'success': return 'OK';
      case 'cors_error': return 'CORS Error';
      case 'not_found': return 'Não implementado';
      case 'server_error': return 'Erro servidor';
      default: return 'Aguardando';
    }
  };

  const corsErrors = tests.filter(t => t.status === 'cors_error');
  const hasApiCorsIssues = corsErrors.some(t => t.url.includes('/clients/'));

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>🧪 Diagnóstico CORS da API</CardTitle>
          <Button onClick={runAllTests} disabled={testing}>
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Testar Endpoints
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
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
              <div className="text-sm text-gray-600">Não implementado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {tests.filter(t => t.status === 'server_error').length}
              </div>
              <div className="text-sm text-gray-600">Erro servidor</div>
            </div>
          </div>
        )}

        {/* API CORS Issue Alert */}
        {hasApiCorsIssues && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">🎯 PROBLEMA IDENTIFICADO:</p>
                <p>Os endpoints da API <code>/clients/*</code> não têm CORS configurado!</p>
                <p className="text-sm">
                  <strong>Solução:</strong> Configure CORS no servidor backend para todos os endpoints da API, 
                  não apenas para <code>/health</code>.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Test Results */}
        <div className="space-y-3">
          <h4 className="font-medium">Resultados dos Testes:</h4>
          {tests.map((test, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded">
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
                <div key={index}>
                  <strong>{test.name}:</strong> {test.details}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 p-4 rounded">
          <h4 className="font-medium text-blue-900 mb-2">📋 Como corrigir:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Execute: <code>sudo ./scripts/fix-cors-duplicate.sh</code></li>
            <li>Verifique configuração CORS no servidor Node.js</li>
            <li>Certifique-se que CORS está aplicado a TODOS os endpoints</li>
            <li>Reinicie o servidor: <code>pm2 restart whatsapp-multi-client</code></li>
            <li>Execute este diagnóstico novamente</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default CorsApiDiagnostic;
