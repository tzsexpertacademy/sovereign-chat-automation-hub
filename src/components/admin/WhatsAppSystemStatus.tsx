
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
import { getConfig } from "@/config/environment";

const WhatsAppSystemStatus = () => {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log(`🔍 Componente WhatsAppSystemStatus iniciado`);
    
    loadConfig();
    checkServerStatus();
    
    // Verificar status a cada 30 segundos
    const interval = setInterval(checkServerStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      const config = await getConfig();
      setCurrentConfig(config);
      console.log(`🌐 Configuração carregada:`, config);
    } catch (error) {
      console.error('❌ Erro ao carregar configuração:', error);
    }
  };

  const checkServerStatus = async () => {
    try {
      setServerStatus('checking');
      const health = await whatsappService.checkServerHealth();
      setServerInfo(health);
      setServerStatus('online');
      setLastCheck(new Date());
      console.log('✅ Servidor online:', health);
    } catch (error) {
      console.error('❌ Servidor offline:', error);
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
            <CardTitle>Status do Servidor WhatsApp</CardTitle>
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
          Status em tempo real do servidor backend
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
                {currentConfig?.serverUrl || 'Carregando...'} • {lastCheck ? `${lastCheck.toLocaleTimeString()}` : 'Não verificado'}
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
              <p className="text-lg font-bold text-green-600">{serverInfo.activeClients || 0}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Versão</p>
              <p className="text-sm text-gray-900">{serverInfo.version || 'N/A'}</p>
            </div>
          </div>
        )}

        {/* Links Úteis */}
        {currentConfig && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Links Úteis</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={`${currentConfig.serverUrl}/health`} target="_blank" rel="noopener noreferrer">
                  <Wifi className="w-4 h-4 mr-1" />
                  Health Check
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`${currentConfig.serverUrl}/api-docs`} target="_blank" rel="noopener noreferrer">
                  <Server className="w-4 h-4 mr-1" />
                  API Docs
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Status Online */}
        {serverStatus === 'online' && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Sistema Funcionando</p>
                <p className="text-sm text-green-700">
                  WhatsApp Multi-Cliente está online e operacional
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Offline */}
        {serverStatus === 'offline' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <WifiOff className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Servidor Offline</p>
                <p className="text-sm text-red-700">
                  Não foi possível conectar ao servidor WhatsApp Multi-Cliente
                </p>
                <div className="mt-2">
                  <p className="text-xs text-red-600">
                    Verifique se o servidor está rodando: ./scripts/production-start-whatsapp.sh
                  </p>
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
