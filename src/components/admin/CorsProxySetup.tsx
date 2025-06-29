import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, 
  Shield, 
  CheckCircle, 
  AlertTriangle,
  Globe
} from "lucide-react";
import { getServerConfig, CORS_PROXY_URL } from "@/config/environment";

const CorsProxySetup = () => {
  const [proxyStatus, setProxyStatus] = useState<'checking' | 'enabled' | 'disabled'>('checking');
  const config = getServerConfig();

  const handleEnableProxy = () => {
    window.open('https://cors-anywhere.herokuapp.com/corsdemo', '_blank');
  };

  const testProxy = async () => {
    try {
      setProxyStatus('checking');
      const response = await fetch(`${CORS_PROXY_URL}/http://httpbin.org/json`, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      if (response.ok) {
        setProxyStatus('enabled');
      } else {
        setProxyStatus('disabled');
      }
    } catch (error) {
      setProxyStatus('disabled');
    }
  };

  React.useEffect(() => {
    testProxy();
  }, []);

  const getStatusBadge = () => {
    switch (proxyStatus) {
      case 'enabled':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Habilitado</Badge>;
      case 'disabled':
        return <Badge className="bg-red-500"><AlertTriangle className="w-3 h-3 mr-1" />Desabilitado</Badge>;
      case 'checking':
        return <Badge variant="secondary">Verificando...</Badge>;
    }
  };

  if (!config.hasMixedContent) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            🔒 Configuração do Proxy CORS
          </div>
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          Configuração necessária para resolver Mixed Content Security
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <Alert className="border-blue-200 bg-blue-50">
          <Globe className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium text-blue-900">🔍 Situação Detectada:</p>
              <p className="text-sm text-blue-800">
                Frontend HTTPS (Lovable) tentando acessar servidor HTTP. 
                Sistema configurado para usar proxy CORS automaticamente.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {proxyStatus === 'disabled' && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium text-orange-900">⚠️ Proxy CORS Desabilitado</p>
                <p className="text-sm text-orange-800">
                  O proxy CORS precisa ser habilitado para que o sistema funcione corretamente.
                </p>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-orange-900">Como resolver:</p>
                  <ol className="text-sm text-orange-800 list-decimal list-inside space-y-1">
                    <li>Clique no botão "Habilitar Proxy CORS" abaixo</li>
                    <li>Na página que abrir, clique em "Request temporary access to the demo server"</li>
                    <li>Volte para esta página e teste novamente</li>
                  </ol>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {proxyStatus === 'enabled' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-green-900">✅ Proxy CORS Habilitado</p>
                <p className="text-sm text-green-800">
                  Sistema configurado corretamente para acessar o servidor WhatsApp via proxy CORS.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-2">
          <Button 
            onClick={handleEnableProxy}
            variant={proxyStatus === 'disabled' ? 'default' : 'outline'}
            className={proxyStatus === 'disabled' ? 'bg-orange-500 hover:bg-orange-600' : ''}
          >
            <Shield className="w-4 h-4 mr-2" />
            Habilitar Proxy CORS
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
          
          <Button onClick={testProxy} variant="outline">
            Testar Proxy
          </Button>
        </div>

        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Configuração atual:</strong></p>
          <p>Proxy: <code className="bg-gray-100 px-1 rounded">{CORS_PROXY_URL}</code></p>
          <p>Servidor: <code className="bg-gray-100 px-1 rounded">{config.DIRECT_SERVER_URL}</code></p>
          <p>Via Proxy: <code className="bg-gray-100 px-1 rounded">{config.SERVER_URL}</code></p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CorsProxySetup;
