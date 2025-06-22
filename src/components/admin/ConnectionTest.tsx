
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { SERVER_URL } from "@/config/environment";

const ConnectionTest = () => {
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [serverInfo, setServerInfo] = useState<any>(null);

  const testConnection = async () => {
    setTestResult('testing');
    setErrorMessage('');
    setServerInfo(null);

    try {
      console.log(`🧪 [CONNECTION TEST] Testando: ${SERVER_URL}/health`);
      
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [CONNECTION TEST] Sucesso:', data);
        setTestResult('success');
        setServerInfo(data);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('❌ [CONNECTION TEST] Falhou:', error);
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
          🔧 Diagnóstico de Conectividade
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Informações de Configuração */}
        <div className="text-sm space-y-2">
          <p><strong>Frontend URL:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{typeof window !== 'undefined' ? window.location.href : 'N/A'}</code></p>
          <p><strong>Servidor configurado:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{SERVER_URL}</code></p>
          <p><strong>Endpoint de teste:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{SERVER_URL}/health</code></p>
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

        {/* Resultado Sucesso */}
        {testResult === 'success' && serverInfo && (
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-800 font-medium">✅ Servidor Online e Funcionando!</p>
                <div className="mt-2 text-sm text-green-700 space-y-1">
                  <p><strong>Status:</strong> {serverInfo.status}</p>
                  <p><strong>Clientes Ativos:</strong> {serverInfo.activeClients || 0}</p>
                  <p><strong>Clientes Conectados:</strong> {serverInfo.connectedClients || 0}</p>
                  <p><strong>Uptime:</strong> {Math.floor((serverInfo.uptime || 0) / 60)} minutos</p>
                  <p><strong>Versão:</strong> {serverInfo.version || 'N/A'}</p>
                </div>
                <div className="mt-3 flex space-x-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`${SERVER_URL}/health`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Health Check
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`${SERVER_URL}/api-docs`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      API Docs
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resultado Erro */}
        {testResult === 'error' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <div className="flex items-start space-x-2">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">❌ Falha na Conexão</p>
                <p className="text-red-600 text-sm mt-1">Erro: {errorMessage}</p>
                
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-red-800">Possíveis Soluções:</p>
                  <div className="text-xs text-red-600 space-y-1">
                    <div className="flex items-start space-x-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5" />
                      <span>Verificar se o servidor está rodando: <code className="bg-red-100 px-1 rounded">./scripts/production-start-whatsapp.sh</code></span>
                    </div>
                    <div className="flex items-start space-x-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5" />
                      <span>Verificar status: <code className="bg-red-100 px-1 rounded">./scripts/check-whatsapp-health.sh</code></span>
                    </div>
                    <div className="flex items-start space-x-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5" />
                      <span>Se 502 Bad Gateway: verificar nginx e configuração de proxy</span>
                    </div>
                    <div className="flex items-start space-x-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5" />
                      <span>Verificar firewall na porta 4000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Links de Diagnóstico */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-600 mb-2">🔍 Links de Diagnóstico:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Button size="sm" variant="outline" asChild>
              <a href={`${SERVER_URL}/health`} target="_blank" rel="noopener noreferrer">
                Health Check Direto
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${SERVER_URL}/api-docs`} target="_blank" rel="noopener noreferrer">
                API Documentation
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectionTest;
