import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Activity, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { socketIOWebSocketService } from '@/services/socketIOWebSocketService';

interface WebSocketMonitorProps {
  instanceId?: string;
  clientId?: string;
  className?: string;
}

const WebSocketMonitor = ({ instanceId, clientId, className = '' }: WebSocketMonitorProps) => {
  const [status, setStatus] = useState<any>({});
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    // Monitorar status do WebSocket a cada segundo
    const interval = setInterval(() => {
      const currentStatus = socketIOWebSocketService.getStatus();
      setStatus(currentStatus);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (status.connected) return 'bg-success';
    if (status.configured) return 'bg-warning';
    return 'bg-destructive';
  };

  const getStatusText = () => {
    if (status.connected) return 'Conectado';
    if (status.configured) return 'Configurado';
    return 'Desconectado';
  };

  const getStatusIcon = () => {
    if (status.connected) return <Wifi className="h-3 w-3" />;
    if (status.configured) return <Activity className="h-3 w-3" />;
    return <WifiOff className="h-3 w-3" />;
  };

  const handleTestConnection = async () => {
    if (!instanceId || !clientId) {
      setTestResult('❌ Instância ou cliente não definidos');
      return;
    }

    setTestResult('🧪 Testando conexão...');
    
    try {
      const success = await socketIOWebSocketService.testConnection(instanceId, clientId);
      if (success) {
        setTestResult('✅ Teste de conexão bem-sucedido!');
      } else {
        setTestResult('❌ Falha no teste de conexão');
      }
    } catch (error: any) {
      setTestResult(`❌ Erro: ${error.message}`);
    }
  };

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          🔌 Monitor WebSocket
          <Badge 
            variant="secondary" 
            className={`text-white text-xs flex items-center gap-1 ${getStatusColor()}`}
          >
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status de Conexão */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Conectado:</span>
            <div className="flex items-center gap-1">
              {status.connected ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
              {status.connected ? 'Sim' : 'Não'}
            </div>
          </div>
          
          <div>
            <span className="text-muted-foreground">Autenticado:</span>
            <div className="flex items-center gap-1">
              {status.authenticated ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
              {status.authenticated ? 'Sim' : 'Não'}
            </div>
          </div>
          
          <div>
            <span className="text-muted-foreground">Configurado:</span>
            <div className="flex items-center gap-1">
              {status.configured ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
              {status.configured ? 'Sim' : 'Não'}
            </div>
          </div>
          
          <div>
            <span className="text-muted-foreground">Tentativas:</span>
            <span className="font-mono">{status.reconnectAttempts || 0}</span>
          </div>
        </div>

        {/* Última Mensagem */}
        {status.lastHeartbeat && (
          <div className="text-sm">
            <span className="text-muted-foreground">Último Heartbeat:</span>
            <div className="font-mono text-xs">
              {new Date(status.lastHeartbeat).toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Métricas de Mensagens */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Mensagens:</span>
            <span className="font-mono">{messageCount}</span>
          </div>
          
          {lastMessageTime && (
            <div>
              <span className="text-muted-foreground">Última:</span>
              <div className="font-mono text-xs">
                {lastMessageTime.toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>

        {/* Erro */}
        {status.error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            <strong>Erro:</strong> {status.error}
          </div>
        )}

        {/* Teste de Conectividade */}
        <div className="space-y-2">
          <Button 
            onClick={handleTestConnection}
            size="sm"
            variant="outline"
            className="w-full"
            disabled={!instanceId || !clientId}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Testar Conexão
          </Button>
          
          {testResult && (
            <div className="text-xs font-mono bg-gray-50 p-2 rounded">
              {testResult}
            </div>
          )}
        </div>

        {/* Debug Info */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
          <pre className="mt-2 bg-gray-50 p-2 rounded overflow-auto text-xs">
            {JSON.stringify(status, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
};

export default WebSocketMonitor;