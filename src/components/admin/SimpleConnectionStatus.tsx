
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, RefreshCw, Wifi, ExternalLink } from "lucide-react";
import { SERVER_URL, API_BASE_URL, getServerConfig } from "@/config/environment";

const SimpleConnectionStatus = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'cors_error'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const config = getServerConfig();

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      console.log('🔍 Testando conexão HTTP DIRETA:', API_BASE_URL);
      
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
        console.log('✅ Conexão HTTP DIRETA funcionando!', data);
        setStatus('connected');
        setServerInfo(data);
        setLastCheck(new Date());
        return;
      } else {
        console.log('⚠️ Resposta HTTP não OK:', response.status);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.log('❌ Erro na conexão HTTP DIRETA:', error.message);
      
      if (error.name === 'AbortError') {
        console.log('⏰ Timeout na conexão');
        setStatus('error');
      } else if (error.message === 'Failed to fetch' || 
                 error.message.includes('CORS') ||
                 error.name === 'TypeError') {
        console.log('🚫 Problema de CORS ou rede detectado');
        setStatus('cors_error');
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
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />🟢 HTTP Online</Badge>;
      case 'cors_error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />🚫 CORS Error</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />❌ Offline</Badge>;
      case 'checking':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />🔄 Verificando</Badge>;
    }
  };

  const openServerDirectly = () => {
    window.open(`${API_BASE_URL}/health`, '_blank');
  };

  const forceRecheck = async () => {
    console.log('🔄 Forçando nova verificação...');
    await checkConnection();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wifi className="w-5 h-5 text-blue-500" />
            <CardTitle>Status de Conexão HTTP Direta</CardTitle>
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
                <p className="font-medium text-green-900">🎉 Sistema Online!</p>
                <p className="text-sm text-green-700">
                  Conexão HTTP direta estabelecida com sucesso
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

        {/* CORS Error */}
        {status === 'cors_error' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium">🚫 Erro de CORS ou Conectividade</p>
                <p className="text-sm">
                  O servidor não está respondendo ou há problemas de CORS.
                </p>
                
                <div className="bg-red-50 p-3 rounded border text-sm">
                  <p className="font-medium text-red-900">🔧 Possíveis soluções:</p>
                  <ol className="list-decimal list-inside space-y-1 mt-2 text-red-800">
                    <li>Verificar se o servidor está rodando na porta 4000</li>
                    <li>Executar: sudo ./scripts/fix-direct-connection.sh</li>
                    <li>Verificar firewall/iptables</li>
                    <li>Reiniciar o servidor WhatsApp</li>
                  </ol>
                </div>
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
                  Falha na conexão HTTP direta. Verifique se o servidor está rodando.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Server Info */}
        <div className="text-sm space-y-2 bg-gray-50 p-3 rounded">
          <p><strong>URL do Servidor:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">{API_BASE_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">HTTP Direto (Porta {API_BASE_URL.split(':').pop()})</code></p>
          <p><strong>Tipo de Conexão:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">{config.directConnection ? 'Direta' : 'Proxy'}</code></p>
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
              Sistema funcionando com conexão HTTP direta. Você pode criar instâncias WhatsApp agora.
            </p>
          </div>
        )}

        {/* Direct Connection Info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-blue-800 font-medium">ℹ️ Conexão HTTP Direta</p>
          <p className="text-blue-700 text-sm">
            Sistema configurado para conectar diretamente na porta 4000, sem proxy Nginx.
            Isso elimina problemas de SSL e Mixed Content.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
