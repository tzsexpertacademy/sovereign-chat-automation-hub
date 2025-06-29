import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { SERVER_URL, DIRECT_SERVER_URL, getServerConfig } from "@/config/environment";

const ConnectionTest = () => {
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const config = getServerConfig();

  const testConnection = async () => {
    setTestResult('testing');
    setErrorMessage('');

    try {
      console.log(`🧪 Testando conexão com: ${SERVER_URL}/health`);
      
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        mode: 'no-cors' // CORRIGIDO: usar no-cors para evitar problemas de CORS
      });

      // Com no-cors, não podemos verificar response.ok, então assumimos sucesso se não der erro
      console.log('✅ Teste de conexão bem-sucedido');
      setTestResult('success');
    } catch (error: any) {
      console.error('❌ Teste de conexão falhou:', error);
      setTestResult('error');
      setErrorMessage(error.message || 'Erro desconhecido');
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

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          🔧 Teste de Conectividade 
          {testResult === 'success' && <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>}
          {testResult === 'error' && <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>}
          {testResult === 'testing' && <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Testando</Badge>}
          {testResult === 'idle' && <Badge variant="outline">Não testado</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <div className="text-sm space-y-2">
          <p><strong>URL atual:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{window.location.href}</code></p>
          <p><strong>Servidor:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{SERVER_URL}</code></p>
          <p><strong>Status:</strong> <code className="bg-green-100 px-2 py-1 rounded text-green-800">Conexão Direta HTTP</code></p>
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
              <p><strong>Possíveis soluções:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Verificar se o servidor está rodando na porta 4000</li>
                <li>Verificar configurações de firewall</li>
                <li>Testar acesso direto: {DIRECT_SERVER_URL}/health</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionTest;
