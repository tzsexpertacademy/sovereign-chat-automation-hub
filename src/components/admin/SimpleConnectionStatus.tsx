
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, RefreshCw, Shield, ExternalLink, AlertTriangle } from "lucide-react";
import { SERVER_URL, API_BASE_URL, HTTPS_SERVER_URL, getServerConfig } from "@/config/environment";

const SimpleConnectionStatus = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'ssl_error' | 'https_required'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [sslAccepted, setSslAccepted] = useState<boolean>(false);
  const config = getServerConfig();

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      console.log('🔒 Testando conexão HTTPS OBRIGATÓRIA:', API_BASE_URL);
      
      // Verificar se estamos em produção e exigir HTTPS
      if (!config.isDevelopment && !API_BASE_URL.startsWith('https://')) {
        console.error('❌ HTTPS OBRIGATÓRIO em produção!');
        setStatus('https_required');
        setLastCheck(new Date());
        return;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
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
        console.log('✅ Conexão HTTPS funcionando!', data);
        setStatus('connected');
        setServerInfo(data);
        setSslAccepted(true);
        setLastCheck(new Date());
        return;
      } else {
        console.log('⚠️ Resposta HTTPS não OK:', response.status);
        throw new Error(`HTTPS ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.log('❌ Erro na conexão HTTPS:', error.message);
      
      if (error.name === 'AbortError') {
        console.log('⏰ Timeout na conexão HTTPS');
        setStatus('error');
      } else if (error.message === 'Failed to fetch' || 
                 error.message.includes('SSL') ||
                 error.message.includes('certificate') ||
                 error.message.includes('TLS') ||
                 error.name === 'TypeError') {
        console.log('🔒 Problema de SSL/TLS detectado');
        setStatus('ssl_error');
        setSslAccepted(false);
      } else {
        console.log('❌ Erro geral de conexão HTTPS');
        setStatus('error');
      }
    }
    
    setLastCheck(new Date());
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />🔒 HTTPS Online</Badge>;
      case 'ssl_error':
        return <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" />🔒 SSL Error</Badge>;
      case 'https_required':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />🔒 HTTPS Obrigatório</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />❌ Offline</Badge>;
      case 'checking':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />🔄 Verificando HTTPS</Badge>;
    }
  };

  const openServerDirectly = () => {
    window.open(`${API_BASE_URL}/health`, '_blank');
  };

  const acceptSSLCertificate = () => {
    window.open(`${HTTPS_SERVER_URL}/health`, '_blank');
  };

  const forceRecheck = async () => {
    console.log('🔄 Forçando nova verificação HTTPS...');
    await checkConnection();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <CardTitle>Status HTTPS (Obrigatório para Lovable)</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* HTTPS Required Warning */}
        {status === 'https_required' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium">🔒 HTTPS OBRIGATÓRIO</p>
                <p className="text-sm">
                  A Lovable e integrações externas exigem HTTPS para funcionamento seguro.
                </p>
                
                <div className="bg-red-50 p-3 rounded border text-sm">
                  <p className="font-medium text-red-900">🔧 Ações necessárias:</p>
                  <ol className="list-decimal list-inside space-y-1 mt-2 text-red-800">
                    <li>Execute: sudo ./scripts/setup-https-definitive.sh</li>
                    <li>Configure certificado SSL válido</li>
                    <li>Verifique se Nginx está proxy-passando para HTTPS</li>
                    <li>Aceite o certificado no navegador</li>
                  </ol>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* SSL Error */}
        {status === 'ssl_error' && (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium">🔒 Erro de Certificado SSL</p>
                <p className="text-sm">
                  Certificado SSL não foi aceito pelo navegador ou há problemas de configuração.
                </p>
                
                <div className="bg-red-50 p-3 rounded border text-sm">
                  <p className="font-medium text-red-900">🔧 Soluções:</p>
                  <ol className="list-decimal list-inside space-y-1 mt-2 text-red-800">
                    <li>Clique no botão "Aceitar Certificado SSL" abaixo</li>
                    <li>No aviso do navegador, clique "Avançado" → "Prosseguir"</li>
                    <li>Verifique se o certificado SSL está configurado corretamente</li>
                    <li>Execute: sudo ./scripts/setup-https-definitive.sh</li>
                  </ol>
                </div>
                
                <div className="flex space-x-2">
                  <Button onClick={acceptSSLCertificate} variant="outline" className="text-blue-600">
                    <Shield className="w-4 h-4 mr-2" />
                    Aceitar Certificado SSL
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Connected Status */}
        {status === 'connected' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-900">🎉 Sistema HTTPS Online!</p>
                <p className="text-sm text-green-700">
                  Conexão HTTPS segura estabelecida - Compatível com Lovable
                </p>
                {serverInfo && (
                  <div className="mt-2 text-sm text-green-600">
                    <p><strong>Status:</strong> {serverInfo.status}</p>
                    <p><strong>Protocolo:</strong> {serverInfo.protocol || 'HTTPS'}</p>
                    {serverInfo.server && <p><strong>Servidor:</strong> {serverInfo.server}</p>}
                    {serverInfo.version && <p><strong>Versão:</strong> {serverInfo.version}</p>}
                    {serverInfo.activeClients !== undefined && <p><strong>Clientes ativos:</strong> {serverInfo.activeClients}</p>}
                    {serverInfo.cors && <p><strong>CORS:</strong> {serverInfo.cors.enabled ? '✅ Habilitado' : '❌ Desabilitado'}</p>}
                    <p><strong>SSL:</strong> ✅ Certificado aceito</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Generic Error */}
        {status === 'error' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-red-800 font-medium">❌ Servidor HTTPS Indisponível</p>
                <p className="text-red-600 text-sm">
                  Falha na conexão HTTPS. Verifique se o servidor está configurado corretamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Server Info */}
        <div className="text-sm space-y-2 bg-blue-50 p-3 rounded">
          <p><strong>URL HTTPS:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{API_BASE_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{config.isHttps ? 'HTTPS (Obrigatório)' : 'HTTP (Desenvolvimento)'}</code></p>
          <p><strong>Lovable Compatível:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{config.lovableCompatible ? '✅ Sim' : '❌ Não (HTTP)'}</code></p>
          <p><strong>SSL Obrigatório:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{config.sslRequired ? '✅ Sim' : '❌ Não'}</code></p>
          {lastCheck && (
            <p><strong>Última verificação:</strong> {lastCheck.toLocaleTimeString()}</p>
          )}
        </div>

        <div className="flex space-x-2">
          <Button onClick={forceRecheck} variant="outline" disabled={status === 'checking'}>
            <RefreshCw className={`w-4 h-4 mr-2 ${status === 'checking' ? 'animate-spin' : ''}`} />
            Verificar HTTPS
          </Button>
          
          <Button onClick={openServerDirectly} variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir Health Check
          </Button>

          {status === 'ssl_error' && (
            <Button onClick={acceptSSLCertificate} variant="outline" className="text-blue-600">
              <Shield className="w-4 h-4 mr-2" />
              Aceitar SSL
            </Button>
          )}
        </div>

        {/* Success Message */}
        {status === 'connected' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">🎉 Perfeito!</p>
            <p className="text-green-600 text-sm">
              Sistema funcionando com HTTPS seguro. Totalmente compatível com Lovable e integração externa.
            </p>
          </div>
        )}

        {/* HTTPS Info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-blue-800 font-medium">ℹ️ HTTPS Obrigatório</p>
          <p className="text-blue-700 text-sm">
            Sistema configurado para HTTPS obrigatório em produção. Isso garante compatibilidade total com Lovable,
            integrações externas e segurança de dados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
