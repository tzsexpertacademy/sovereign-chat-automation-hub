
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Server, 
  AlertCircle,
  CheckCircle,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";
import { SERVER_URL } from "@/config/environment";

const WhatsAppSystemStatus = () => {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkServerStatus();
    
    // Verificar status a cada 30 segundos
    const interval = setInterval(checkServerStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkServerStatus = async () => {
    try {
      setServerStatus('checking');
      const health = await whatsappService.checkServerHealth();
      setServerInfo(health);
      setServerStatus('online');
      setLastCheck(new Date());
    } catch (error) {
      setServerStatus('offline');
      setServerInfo(null);
      setLastCheck(new Date());
    }
  };

  const handleRefresh = async () => {
    await checkServerStatus();
    toast({
      title: "Status atualizado",
      description: `Servidor está ${serverStatus === 'online' ? 'online' : 'offline'}`,
    });
  };

  const getStatusIcon = () => {
    switch (serverStatus) {
      case 'online': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'offline': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'checking': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (serverStatus) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'checking': return 'Verificando...';
    }
  };

  const getStatusBadge = () => {
    switch (serverStatus) {
      case 'online': return 'default';
      case 'offline': return 'destructive';
      case 'checking': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5" />
            <CardTitle>Sistema WhatsApp Multi-Cliente</CardTitle>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleRefresh}
            disabled={serverStatus === 'checking'}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${serverStatus === 'checking' ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          Status do servidor backend e APIs disponíveis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status Principal */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium">Status do Servidor</p>
              <p className="text-sm text-gray-600">
                {SERVER_URL} • {lastCheck ? `Última verificação: ${lastCheck.toLocaleTimeString()}` : 'Não verificado'}
              </p>
            </div>
          </div>
          <Badge variant={getStatusBadge()}>
            {getStatusText()}
          </Badge>
        </div>

        {/* Informações do Servidor */}
        {serverInfo && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Clientes Ativos</p>
              <p className="text-lg font-bold">{serverInfo.activeClients || 0}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Timestamp</p>
              <p className="text-sm">{new Date(serverInfo.timestamp).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Links Úteis */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">Links Úteis</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={`${SERVER_URL}/health`} target="_blank" rel="noopener noreferrer">
                <Wifi className="w-4 h-4 mr-1" />
                Health Check
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`${SERVER_URL}/api-docs`} target="_blank" rel="noopener noreferrer">
                <Server className="w-4 h-4 mr-1" />
                API Swagger
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          </div>
        </div>

        {/* Status Offline */}
        {serverStatus === 'offline' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <WifiOff className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Servidor Offline</p>
                <p className="text-sm text-red-700">
                  O servidor WhatsApp Multi-Cliente não está respondendo na porta 4000.
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-red-600">Comandos úteis:</p>
                  <code className="text-xs bg-red-100 px-2 py-1 rounded">
                    ./scripts/production-start-whatsapp.sh
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Online com informações detalhadas */}
        {serverStatus === 'online' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Servidor Online</p>
                <p className="text-sm text-green-700">
                  WhatsApp Multi-Cliente funcionando corretamente
                </p>
                <div className="mt-2 text-xs text-green-600">
                  <p>URL do Servidor: <code className="bg-green-100 px-1 rounded">{SERVER_URL}</code></p>
                  {import.meta.env.VITE_SERVER_URL && (
                    <p className="mt-1">Configurado via: <code className="bg-green-100 px-1 rounded">VITE_SERVER_URL</code></p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppSystemStatus;
