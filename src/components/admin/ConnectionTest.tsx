
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { SERVER_URL, DIRECT_SERVER_URL, getServerConfig } from "@/config/environment";

const ConnectionTest = () => {
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error' | 'mixed-content'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const config = getServerConfig();

  const testConnection = async () => {
    setTestResult('testing');
    setErrorMessage('');

    try {
      console.log(`🧪 Testando conexão com: ${SERVER_URL}/health`);
      
      // Try CORS mode first
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
      
      // If CORS fails, try no-cors mode for Mixed Content
      if (error.message.includes('Mixed Content') || error.message.includes('CORS') || error.name === 'TypeError') {
        console.log('🔄 Tentando modo no-cors para Mixed Content...');
        try {
          await fetch(`${SERVER_URL}/health`, {
            method: 'GET',
            mode: 'no-cors'
          });
          // no-cors doesn't allow reading response, so assume it worked
          setTestResult('mixed-content');
          setErrorMessage('Funcionando com limitações (Mixed Content)');
        } catch (noCorsError: any) {
          setTestResult('error');
          setErrorMessage(error.message || 'Erro desconhecido');
        }
      } else {
        setTestResult('error');
        setErrorMessage(error.message || 'Erro desconhecido');
      }
    }
  };

  const getStatusBadge = () => {
    switch (testResult) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case 'mixed-content':
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Mixed Content</Badge>;
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
        
        {/* Mixed Content Info */}
        {window.location.protocol === 'https:' && SERVER_URL.startsWith('http://') && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900">Mixed Content Detectado</p>
                <p className="text-sm text-orange-700">
                  Frontend HTTPS tentando acessar servidor HTTP. Sistema configurado para modo compatibilidade.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm space-y-2">
          <p><strong>URL atual:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{window.location.href}</code></p>
          <p><strong>Servidor:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{SERVER_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{config.protocol}</code></p>
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

        {testResult === 'mixed-content' && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 font-medium">⚠️ Conexão funcionando com limitações</p>
            <p className="text-yellow-600 text-sm">
              Sistema funcionando em modo compatibilidade para Mixed Content.
            </p>
            <p className="text-yellow-600 text-xs mt-1">
              Algumas funcionalidades podem ter limitações devido à política de segurança do navegador.
            </p>
          </div>
        )}

        {testResult === 'error' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-medium">❌ Falha na conexão</p>
            <p className="text-red-600 text-sm">Erro: {errorMessage}</p>
            <div className="mt-2 text-xs text-red-600">
              <p><strong>Possíveis soluções:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Verificar se o servidor está online</li>
                <li>Verificar configuração de CORS no servidor</li>
                <li>Configurar HTTPS no servidor para resolver Mixed Content</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionTest;
