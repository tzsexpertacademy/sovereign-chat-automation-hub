
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
      console.log('🔍 Verificando conexão HTTPS...');
      
      // Primeiro tenta conectar diretamente
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit',
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Servidor respondeu:', data);
        setStatus('connected');
        setServerInfo(data);
        return;
      }
      
      // Se não conseguir, tenta com o serviço
      const result = await whatsappService.testConnection();
      
      if (result.success) {
        setStatus('connected');
        try {
          const health = await whatsappService.checkServerHealth();
          setServerInfo(health);
        } catch (e) {
          console.log('Could not get detailed server info');
        }
      } else {
        if (result.message.includes('Certificado SSL') || result.message.includes('CERTIFICADO_SSL')) {
          setStatus('cert_error');
        } else {
          setStatus('error');
        }
      }
    } catch (error: any) {
      console.error('❌ Connection check failed:', error);
      
      // Verifica se é erro de certificado
      if (error.message === 'CERTIFICADO_SSL_NAO_ACEITO' || 
          error.message.includes('HTTPS_CERT_ERROR') ||
          error.message.includes('Failed to fetch') ||
          error.name === 'TypeError') {
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
    window.open(`${API_BASE_URL}/health`, '_blank');
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
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-900">✅ HTTPS Funcionando Perfeitamente!</p>
                <p className="text-sm text-green-700">
                  Sistema conectado via HTTPS com certificado SSL aceito
                </p>
                {serverInfo && (
                  <div className="mt-2 text-sm text-green-600">
                    <p><strong>Servidor:</strong> {serverInfo.server}</p>
                    <p><strong>Versão:</strong> {serverInfo.version}</p>
                    <p><strong>Protocolo:</strong> {serverInfo.protocol}</p>
                    <p><strong>Clientes ativos:</strong> {serverInfo.activeClients}</p>
                    <p><strong>CORS:</strong> {serverInfo.cors?.enabled ? '✅ Habilitado' : '❌ Desabilitado'}</p>
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
              <div className="space-y-3">
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
                <div className="text-xs text-gray-600 space-y-1">
                  <p><strong>Passos:</strong></p>
                  <p>1. Clique no botão "Aceitar Certificado" acima</p>
                  <p>2. Na página que abrir, clique em "Avançado"</p>
                  <p>3. Clique em "Prosseguir para 146.59.227.248"</p>
                  <p>4. Volte aqui e clique em "Verificar Conexão"</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Generic Error */}
        {status === 'error' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-medium">❌ Servidor Indisponível</p>
            <p className="text-red-600 text-sm">
              Não foi possível conectar ao servidor WhatsApp
            </p>
          </div>
        )}

        {/* Server Info */}
        <div className="text-sm space-y-2 bg-gray-50 p-3 rounded">
          <p><strong>Servidor:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">{API_BASE_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-gray-200 px-2 py-1 rounded text-xs">HTTPS</code></p>
          {lastCheck && (
            <p><strong>Última verificação:</strong> {lastCheck.toLocaleTimeString()}</p>
          )}
        </div>

        <div className="flex space-x-2">
          <Button onClick={checkConnection} variant="outline" disabled={status === 'checking'}>
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
            <p className="text-blue-800 font-medium">🎉 Tudo funcionando!</p>
            <p className="text-blue-600 text-sm">
              O servidor HTTPS está online e pronto para usar. Agora você pode criar instâncias WhatsApp.
            </p>
          </div>
        )}

        {/* Instructions for certificate */}
        {status === 'cert_error' && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 font-medium">💡 Dica</p>
            <p className="text-yellow-700 text-sm">
              Após aceitar o certificado, aguarde alguns segundos e clique em "Verificar Conexão" para atualizar o status.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
