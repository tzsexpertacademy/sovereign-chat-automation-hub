
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, RefreshCw, Shield, ExternalLink, AlertTriangle } from "lucide-react";
import { HTTP_BASE_URL, HTTPS_BASE_URL, getUrls } from "@/config/environment";

const SimpleConnectionStatus = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'cert_error' | 'error' | 'http_working'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [httpsWorking, setHttpsWorking] = useState(false);
  const [httpWorking, setHttpWorking] = useState(false);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      console.log('🔍 Testando conexões HTTP e HTTPS...');
      
      const urls = getUrls();
      
      // Teste 1: HTTP (deve funcionar sempre)
      try {
        const httpResponse = await fetch(`${urls.api}/health`, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          signal: AbortSignal.timeout(8000),
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (httpResponse.ok) {
          const httpData = await httpResponse.json();
          console.log('✅ HTTP funcionando:', httpData);
          setHttpWorking(true);
          setServerInfo(httpData);
        }
      } catch (httpError) {
        console.log('❌ HTTP falhou:', httpError);
        setHttpWorking(false);
      }

      // Teste 2: HTTPS (pode falhar por certificado)
      try {
        const httpsResponse = await fetch(`${urls.healthCheckEndpoint}`, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          signal: AbortSignal.timeout(8000),
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (httpsResponse.ok) {
          const httpsData = await httpsResponse.json();
          console.log('✅ HTTPS também funcionando:', httpsData);
          setHttpsWorking(true);
          setServerInfo(httpsData);
        }
      } catch (httpsError) {
        console.log('❌ HTTPS falhou (esperado):', httpsError);
        setHttpsWorking(false);
      }

      // Determinar status final
      if (httpsWorking) {
        setStatus('connected');
      } else if (httpWorking) {
        setStatus('http_working');
      } else {
        setStatus('error');
      }
      
    } catch (error: any) {
      console.log('❌ Erro geral na conexão:', error);
      setStatus('error');
    }
    
    setLastCheck(new Date());
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />✅ HTTPS Online</Badge>;
      case 'http_working':
        return <Badge className="bg-blue-500"><AlertTriangle className="w-3 h-3 mr-1" />🔄 HTTP Online</Badge>;
      case 'cert_error':
        return <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" />🔒 Certificado SSL</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />❌ Offline</Badge>;
      case 'checking':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />🔄 Verificando</Badge>;
    }
  };

  const openServerDirectly = () => {
    const newWindow = window.open(`${HTTPS_BASE_URL}/health`, '_blank');
    if (newWindow) {
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
            <CardTitle>Status de Conexão do Servidor</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* HTTPS Working */}
        {status === 'connected' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-900">✅ HTTPS Totalmente Funcional!</p>
                <p className="text-sm text-green-700">
                  Conexão HTTPS segura estabelecida com sucesso
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

        {/* HTTP Working (HTTPS blocked) */}
        {status === 'http_working' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium text-blue-900">🔄 Sistema Funcionando via HTTP</p>
                <p className="text-sm text-blue-700">
                  O servidor está online e funcional. HTTPS bloqueado por certificado autoassinado.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  ✅ Todas as funcionalidades estão disponíveis via HTTP
                </p>
                {serverInfo && (
                  <div className="mt-2 text-sm text-blue-600">
                    <p><strong>Status:</strong> {serverInfo.status}</p>
                    {serverInfo.version && <p><strong>Versão:</strong> {serverInfo.version}</p>}
                    {serverInfo.activeClients !== undefined && <p><strong>Clientes ativos:</strong> {serverInfo.activeClients}</p>}
                    {serverInfo.cors && <p><strong>CORS:</strong> {serverInfo.cors.enabled ? '✅ Habilitado' : '❌ Desabilitado'}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Connection Error */}
        {status === 'error' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-red-800 font-medium">❌ Servidor Indisponível</p>
                <p className="text-red-600 text-sm">
                  Falha na conexão com o servidor WhatsApp (HTTP e HTTPS).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${httpWorking ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <p className="font-medium text-sm">HTTP</p>
                <p className="text-xs text-gray-600">{httpWorking ? 'Funcionando' : 'Offline'}</p>
              </div>
            </div>
          </div>
          
          <div className="p-3 bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${httpsWorking ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <div>
                <p className="font-medium text-sm">HTTPS</p>
                <p className="text-xs text-gray-600">
                  {httpsWorking ? 'Funcionando' : 'Certificado'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Server Info */}
        <div className="text-sm space-y-2 bg-gray-50 p-3 rounded">
          <p><strong>URL HTTP:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">{HTTP_BASE_URL}</code></p>
          <p><strong>URL HTTPS:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">{HTTPS_BASE_URL}</code></p>
          <p><strong>Status:</strong> <span className="text-green-600">
            {httpWorking ? 'Sistema funcional via HTTP' : 'Servidor offline'}
          </span></p>
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
            Testar HTTPS
          </Button>
        </div>

        {/* Success Message */}
        {(status === 'connected' || status === 'http_working') && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800 font-medium">🎉 Sistema Operacional!</p>
            <p className="text-blue-600 text-sm">
              {status === 'connected' 
                ? 'HTTPS e HTTP funcionando perfeitamente.' 
                : 'HTTP funcionando. Você pode criar instâncias WhatsApp agora.'
              }
            </p>
          </div>
        )}

        {/* HTTPS Certificate Info */}
        {status === 'http_working' && !httpsWorking && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 font-medium">💡 Sobre o HTTPS</p>
            <p className="text-yellow-700 text-sm">
              HTTPS está configurado mas usa certificado autoassinado. O sistema funciona perfeitamente via HTTP.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
