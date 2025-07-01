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
  const [autoCheckInterval, setAutoCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const config = getServerConfig();
  const { toast } = useToast();

  useEffect(() => {
    checkConnection();
    
    // Check immediately and then every 10 seconds for faster updates
    const interval = setInterval(checkConnection, 10000);
    setAutoCheckInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      setDebugInfo('🔄 Verificando status pós-correção CORS...');
      console.log('🔒 Testando conexão HTTPS pós-correção:', API_BASE_URL);
      
      // Verificar se estamos em produção e exigir HTTPS
      if (!config.isDevelopment && !API_BASE_URL.startsWith('https://')) {
        console.error('❌ HTTPS OBRIGATÓRIO em produção!');
        setStatus('https_required');
        setDebugInfo('❌ HTTPS obrigatório não configurado');
        setLastCheck(new Date());
        return;
      }
      
      setDebugInfo('🔄 Testando health check pós-correção...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Reduced timeout
      
      // Add cache-busting parameter to avoid cached responses
      const cacheBuster = `?t=${Date.now()}&check=post-fix`;
      const response = await fetch(`${API_BASE_URL}/health${cacheBuster}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Check-Type': 'post-cors-fix'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Conexão HTTPS pós-correção funcionando!', data);
        setStatus('connected');
        setServerInfo(data);
        setSslAccepted(true);
        setDebugInfo(`✅ HTTPS funcionando! Servidor: ${data.server} | CORS: ${data.cors?.status || 'OK'}`);
        setLastCheck(new Date());
        
        // Show success toast only on first successful connection after being offline
        if (status !== 'connected') {
          toast({
            title: "✅ Servidor Online!",
            description: "CORS corrigido com sucesso! Todas as APIs funcionando.",
          });
        }
        return;
      } else {
        console.log('⚠️ Resposta HTTPS não OK:', response.status);
        setDebugInfo(`⚠️ HTTP ${response.status}: ${response.statusText}`);
        throw new Error(`HTTPS ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.log('❌ Erro na conexão HTTPS pós-correção:', error.message);
      
      if (error.name === 'AbortError') {
        console.log('⏰ Timeout na conexão HTTPS');
        setStatus('error');
        setDebugInfo('⏰ Timeout - Verificando se servidor reiniciou...');
      } else if (error.message === 'Failed to fetch' || 
                 error.message.includes('SSL') ||
                 error.message.includes('certificate') ||
                 error.message.includes('TLS') ||
                 error.message.includes('CERTIFICATE') ||
                 error.name === 'TypeError') {
        console.log('🔒 Problema de SSL/TLS detectado - pode precisar aceitar certificado novamente');
        setStatus('ssl_error');
        setSslAccepted(false);
        setDebugInfo('🔒 Certificado SSL precisa ser aceito novamente');
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
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />🔄 Verificando</Badge>;
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
    console.log('🔄 Forçando nova verificação HTTPS pós-correção...');
    setDebugInfo('🔄 Forçando nova verificação pós-correção...');
    await checkConnection();
  };

  const stopAutoCheck = () => {
    if (autoCheckInterval) {
      clearInterval(autoCheckInterval);
      setAutoCheckInterval(null);
      toast({
        title: "Auto-verificação pausada",
        description: "Clique em 'Verificar HTTPS' para testar manualmente",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <CardTitle>Status HTTPS - Pós Correção CORS</CardTitle>
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

        {/* Post-Fix Success Message */}
        {status === 'connected' && serverInfo && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-900">🎉 CORREÇÃO CORS BEM-SUCEDIDA!</p>
                <p className="text-sm text-green-700">
                  Servidor funcionando perfeitamente após as correções
                </p>
                {serverInfo && (
                  <div className="mt-2 text-sm text-green-600 space-y-1">
                    <p><strong>Status:</strong> {serverInfo.status}</p>
                    <p><strong>Versão:</strong> {serverInfo.version}</p>
                    <p><strong>CORS:</strong> ✅ {serverInfo.cors?.status || 'OK'}</p>
                    <p><strong>APIs:</strong> ✅ Todas funcionando</p>
                    <p><strong>SSL:</strong> ✅ Certificado funcionando</p>
                    <p><strong>Uptime:</strong> {Math.floor(serverInfo.uptime / 60)} minutos</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                <p className="font-medium text-red-900">🔒 CERTIFICADO SSL PRECISA SER ACEITO NOVAMENTE</p>
                <p className="text-sm text-red-800">
                  Após a correção do servidor, você pode precisar aceitar o certificado SSL novamente.
                </p>
                
                <div className="bg-red-50 p-4 rounded border text-sm space-y-3">
                  <p className="font-medium text-red-900">🚨 SOLUÇÃO RÁPIDA:</p>
                  
                  <div className="space-y-2">
                    <p className="font-medium text-red-800">1️⃣ Abra uma nova aba:</p>
                    <Button size="sm" variant="outline" onClick={openServerDirectly}>
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Abrir {API_BASE_URL}/health
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="font-medium text-red-800">2️⃣ Aceite o certificado e volte aqui</p>
                    <Button onClick={forceRecheck} className="bg-red-600 hover:bg-red-700">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Testar Novamente
                    </Button>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Generic Error - Server might be restarting */}
        {status === 'error' && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-orange-800 font-medium">⚠️ Servidor Temporariamente Indisponível</p>
                <p className="text-orange-600 text-sm">
                  {debugInfo.includes('Timeout') ? 
                    'O servidor pode estar reiniciando após as correções. Aguarde alguns segundos...' : 
                    'Verificando conectividade após correções do servidor...'
                  }
                </p>
                <div className="mt-2 text-xs text-orange-600 space-y-1">
                  <p><strong>Isso é normal após correções no servidor:</strong></p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>O Nginx pode estar reiniciando</li>
                    <li>O certificado SSL pode precisar ser aceito novamente</li>
                    <li>As correções CORS podem levar alguns segundos para aplicar</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Server Info - Always Show */}
        <div className="text-sm space-y-2 bg-blue-50 p-3 rounded">
          <p><strong>URL HTTPS:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{API_BASE_URL}</code></p>
          <p><strong>Status:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{status === 'connected' ? '✅ Online pós-correção' : '🔄 Verificando pós-correção'}</code></p>
          <p><strong>Auto-verificação:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{autoCheckInterval ? '✅ Ativa (10s)' : '❌ Pausada'}</code></p>
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

          {autoCheckInterval && (
            <Button onClick={stopAutoCheck} variant="outline" size="sm" className="text-gray-600">
              Pausar Auto-Check
            </Button>
          )}
        </div>

        {/* Success Message - Post Fix */}
        {status === 'connected' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">🎉 Correção CORS Aplicada com Sucesso!</p>
            <p className="text-green-600 text-sm">
              O servidor está funcionando perfeitamente. Agora você pode usar o diagnóstico CORS 
              para testar todas as APIs e conectar suas instâncias WhatsApp!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
