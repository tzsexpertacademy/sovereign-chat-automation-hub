
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertCircle,
  Wifi,
  Server
} from "lucide-react";
import whatsappService from "@/services/whatsappMultiClient";
import { getServerConfig } from "@/config/environment";

interface ConnectionStatus {
  server: boolean;
  websocket: boolean;
  lastCheck: Date;
  serverInfo?: any;
  error?: string;
}

const ConnectionTester = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    server: false,
    websocket: false,
    lastCheck: new Date()
  });
  const [testing, setTesting] = useState(false);

  const config = getServerConfig();

  useEffect(() => {
    testConnection();
    const interval = setInterval(testConnection, 30000); // Test every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const testConnection = async () => {
    if (testing) return;
    
    setTesting(true);
    console.log('🧪 Iniciando teste de conexão...');

    const newStatus: ConnectionStatus = {
      server: false,
      websocket: false,
      lastCheck: new Date()
    };

    try {
      // Test server HTTP connection
      const testResult = await whatsappService.testConnection();
      newStatus.server = testResult.success;
      
      if (testResult.success) {
        // Get server info
        try {
          const serverInfo = await whatsappService.checkServerHealth();
          newStatus.serverInfo = serverInfo;
          console.log('✅ Informações do servidor obtidas:', serverInfo);
        } catch (error) {
          console.warn('⚠️ Não foi possível obter informações detalhadas do servidor');
        }

        // Test WebSocket connection
        try {
          const socket = whatsappService.connectSocket();
          newStatus.websocket = socket.connected;
          
          // Wait a bit to see if connection establishes
          setTimeout(() => {
            setStatus(prev => ({
              ...prev,
              websocket: socket.connected
            }));
          }, 2000);
          
        } catch (error) {
          console.error('❌ Erro ao testar WebSocket:', error);
          newStatus.websocket = false;
        }
        
      } else {
        newStatus.error = testResult.message;
      }

    } catch (error: any) {
      console.error('❌ Erro no teste de conexão:', error);
      newStatus.error = error.message;
    }

    setStatus(newStatus);
    setTesting(false);
  };

  const getStatusIcon = (isOnline: boolean) => {
    return isOnline ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  const getStatusBadge = (isOnline: boolean) => {
    return (
      <Badge variant={isOnline ? "default" : "destructive"}>
        {isOnline ? "Online" : "Offline"}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Wifi className="w-5 h-5" />
              <span>Status da Conexão</span>
            </CardTitle>
            <CardDescription>
              Monitoramento da conexão com o servidor WhatsApp
            </CardDescription>
          </div>
          <Button onClick={testConnection} disabled={testing} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testando...' : 'Testar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Server Configuration */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium text-sm text-gray-700">Configuração</h4>
            <p className="text-xs text-gray-600">Servidor: {config.SERVER_URL}</p>
            <p className="text-xs text-gray-600">WebSocket: {config.SOCKET_URL}</p>
            <p className="text-xs text-gray-600">Protocolo: {config.protocol}</p>
          </div>
          <div>
            <h4 className="font-medium text-sm text-gray-700">Ambiente</h4>
            <p className="text-xs text-gray-600">
              {config.isDevelopment ? 'Desenvolvimento' : 'Produção'}
            </p>
            <p className="text-xs text-gray-600">HTTPS: {config.isHttps ? 'Sim' : 'Não'}</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded">
            <div className="flex items-center space-x-3">
              <Server className="w-5 h-5 text-blue-500" />
              <div>
                <h4 className="font-medium">Servidor HTTP</h4>
                <p className="text-sm text-gray-600">API REST e Health Check</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(status.server)}
              {getStatusBadge(status.server)}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded">
            <div className="flex items-center space-x-3">
              <Wifi className="w-5 h-5 text-green-500" />
              <div>
                <h4 className="font-medium">WebSocket</h4>
                <p className="text-sm text-gray-600">Conexão em tempo real</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(status.websocket)}
              {getStatusBadge(status.websocket)}
            </div>
          </div>
        </div>

        {/* Server Info */}
        {status.serverInfo && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">Informações do Servidor</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-green-700">Versão:</span>
                <span className="ml-2 text-green-900">{status.serverInfo.version}</span>
              </div>
              <div>
                <span className="text-green-700">Uptime:</span>
                <span className="ml-2 text-green-900">{Math.round(status.serverInfo.uptime)}s</span>
              </div>
              <div>
                <span className="text-green-700">Clientes Ativos:</span>
                <span className="ml-2 text-green-900">{status.serverInfo.activeClients}</span>
              </div>
              <div>
                <span className="text-green-700">Clientes Conectados:</span>
                <span className="ml-2 text-green-900">{status.serverInfo.connectedClients}</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {status.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro de Conexão</AlertTitle>
            <AlertDescription>
              {status.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Last Check */}
        <p className="text-xs text-gray-500 text-center">
          Última verificação: {status.lastCheck.toLocaleTimeString()}
        </p>

      </CardContent>
    </Card>
  );
};

export default ConnectionTester;
