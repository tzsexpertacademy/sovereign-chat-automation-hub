
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, RefreshCw, Shield, ExternalLink } from "lucide-react";
import { SERVER_URL, API_BASE_URL } from "@/config/environment";

const SimpleConnectionStatus = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'cert_error' | 'error'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      console.log('🔍 Testando conexão HTTPS com certificado...');
      
      // Tentar requisição HTTPS com configuração otimizada para certificados autoassinados
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ HTTPS conectado com sucesso!', data);
        setStatus('connected');
        setServerInfo(data);
        setLastCheck(new Date());
        return;
      } else {
        console.log('⚠️ Resposta HTTP não OK:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.log('❌ Erro na conexão HTTPS:', error.message);
      
      // Análise mais detalhada do erro
      if (error.name === 'AbortError') {
        console.log('⏰ Timeout na conexão');
        setStatus('error');
      } else if (error.message === 'Failed to fetch' || 
                 error.message.includes('net::') ||
                 error.message.includes('SSL') ||
                 error.message.includes('certificate') ||
                 error.name === 'TypeError') {
        console.log('🔒 Problema de certificado SSL detectado');
        setStatus('cert_error');
      } else {
        console.log('❌ Erro geral de conexão');
        setStatus('error');
      }
    }
    
    setLastCheck(new Date());
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />✅ Online HTTPS</Badge>;
      case 'cert_error':
        return <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" />🔒 Certificado SSL</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />❌ Offline</Badge>;
      case 'checking':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />🔄 Verificando</Badge>;
    }
  };

  const openServerDirectly = () => {
    // Abrir em nova aba com instruções específicas
    const newWindow = window.open(`${API_BASE_URL}/health`, '_blank');
    if (newWindow) {
      // Tentar focar na nova janela
      newWindow.focus();
    }
  };

  const forceRecheck = async () => {
    console.log('🔄 Forçando nova verificação de conexão...');
    await checkConnection();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-green-500" />
            <CardTitle>Status de Conexão HTTPS</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Connected Status */}
        {status === 'connected' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-900">✅ Sistema HTTPS Online!</p>
                <p className="text-sm text-green-700">
                  Conexão HTTPS estabelecida com sucesso
                </p>
                {serverInfo && (
                  <div className="mt-2 text-sm text-green-600">
                    <p><strong>Status:</strong> {serverInfo.status}</p>
                    {serverInfo.server && <p><strong>Servidor:</strong> {serverInfo.server}</p>}
                    {serverInfo.version && <p><strong>Versão:</strong> {serverInfo.version}</p>}
                    {serverInfo.protocol && <p><strong>Protocolo:</strong> {serverInfo.protocol}</p>}
                    {serverInfo.activeClients !== undefined && <p><strong>Clientes ativos:</strong> {serverInfo.activeClients}</p>}
                    {serverInfo.cors && <p><strong>CORS:</strong> {serverInfo.cors.enabled ? '✅ Habilitado' : '❌ Desabilitado'}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Certificate Error - Instruções específicas para Lovable */}
        {status === 'cert_error' && (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium">🔒 Certificado SSL - Ação Necessária</p>
                <p className="text-sm">
                  O certificado precisa ser aceito no contexto da Lovable.
                </p>
                
                <div className="bg-blue-50 p-3 rounded border text-sm">
                  <p className="font-medium text-blue-900">📋 Instruções Específicas:</p>
                  <ol className="list-decimal list-inside space-y-1 mt-2 text-blue-800">
                    <li>Clique no botão "Aceitar Certificado" abaixo</li>
                    <li>Uma nova aba abrirá com aviso de "Não seguro"</li>
                    <li>Clique em <strong>"Avançado"</strong></li>
                    <li>Clique em <strong>"Prosseguir para 146.59.227.248"</strong></li>
                    <li>Aguarde a página carregar o JSON</li>
                    <li>Volte aqui e clique em "Verificar Conexão"</li>
                  </ol>
                </div>
                
                <Button 
                  size="sm" 
                  onClick={openServerDirectly}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Aceitar Certificado
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Generic Error */}
        {status === 'error' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-red-800 font-medium">❌ Servidor Indisponível</p>
                <p className="text-red-600 text-sm">
                  Falha na conexão com o servidor WhatsApp. Verifique se o servidor está rodando.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Server Info */}
        <div className="text-sm space-y-2 bg-gray-50 p-3 rounded">
          <p><strong>URL do Servidor:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">{API_BASE_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">HTTPS (Certificado Autoassinado)</code></p>
          {lastCheck && (
            <p><strong>Última verificação:</strong> {lastCheck.toLocaleTimeString()}</p>
          )}
        </div>

        <div className="flex space-x-2">
          <Button onClick={forceRecheck} variant="outline" disabled={status === 'checking'}>
            <RefreshCw className={`w-4 h-4 mr-2 ${status === 'checking' ? 'animate-spin' : ''}`} />
            Verificar Conexão
          </Button>
          
          <Button onClick={openServerDirectly} variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir Health Check
          </Button>
        </div>

        {/* Success Message */}
        {status === 'connected' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800 font-medium">🎉 Perfeito!</p>
            <p className="text-blue-600 text-sm">
              O sistema está funcionando corretamente. Você pode criar instâncias WhatsApp agora.
            </p>
          </div>
        )}

        {/* Help for certificate issues */}
        {status === 'cert_error' && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 font-medium">💡 Importante</p>
            <p className="text-yellow-700 text-sm">
              Este é um certificado autoassinado para testes. Em produção, use um certificado válido de uma CA reconhecida.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
