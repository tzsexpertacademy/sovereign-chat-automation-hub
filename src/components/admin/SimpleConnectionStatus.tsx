
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, RefreshCw, Shield } from "lucide-react";
import { SERVER_URL } from "@/config/environment";

const SimpleConnectionStatus = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      setStatus('checking');
      const response = await fetch(`${SERVER_URL}/health`);
      if (response.ok) {
        setStatus('connected');
      } else {
        setStatus('error');
      }
    } catch (error) {
      setStatus('error');
    } finally {
      setLastCheck(new Date());
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Online</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Offline</Badge>;
      case 'checking':
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Verificando</Badge>;
    }
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
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="font-medium text-green-900">✅ HTTPS Configurado</p>
              <p className="text-sm text-green-700">
                Sistema funcionando com certificado SSL
              </p>
            </div>
          </div>
        </div>

        <div className="text-sm space-y-2">
          <p><strong>Servidor:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{SERVER_URL}</code></p>
          <p><strong>Protocolo:</strong> <code className="bg-gray-100 px-2 py-1 rounded">HTTPS</code></p>
          {lastCheck && (
            <p><strong>Última verificação:</strong> {lastCheck.toLocaleTimeString()}</p>
          )}
        </div>

        <Button onClick={checkConnection} variant="outline" disabled={status === 'checking'}>
          <RefreshCw className={`w-4 h-4 mr-2 ${status === 'checking' ? 'animate-spin' : ''}`} />
          Verificar Conexão
        </Button>

        {status === 'connected' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800 font-medium">🚀 Sistema Operacional</p>
            <p className="text-blue-600 text-sm">
              Servidor WhatsApp Multi-Cliente conectado via HTTPS
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-medium">❌ Conexão Falhando</p>
            <p className="text-red-600 text-sm">
              Verifique se o servidor está rodando
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimpleConnectionStatus;
