
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, RefreshCw, Shield, ExternalLink, AlertTriangle, Copy } from "lucide-react";
import { SERVER_URL, API_BASE_URL, HTTPS_SERVER_URL, getServerConfig } from "@/config/environment";
import { useToast } from "@/hooks/use-toast";

const SimpleConnectionStatus = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'ssl_error' | 'https_required'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [sslAccepted, setSslAccepted] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const config = getServerConfig();
  const { toast } = useToast();

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      setDebugInfo('🔒 Iniciando teste HTTPS...');
      console.log('🔒 Testando conexão HTTPS OBRIGATÓRIA:', API_BASE_URL);
      
      // Verificar se estamos em produção e exigir HTTPS
      if (!config.isDevelopment && !API_BASE_URL.startsWith('https://')) {
        console.error('❌ HTTPS OBRIGATÓRIO em produção!');
        setStatus('https_required');
        setDebugInfo('❌ HTTPS obrigatório não configurado');
        setLastCheck(new Date());
        return;
      }
      
      setDebugInfo('🔄 Testando conectividade HTTPS...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Reduced timeout
      
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Conexão HTTPS funcionando!', data);
        setStatus('connected');
        setServerInfo(data);
        setSslAccepted(true);
        setDebugInfo('✅ HTTPS funcionando perfeitamente!');
        setLastCheck(new Date());
        return;
      } else {
        console.log('⚠️ Resposta HTTPS não OK:', response.status);
        setDebugInfo(`⚠️ HTTP ${response.status}: ${response.statusText}`);
        throw new Error(`HTTPS ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.log('❌ Erro na conexão HTTPS:', error.message);
      
      if (error.name === 'AbortError') {
        console.log('⏰ Timeout na conexão HTTPS');
        setStatus('error');
        setDebugInfo('⏰ Timeout - Servidor pode estar offline');
      } else if (error.message === 'Failed to fetch' || 
                 error.message.includes('SSL') ||
                 error.message.includes('certificate') ||
                 error.message.includes('TLS') ||
                 error.message.includes('CERTIFICATE') ||
                 error.name === 'TypeError') {
        console.log('🔒 Problema de SSL/TLS detectado');
        setStatus('ssl_error');
        setSslAccepted(false);
        setDebugInfo('🔒 Certificado SSL não aceito pelo navegador');
      } else {
        console.log('❌ Erro geral de conexão HTTPS');
        setStatus('error');
        setDebugInfo(`❌ Erro: ${error.message}`);
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
    // Open both URLs to ensure certificate is accepted globally
    window.open(`${HTTPS_SERVER_URL}/health`, '_blank');
    setTimeout(() => {
      window.open(`${HTTPS_SERVER_URL}/api-docs`, '_blank');
    }, 1000);
  };

  const copyServerUrl = () => {
    navigator.clipboard.writeText(API_BASE_URL);
    toast({
      title: "URL copiada!",
      description: "Cole no navegador para aceitar o certificado",
    });
  };

  const forceRecheck = async () => {
    console.log('🔄 Forçando nova verificação HTTPS...');
    setDebugInfo('🔄 Forçando nova verificação...');
    await checkConnection();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <CardTitle>Status HTTPS - Diagnóstico Completo</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Debug Info */}
        <div className="p-3 bg-gray-50 border rounded text-sm font-mono">
          <div className="flex items-center justify-between">
            <span>🔍 Status atual:</span>
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(debugInfo)}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <div className="mt-1 text-gray-700">{debugInfo}</div>
        </div>

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
                  <p className="font-medium text-red-900">🔧 Execute no servidor:</p>
                  <code className="block mt-1 p-2 bg-red-100 rounded">sudo ./scripts/setup-https-production-definitive.sh</code>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* SSL Error - CRITICAL FIX */}
        {status === 'ssl_error' && (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-4">
                <p className="font-medium text-red-900">🔒 PROBLEMA DE CERTIFICADO SSL DETECTADO</p>
                <p className="text-sm text-red-800">
                  O certificado SSL não foi aceito pelo navegador. Isso é comum com certificados autoassinados.
                </p>
                
                <div className="bg-red-50 p-4 rounded border text-sm space-y-3">
                  <p className="font-medium text-red-900">🚨 SOLUÇÃO PASSO A PASSO:</p>
                  
                  <div className="space-y-2">
                    <p className="font-medium text-red-800">1️⃣ Copie a URL do servidor:</p>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 p-2 bg-red-100 rounded text-xs">{API_BASE_URL}</code>
                      <Button size="sm" variant="outline" onClick={copyServerUrl}>
                        <Copy className="w-3 h-3 mr-1" />
                        Copiar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="font-medium text-red-800">2️⃣ Abra uma NOVA ABA e cole a URL</p>
                    <p className="text-red-700 text-xs">- O navegador mostrará um aviso de segurança</p>
                    <p className="text-red-700 text-xs">- Clique em "Avançado" ou "Advanced"</p>
                    <p className="text-red-700 text-xs">- Clique em "Prosseguir para 146.59.227.248"</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="font-medium text-red-800">3️⃣ Após aceitar, volte aqui e clique:</p>
                    <Button onClick={forceRecheck} className="bg-red-600 hover:bg-red-700">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Testar Novamente
                    </Button>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button onClick={acceptSSLCertificate} variant="outline" className="text-blue-600">
                    <Shield className="w-4 h-4 mr-2" />
                    Abrir URLs para Aceitar SSL
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
                  <div className="mt-2 text-sm text-green-600 space-y-1">
                    <p><strong>Status:</strong> {serverInfo.status}</p>
                    <p><strong>Protocolo:</strong> {serverInfo.protocol || 'HTTPS'}</p>
                    <p><strong>Versão:</strong> {serverInfo.version}</p>
                    <p><strong>CORS:</strong> {serverInfo.cors?.enabled ? '✅ Habilitado' : '❌ Desabilitado'}</p>
                    <p><strong>SSL:</strong> ✅ Certificado aceito globalmente</p>
                    <p><strong>Uptime:</strong> {Math.floor(serverInfo.uptime / 60)} minutos</p>
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
                  {debugInfo.includes('Timeout') ? 
                    'Servidor não responde - Pode estar offline ou sobrecarregado' : 
                    'Falha na conexão HTTPS. Verifique se o servidor está rodando.'
                  }
                </p>
                <div className="mt-2 text-xs text-red-600 space-y-1">
                  <p><strong>Comandos para verificar no servidor:</strong></p>
                  <code className="block p-1 bg-red-100 rounded">sudo systemctl status nginx</code>
                  <code className="block p-1 bg-red-100 rounded">curl -k https://146.59.227.248/health</code>
                  <code className="block p-1 bg-red-100 rounded">sudo ./scripts/production-start-whatsapp.sh</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Server Info - Always Show */}
        <div className="text-sm space-y-2 bg-blue-50 p-3 rounded">
          <p><strong>URL HTTPS:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{API_BASE_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{config.isHttps ? 'HTTPS (Obrigatório)' : 'HTTP (Desenvolvimento)'}</code></p>
          <p><strong>Lovable Compatível:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{config.lovableCompatible ? '✅ Sim' : '❌ Não (HTTP)'}</code></p>
          <p><strong>SSL Obrigatório:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{config.sslRequired ? '✅ Sim' : '❌ Não'}</code></p>
          {lastCheck && (
            <p><strong>Última verificação:</strong> {lastCheck.toLocaleTimeString()}</p>
          )}
        </div>

        <div className="flex space-x-2 flex-wrap">
          <Button onClick={forceRecheck} variant="outline" disabled={status === 'checking'}>
            <RefreshCw className={`w-4 h-4 mr-2 ${status === 'checking' ? 'animate-spin' : ''}`} />
            {status === 'checking' ? 'Verificando...' : 'Verificar HTTPS'}
          </Button>
          
          <Button onClick={openServerDirectly} variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir Health Check
          </Button>

          {status === 'ssl_error' && (
            <Button onClick={acceptSSLCertificate} variant="outline" className="text-blue-600">
              <Shield className="w-4 h-4 mr-2" />
              Aceitar SSL (Nova Aba)
            </Button>
          )}
          
          <Button onClick={copyServerUrl} variant="outline" size="sm">
            <Copy className="w-4 h-4 mr-2" />
            Copiar URL
          </Button>
        </div>

        {/* Success Message */}
        {status === 'connected' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">🎉 Perfeito!</p>
            <p className="text-green-600 text-sm">
              Sistema funcionando com HTTPS seguro. Totalmente compatível com Lovable e integração externa.
              Agora você pode criar instâncias WhatsApp sem problemas!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
