
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, RefreshCw, Shield, ExternalLink } from "lucide-react";
import { SERVER_URL, API_BASE_URL } from "@/config/environment";
import whatsappService from "@/services/whatsappMultiClient";

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
      const result = await whatsappService.testConnection();
      
      if (result.success) {
        setStatus('connected');
        // Try to get server info
        try {
          const health = await whatsappService.checkServerHealth();
          setServerInfo(health);
        } catch (e) {
          console.log('Could not get detailed server info');
        }
      } else {
        if (result.message.includes('Certificado SSL')) {
          setStatus('cert_error');
        } else {
          setStatus('error');
        }
      }
    } catch (error: any) {
      console.error('Connection check failed:', error);
      if (error.message === 'CERTIFICADO_SSL_NAO_ACEITO') {
        setStatus('cert_error');
      } else {
        setStatus('error');
      }
    } finally {
      setLastCheck(new Date());
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Online HTTPS</Badge>;
      case 'cert_error':
        return <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" />Certificado SSL</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Offline</Badge>;
      case 'checking':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Verificando</Badge>;
    }
  };

  const openServerDirectly = () => {
    window.open('https://146.59.227.248/health', '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-green-500" />
            <CardTitle>Status HTTPS</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Connected Status */}
        {status === 'connected' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-900">✅ HTTPS Funcionando</p>
                <p className="text-sm text-green-700">
                  Sistema conectado via HTTPS com certificado SSL
                </p>
                {serverInfo && (
                  <div className="text-xs text-green-600 mt-1">
                    Servidor: {serverInfo.version} | Clientes ativos: {serverInfo.activeClients}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Certificate Error */}
        {status === 'cert_error' && (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">🔒 Certificado SSL Requerido</p>
                <p className="text-sm">
                  Você precisa aceitar o certificado SSL autoassinado primeiro.
                </p>
                <Button 
                  size="sm" 
                  onClick={openServerDirectly}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Aceitar Certificado
                </Button>
                <p className="text-xs text-gray-600">
                  Clique no botão acima, depois "Avançado" → "Prosseguir para 146.59.227.248"
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Generic Error */}
        {status === 'error' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-medium">❌ Servidor Offline</p>
            <p className="text-red-600 text-sm">
              Verifique se o servidor WhatsApp está rodando
            </p>
          </div>
        )}

        {/* Server Info */}
        <div className="text-sm space-y-2">
          <p><strong>Servidor:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{API_BASE_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-gray-100 px-2 py-1 rounded">HTTPS</code></p>
          {lastCheck && (
            <p><strong>Última verificação:</strong> {lastCheck.toLocaleTimeString()}</p>
          )}
        </div>

        <div className="flex space-x-2">
          <Button onClick={checkConnection} variant="outline" disabled={status === 'checking'}>
            <RefreshCw className={`w-4 h-4 mr-2 ${status === 'checking' ? 'animate-spin' : ''}`} />
            Verificar Conexão
          </Button>
          
          {status !== 'connected' && (
            <Button onClick={openServerDirectly} variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir Servidor
            </Button>
          )}
        </div>

        {/* Instructions */}
        {status === 'cert_error' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800 font-medium">📋 Como aceitar o certificado:</p>
            <ol className="text-blue-600 text-sm mt-1 space-y-1">
              <li>1. Clique em "Aceitar Certificado" acima</li>
              <li>2. Clique em "Avançado" na página de aviso</li>
              <li>3. Clique em "Prosseguir para 146.59.227.248"</li>
              <li>4. Volte aqui e clique em "Verificar Conexão"</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
