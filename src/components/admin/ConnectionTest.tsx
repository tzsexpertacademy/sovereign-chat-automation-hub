
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { SERVER_URL, getServerConfig } from "@/config/environment";

const ConnectionTest = () => {
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error' | 'ssl-error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const config = getServerConfig();

  const testConnection = async () => {
    setTestResult('testing');
    setErrorMessage('');
    setServerInfo(null);

    try {
      console.log(`🧪 Testando conexão HTTPS DEFINITIVO: ${SERVER_URL}/health`);
      
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': window.location.origin
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Teste HTTPS DEFINITIVO bem-sucedido:', data);
        setServerInfo(data);
        setTestResult('success');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('❌ Teste HTTPS DEFINITIVO falhou:', error);
      
      if (error.message.includes('SSL') || 
          error.message.includes('certificate') || 
          error.message.includes('TLS') ||
          error.message.includes('ERR_SSL_KEY_USAGE_INCOMPATIBLE') ||
          error.name === 'TypeError' && error.message === 'Failed to fetch') {
        setTestResult('ssl-error');
        setErrorMessage('Certificado SSL precisa ser aceito no navegador');
      } else {
        setTestResult('error');
        setErrorMessage(error.message || 'Erro desconhecido');
      }
    }
  };

  const getStatusBadge = () => {
    switch (testResult) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />HTTPS OK</Badge>;
      case 'ssl-error':
        return <Badge className="bg-orange-500"><AlertTriangle className="w-3 h-3 mr-1" />SSL Error</Badge>;
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
          🔒 Teste HTTPS Definitivo
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* SSL Certificate Warning */}
        {config.isHttps && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Certificado SSL Autoassinado</p>
                <p className="text-sm text-blue-700">
                  Você precisa aceitar o certificado SSL no navegador antes de testar.
                </p>
                <Button size="sm" variant="outline" className="mt-2" asChild>
                  <a href={`${SERVER_URL}/health`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Aceitar Certificado
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm space-y-2">
          <p><strong>Frontend URL:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{window.location.href}</code></p>
          <p><strong>Servidor HTTPS:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{SERVER_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{config.protocol}</code></p>
          <p><strong>Nginx Proxy:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{config.nginxProxy ? 'Ativo' : 'Inativo'}</code></p>
        </div>

        <div className="flex space-x-2">
          <Button onClick={testConnection} disabled={testResult === 'testing'}>
            {testResult === 'testing' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testando HTTPS...
              </>
            ) : (
              'Testar HTTPS Definitivo'
            )}
          </Button>
        </div>

        {testResult === 'success' && serverInfo && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">✅ HTTPS Definitivo funcionando!</p>
            <p className="text-green-600 text-sm">Servidor: {serverInfo.server}</p>
            <p className="text-green-600 text-sm">Versão: {serverInfo.version}</p>
            <p className="text-green-600 text-sm">CORS: {serverInfo.cors?.status || 'Configurado'}</p>
            {serverInfo.cors?.lovableSupport && (
              <p className="text-green-600 text-sm">💚 Suporte Lovable: Ativo</p>
            )}
          </div>
        )}

        {testResult === 'ssl-error' && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded">
            <p className="text-orange-800 font-medium">🔒 Certificado SSL precisa ser aceito</p>
            <p className="text-orange-600 text-sm mb-3">
              O navegador está bloqueando o certificado autoassinado.
            </p>
            <div className="space-y-2">
              <p className="text-orange-600 text-sm font-medium">Passos para aceitar:</p>
              <ol className="text-orange-600 text-sm list-decimal list-inside space-y-1">
                <li>Clique no botão "Aceitar Certificado" acima</li>
                <li>Na nova aba, clique em "Avançado"</li>
                <li>Clique em "Prosseguir para 146.59.227.248"</li>
                <li>Volte aqui e teste novamente</li>
              </ol>
            </div>
          </div>
        )}

        {testResult === 'error' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-medium">❌ Erro na conexão HTTPS</p>
            <p className="text-red-600 text-sm">Erro: {errorMessage}</p>
            <div className="mt-2 text-xs text-red-600">
              <p><strong>Possíveis soluções:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Verificar se o Nginx está rodando</li>
                <li>Verificar se o certificado SSL está configurado</li>
                <li>Aceitar o certificado autoassinado no navegador</li>
                <li>Verificar se o servidor backend está rodando</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionTest;
