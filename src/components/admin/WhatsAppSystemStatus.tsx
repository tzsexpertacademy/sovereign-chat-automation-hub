
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
  ExternalLink,
  Database,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useServerConfig } from "@/hooks/useServerConfig";
import DatabaseSyncStatus from "./DatabaseSyncStatus";

const WhatsAppSystemStatus = () => {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const { toast } = useToast();
  const { config } = useServerConfig();

  useEffect(() => {
    console.log(`🔍 Componente WhatsAppSystemStatus iniciado`);
    console.log(`🌐 Servidor configurado: ${config.serverUrl}`);
    console.log(`🎯 Versão da API: v${config.apiVersion}`);
    
    checkServerStatus();
    
    // Verificar status a cada 30 segundos
    const interval = setInterval(checkServerStatus, 30000);
    
    return () => clearInterval(interval);
  }, [config.serverUrl]);

  const checkServerStatus = async () => {
    try {
      setServerStatus('checking');
      console.log(`🧪 [SERVER-STATUS-v2.2.1] Verificando status do servidor: ${config.serverUrl}`);
      
      // Usar endpoint /docs que sabemos que existe e retorna 200
      const response = await fetch(`${config.serverUrl}/docs`, {
        method: 'GET',
        mode: 'no-cors', // Evitar problemas de CORS para check básico
        cache: 'no-cache'
      });
      
      // Para no-cors, response.ok será sempre false, mas se não houve erro de rede, servidor está online
      console.log(`✅ [SERVER-STATUS-v2.2.1] Servidor respondeu, considerando online`);
      
      setServerInfo({
        version: `v${config.apiVersion}`,
        timestamp: new Date().toISOString(),
        uptime: 0,
        activeClients: 'N/A (CORS limitation)',
        endpoint: '/docs',
        note: 'Status básico - CORS impede verificação completa'
      });
      
      setServerStatus('online');
      setLastCheck(new Date());
      
    } catch (error) {
      console.error('❌ [SERVER-STATUS-v2.2.1] Erro ao verificar status do servidor:', error);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="w-5 h-5" />
              <CardTitle>Sistema CodeChat API v{config.apiVersion}</CardTitle>
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
            Status do servidor backend CodeChat API v{config.apiVersion}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Status Principal */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <p className="font-medium">Status do Servidor API v{config.apiVersion}</p>
                <p className="text-sm text-gray-600">
                  {config.serverUrl} • {lastCheck ? `Última verificação: ${lastCheck.toLocaleTimeString()}` : 'Não verificado'}
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
                <p className="text-sm font-medium text-gray-600">Versão da API</p>
                <p className="text-lg font-bold">{serverInfo.version}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Endpoint Testado</p>
                <p className="text-sm font-mono">{serverInfo.endpoint}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Status</p>
                <p className="text-sm">{serverInfo.note}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Timestamp</p>
                <p className="text-sm">{new Date(serverInfo.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Configuração Atual */}
          <div className="bg-blue-50 p-4 rounded">
            <h4 className="font-medium text-blue-900 mb-2">📋 Configuração v{config.apiVersion}:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Servidor:</strong> {config.serverUrl}</p>
              <p><strong>Base Path:</strong> {config.basePath}</p>
              <p><strong>API Version:</strong> v{config.apiVersion}</p>
              <p><strong>API Key:</strong> {config.globalApiKey ? '✅ Configurada' : '❌ Não configurada'}</p>
              <p><strong>Admin Token:</strong> {config.adminToken ? '✅ Configurado' : '❌ Não configurado'}</p>
            </div>
          </div>

          {/* Links Úteis */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Links Úteis</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={`${config.serverUrl}/docs`} target="_blank" rel="noopener noreferrer">
                  <Server className="w-4 h-4 mr-1" />
                  API Docs v{config.apiVersion}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="https://docs.codechat.dev/api/v2.2.1" target="_blank" rel="noopener noreferrer">
                  <Database className="w-4 h-4 mr-1" />
                  Documentação v{config.apiVersion}
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
                    O servidor CodeChat API v{config.apiVersion} não está respondendo em {config.serverUrl}.
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-red-600">Verifique se o servidor está rodando:</p>
                    <code className="text-xs bg-red-100 px-2 py-1 rounded block">
                      curl {config.serverUrl}/docs
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
                    CodeChat API v{config.apiVersion} funcionando corretamente
                  </p>
                  <div className="mt-2 text-xs text-green-600">
                    <p>URL do Servidor: <code className="bg-green-100 px-1 rounded">{config.serverUrl}</code></p>
                    <p className="mt-1">Hostname Frontend: <code className="bg-green-100 px-1 rounded">{window.location.hostname}</code></p>
                    <p className="mt-1">⚠️ CORS pode impedir acesso completo às APIs desde este domínio</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <DatabaseSyncStatus />
    </div>
  );
};

export default WhatsAppSystemStatus;
