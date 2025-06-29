
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { getServerConfig, resetConnectionCache, getAlternativeServerConfig } from "@/config/environment";

const ConnectionTest = () => {
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentServerUrl, setCurrentServerUrl] = useState('');
  const [detectedProtocol, setDetectedProtocol] = useState('');

  const testConnection = async () => {
    setTestResult('testing');
    setErrorMessage('');
    setCurrentServerUrl('');
    
    try {
      console.log('🔍 Iniciando teste de conectividade inteligente...');
      
      // Resetar cache para nova detecção
      resetConnectionCache();
      
      // Obter configuração com detecção automática
      const config = await getServerConfig();
      setCurrentServerUrl(config.serverUrl);
      setDetectedProtocol(config.protocol.toUpperCase());
      
      console.log(`🧪 Testando conexão com: ${config.serverUrl}/health`);
      
      const response = await fetch(`${config.serverUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000) // 10 segundos timeout
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
      
      // Tentar configuração alternativa
      const altConfig = getAlternativeServerConfig();
      if (altConfig && error.message.includes('SSL')) {
        console.log(`🔄 SSL falhou, tentando alternativa: ${altConfig.serverUrl}`);
        
        try {
          const altResponse = await fetch(`${altConfig.serverUrl}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000)
          });
          
          if (altResponse.ok) {
            setCurrentServerUrl(altConfig.serverUrl);
            setDetectedProtocol(altConfig.protocol.toUpperCase());
            setTestResult('success');
            console.log('✅ Conexão alternativa funcionou!');
            return;
          }
        } catch (altError) {
          console.error('❌ Conexão alternativa também falhou:', altError);
        }
      }
      
      setTestResult('error');
      if (error.name === 'AbortError') {
        setErrorMessage('Timeout - Servidor demorou para responder');
      } else if (error.message.includes('SSL') || error.message.includes('ERR_SSL')) {
        setErrorMessage('Problema com certificado SSL - Servidor pode estar configurado apenas para HTTP');
      } else {
        setErrorMessage(error.message || 'Erro desconhecido');
      }
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
          🔧 Teste de Conectividade Inteligente
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-2">
          <p><strong>URL atual:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{window.location.href}</code></p>
          <p><strong>Porta frontend:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{window.location.port || '80/443'}</code></p>
          {currentServerUrl && (
            <>
              <p><strong>Servidor detectado:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{currentServerUrl}</code></p>
              <p><strong>Protocolo:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{detectedProtocol}</code></p>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={testConnection} disabled={testResult === 'testing'}>
            {testResult === 'testing' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Testar Conexão
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              resetConnectionCache();
              setTestResult('idle');
              setCurrentServerUrl('');
              setDetectedProtocol('');
            }}
          >
            Reset Cache
          </Button>
        </div>

        {testResult === 'success' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">✅ Conexão estabelecida com sucesso!</p>
            <p className="text-green-600 text-sm">
              Servidor WhatsApp respondendo via {detectedProtocol} em: {currentServerUrl}
            </p>
            <div className="mt-2 text-xs text-green-600">
              <p><strong>Detecção automática funcionou!</strong></p>
              <p>• Protocolo: {detectedProtocol}</p>
              <p>• URL: {currentServerUrl}</p>
            </div>
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
                <li>Se erro SSL, servidor pode estar apenas em HTTP</li>
                <li>Tente: <code className="bg-red-100 px-1 rounded">http://146.59.227.248:4000</code></li>
                <li>Verifique firewall e portas abertas</li>
              </ul>
            </div>
          </div>
        )}

        {testResult === 'testing' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800 font-medium">🔍 Detectando melhor conexão...</p>
            <p className="text-blue-600 text-sm">
              Testando HTTPS primeiro, com fallback para HTTP se necessário
            </p>
            <div className="mt-2 space-y-1 text-xs text-blue-600">
              <p>• Verificando certificado SSL...</p>
              <p>• Testando conectividade HTTP/HTTPS...</p>
              <p>• Aplicando configuração ideal...</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionTest;
