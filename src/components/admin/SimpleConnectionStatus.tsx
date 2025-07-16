
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, RefreshCw, Shield, ExternalLink, AlertTriangle, Copy } from "lucide-react";
import { SERVER_URL, API_BASE_URL, HTTPS_SERVER_URL, getServerConfig } from "@/config/environment";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";

const SimpleConnectionStatus = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'ssl_error'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const config = getServerConfig();
  const { toast } = useToast();

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      setDebugInfo('🔍 Verificando servidor...');
      console.log('🔍 Testando conexão do servidor:', API_BASE_URL);
      
      const result = await whatsappService.testConnection();
      
      if (result.success) {
        console.log('✅ Servidor online!');
        setStatus('connected');
        setDebugInfo('✅ Servidor funcionando normalmente!');
        
        // Get detailed server info
        try {
          const health = await whatsappService.checkServerHealth();
          setServerInfo(health);
        } catch (error) {
          console.warn('⚠️ Não foi possível obter detalhes do servidor');
        }
      } else {
        console.log('❌ Servidor com problemas:', result.message);
        
        if (result.message.includes('SSL') || result.message.includes('certificado')) {
          setStatus('ssl_error');
          setDebugInfo('🔒 Problema de certificado SSL');
        } else {
          setStatus('error');
          setDebugInfo(result.message);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro na verificação:', error);
      setStatus('error');
      setDebugInfo(`❌ Erro: ${error.message}`);
    }
    
    setLastCheck(new Date());
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />🟢 Online</Badge>;
      case 'ssl_error':
        return <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" />🔒 SSL Error</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />🔴 Offline</Badge>;
      case 'checking':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />🔄 Verificando</Badge>;
    }
  };

  const openServerDirectly = () => {
    window.open(`${API_BASE_URL}/health`, '_blank');
  };

  const copyServerUrl = () => {
    navigator.clipboard.writeText(API_BASE_URL);
    toast({
      title: "URL copiada!",
      description: "Cole no navegador para aceitar o certificado",
    });
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
            <Shield className="w-5 h-5 text-blue-500" />
            <CardTitle>Status do Servidor</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Debug Info */}
        <div className="p-3 bg-gray-50 border rounded text-sm">
          <div className="flex items-center justify-between">
            <span>🔍 Status atual:</span>
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(debugInfo)}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <div className="mt-1 text-gray-700 font-mono">{debugInfo}</div>
        </div>

        {/* SSL Error */}
        {status === 'ssl_error' && (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium text-red-900">🔒 PROBLEMA DE CERTIFICADO SSL</p>
                <p className="text-sm text-red-800">
                  O certificado SSL não foi aceito pelo navegador.
                </p>
                
                <div className="bg-red-50 p-3 rounded border text-sm space-y-2">
                  <p className="font-medium text-red-900">🚨 SOLUÇÃO:</p>
                  
                  <div className="space-y-2">
                    <p className="font-medium text-red-800">1. Copie a URL:</p>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 p-2 bg-red-100 rounded text-xs">{API_BASE_URL}</code>
                      <Button size="sm" variant="outline" onClick={copyServerUrl}>
                        <Copy className="w-3 h-3 mr-1" />
                        Copiar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-medium text-red-800">2. Abra uma NOVA ABA e cole a URL</p>
                    <p className="text-red-700 text-xs">- O navegador mostrará um aviso de segurança</p>
                    <p className="text-red-700 text-xs">- Clique em "Avançado" ou "Advanced"</p>
                    <p className="text-red-700 text-xs">- Clique em "Prosseguir para yumer.yumerflow.app"</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="font-medium text-red-800">3. Após aceitar, volte aqui:</p>
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

        {/* Connected Status */}
        {status === 'connected' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-900">🎉 Servidor Online!</p>
                <p className="text-sm text-green-700">
                  Conexão estabelecida com sucesso
                </p>
                {serverInfo && (
                  <div className="mt-2 text-sm text-green-600 space-y-1">
                    <p><strong>Status:</strong> {serverInfo.status}</p>
                    <p><strong>Versão:</strong> {serverInfo.version}</p>
                    <p><strong>Uptime:</strong> {Math.floor(serverInfo.uptime / 60)} minutos</p>
                    <p><strong>Clientes Ativos:</strong> {serverInfo.activeClients || 0}</p>
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
                <p className="text-red-800 font-medium">❌ Servidor Indisponível</p>
                <p className="text-red-600 text-sm">
                  Verifique se o servidor está rodando e acessível
                </p>
                <div className="mt-2 text-xs text-red-600 space-y-1">
                  <p><strong>Comandos para verificar:</strong></p>
                  <code className="block p-1 bg-red-100 rounded">pm2 status</code>
                  <code className="block p-1 bg-red-100 rounded">curl -k https://yumer.yumerflow.app:8083/health</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Server Info */}
        <div className="text-sm space-y-2 bg-blue-50 p-3 rounded">
          <p><strong>URL:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{API_BASE_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-xs">{config.isHttps ? 'HTTPS' : 'HTTP'}</code></p>
          {lastCheck && (
            <p><strong>Última verificação:</strong> {lastCheck.toLocaleTimeString()}</p>
          )}
        </div>

        <div className="flex space-x-2 flex-wrap">
          <Button onClick={forceRecheck} variant="outline" disabled={status === 'checking'}>
            <RefreshCw className={`w-4 h-4 mr-2 ${status === 'checking' ? 'animate-spin' : ''}`} />
            {status === 'checking' ? 'Verificando...' : 'Verificar Agora'}
          </Button>
          
          <Button onClick={openServerDirectly} variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir Health Check
          </Button>
          
          <Button onClick={copyServerUrl} variant="outline" size="sm">
            <Copy className="w-4 h-4 mr-2" />
            Copiar URL
          </Button>
        </div>

        {/* Success Message */}
        {status === 'connected' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">🎉 Tudo funcionando!</p>
            <p className="text-green-600 text-sm">
              Agora você pode criar instâncias WhatsApp sem problemas!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
