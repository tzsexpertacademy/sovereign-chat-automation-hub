
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { connectionManager, ConnectionStatus } from '@/services/connectionManager';
import { audioFallbackService } from '@/services/audioFallbackService';

const SystemHealthMonitor = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [audioStats, setAudioStats] = useState({
    failedCount: 0,
    successRate: 95, // Mock data
    avgResponseTime: 2.3 // Mock data
  });

  useEffect(() => {
    // Listen to connection status changes
    const handleStatusChange = (status: ConnectionStatus) => {
      setConnectionStatus(status);
    };

    connectionManager.onStatusChange(handleStatusChange);

    // Update audio stats
    const updateAudioStats = () => {
      const failedCount = audioFallbackService.getFailedAudiosCount();
      setAudioStats(prev => ({
        ...prev,
        failedCount
      }));
    };

    updateAudioStats();
    const statsInterval = setInterval(updateAudioStats, 5000);

    return () => {
      connectionManager.removeListener(handleStatusChange);
      clearInterval(statsInterval);
    };
  }, []);

  const handleForceReconnect = async () => {
    await connectionManager.forceReconnect();
  };

  const getConnectionBadge = () => {
    if (!connectionStatus) {
      return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Carregando</Badge>;
    }

    if (connectionStatus.isConnected) {
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Online</Badge>;
    } else {
      return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" />Offline</Badge>;
    }
  };

  const getLastHeartbeatText = () => {
    if (!connectionStatus || !connectionStatus.lastHeartbeat) {
      return 'Nunca';
    }

    const timeDiff = Date.now() - connectionStatus.lastHeartbeat;
    const seconds = Math.floor(timeDiff / 1000);
    
    if (seconds < 60) {
      return `${seconds}s atrás`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}min atrás`;
    } else {
      return `${Math.floor(seconds / 3600)}h atrás`;
    }
  };

  const getHealthScore = () => {
    if (!connectionStatus) return 0;
    
    let score = 0;
    
    // Connection status (40 points)
    if (connectionStatus.isConnected) score += 40;
    
    // Reconnect attempts (30 points)
    const reconnectPenalty = Math.min(connectionStatus.reconnectAttempts * 10, 30);
    score += 30 - reconnectPenalty;
    
    // Audio success rate (30 points)
    score += Math.round(audioStats.successRate * 0.3);
    
    return Math.max(0, Math.min(100, score));
  };

  const healthScore = getHealthScore();

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <span>Monitor de Saúde do Sistema</span>
          </div>
          {getConnectionBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Health Score */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Saúde Geral do Sistema</span>
            <span className="text-2xl font-bold text-blue-600">{healthScore}%</span>
          </div>
          <Progress value={healthScore} className="h-3" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Crítico</span>
            <span>Excelente</span>
          </div>
        </div>

        {/* Connection Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {connectionStatus?.isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm font-medium">Conectividade</span>
            </div>
            <div className="text-xs text-gray-600">
              <p>Servidor: {connectionStatus?.serverUrl || 'N/A'}</p>
              <p>Protocolo: {connectionStatus?.protocol?.toUpperCase() || 'N/A'}</p>
              <p>Último heartbeat: {getLastHeartbeatText()}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Performance</span>
            </div>
            <div className="text-xs text-gray-600">
              <p>Tempo resposta: {audioStats.avgResponseTime}s</p>
              <p>Taxa de sucesso: {audioStats.successRate}%</p>
              <p>Tentativas reconexão: {connectionStatus?.reconnectAttempts || 0}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {audioStats.failedCount > 0 ? (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              <span className="text-sm font-medium">Áudio</span>
            </div>
            <div className="text-xs text-gray-600">
              <p>Falhas pendentes: {audioStats.failedCount}</p>
              <p>Sistema fallback: Ativo</p>
              <p>Conversão texto: Disponível</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {!connectionStatus?.isConnected && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-800">Sistema Offline</span>
            </div>
            <p className="text-xs text-red-600 mt-1">
              O servidor WhatsApp não está respondendo. Tentativas de reconexão em andamento.
            </p>
          </div>
        )}

        {audioStats.failedCount > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-800">Áudios Pendentes</span>
            </div>
            <p className="text-xs text-yellow-600 mt-1">
              {audioStats.failedCount} áudio(s) aguardando reenvio manual.
            </p>
          </div>
        )}

        {connectionStatus?.reconnectAttempts > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-800">Reconectando</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Tentativa {connectionStatus.reconnectAttempts} de {connectionStatus.maxReconnectAttempts} em andamento.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleForceReconnect}
            disabled={connectionStatus?.isConnected}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Forçar Reconexão
          </Button>
          
          {audioStats.failedCount > 0 && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => audioFallbackService.clearFailedAudios()}
            >
              Limpar Falhas
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemHealthMonitor;
