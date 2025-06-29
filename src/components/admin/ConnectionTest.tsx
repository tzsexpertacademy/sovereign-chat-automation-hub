
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { SERVER_URL, DIRECT_SERVER_URL, getServerConfig } from "@/config/environment";

const ConnectionTest = () => {
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [proxyTest, setProxyTest] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const config = getServerConfig();

  const testConnection = async () => {
    setTestResult('testing');
    setErrorMessage('');

    try {
      console.log(`🧪 Testando conexão com: ${SERVER_URL}/health`);
      
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Teste de conexão bem-sucedido:', data);
        setTestResult('success');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('❌ Teste de conexão falhou:', error);
      setTestResult('error');
      setErrorMessage(error.message || 'Erro desconhecido');
    }
  };

  const testProxyConnection = async () => {
    setProxyTest('testing');

    try {
      console.log(`🧪 Testando proxy CORS...`);
      
      const response = await fetch('https://cors-anywhere.herokuapp.com/http://httpbin.org/get', {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (response.ok) {
        setProxyTest('success');
        console.log('✅ Proxy CORS funcionando');
      } else {
        throw new Error(`Proxy não ativo: ${response.status}`);
      }
    } catch (error: any) {
      console.error('❌ Teste do proxy falhou:', error);
      setProxyTest('error');
    }
  };

  const getStatusBadge = () => {
    switch (testResult) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      case 'testing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Testando</Badge>;
      default:
        return <Badge variant="outline">Não testado</Badge>;
    }
  };

  const getProxyBadge = () => {
    switch (proxyTest) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Ativo</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Inativo</Badge>;
      case 'testing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Testando</Badge>;
      default:
        return <Badge variant="outline">Não testado</Badge>;
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          🔧 Teste de Conectividade Avançado
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Mixed Content Warning */}
        {config.usingProxy && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900">Mixed Content Security</p>
                <p className="text-sm text-orange-700">
                  HTTPS não pode acessar HTTP diretamente. Usando proxy CORS.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm space-y-2">
          <p><strong>URL atual:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{window.location.href}</code></p>
          <p><strong>Servidor direto:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{DIRECT_SERVER_URL}</code></p>
          <p><strong>URL em uso:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{SERVER_URL}</code></p>
          {config.usingProxy && (
            <p><strong>Usando proxy:</strong> <code className="bg-orange-100 px-2 py-1 rounded text-orange-800">Sim (CORS)</code></p>
          )}
        </div>

        <div className="flex space-x-2">
          <Button onClick={testConnection} disabled={testResult === 'testing'}>
            {testResult === 'testing' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              'Testar Servidor'
            )}
          </Button>

          {config.usingProxy && (
            <Button onClick={testProxyConnection} disabled={proxyTest === 'testing'} variant="outline">
              {proxyTest === 'testing' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testando Proxy...
                </>
              ) : (
                <>
                  Testar Proxy
                  {getProxyBadge()}
                </>
              )}
            </Button>
          )}
        </div>

        {testResult === 'success' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">✅ Conexão estabelecida com sucesso!</p>
            <p className="text-green-600 text-sm">O servidor WhatsApp está respondendo corretamente.</p>
          </div>
        )}

        {testResult === 'error' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-medium">❌ Falha na conexão</p>
            <p className="text-red-600 text-sm">Erro: {errorMessage}</p>
            <div className="mt-2 text-xs text-red-600">
              <p><strong>Soluções para Mixed Content:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Ative o proxy CORS no botão acima</li>
                <li>Configure HTTPS no servidor VPS</li>
                <li>Use nginx como proxy HTTPS</li>
                <li>Configure certificado SSL no servidor</li>
              </ul>
            </div>
          </div>
        )}

        {proxyTest === 'error' && config.usingProxy && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 font-medium">⚠️ Proxy CORS Inativo</p>
            <p className="text-yellow-700 text-sm">
              Clique em "Ativar Proxy CORS" para habilitar o serviço temporário.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionTest;
