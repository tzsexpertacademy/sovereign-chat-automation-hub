
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { SERVER_URL } from "@/config/environment";

const ConnectionTest = () => {
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const testConnection = async () => {
    setTestResult('testing');
    setErrorMessage('');

    try {
      console.log(`🧪 Testando conexão com: ${SERVER_URL}/health`);
      
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-2">
          <p><strong>URL atual:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{window.location.href}</code></p>
          <p><strong>Porta frontend:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{window.location.port || '80/443'}</code></p>
          <p><strong>Servidor backend:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{SERVER_URL}</code></p>
        </div>

        <Button onClick={testConnection} disabled={testResult === 'testing'}>
          {testResult === 'testing' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testando...
            </>
          ) : (
            'Testar Conexão'
          )}
        </Button>

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
                <li>Verifique se o servidor WhatsApp está rodando na porta 4000</li>
                <li>Se estiver no navegador, permita conteúdo não seguro (HTTP mixed content)</li>
                <li>Verifique se não há firewall bloqueando a conexão</li>
                <li>Confirme se o CORS está configurado no servidor</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionTest;
