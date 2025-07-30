import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { socketIOWebSocketService } from '@/services/socketIOWebSocketService';
import { Wifi, WifiOff, Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface WebSocketDebugPanelProps {
  instanceId: string;
  clientId: string;
  className?: string;
}

const WebSocketDebugPanel = ({ instanceId, clientId, className = '' }: WebSocketDebugPanelProps) => {
  const [status, setStatus] = useState<any>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [messageCount, setMessageCount] = useState(0);

  // Capturar console.log para debugging
  useEffect(() => {
    const originalLog = console.log;
    console.log = (...args) => {
      const message = args.join(' ');
      if (message.includes('[SOCKET.IO]') || message.includes('[FASE-')) {
        setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${message}`]);
      }
      originalLog(...args);
    };

    return () => {
      console.log = originalLog;
    };
  }, []);

  // Atualizar status periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      const currentStatus = socketIOWebSocketService.getStatus();
      setStatus(currentStatus);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const testConnection = async () => {
    setIsConnecting(true);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: 🧪 INICIANDO TESTE DE CONEXÃO...`]);
    
    try {
      const result = await socketIOWebSocketService.testConnection(instanceId, clientId);
      setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result ? '✅' : '❌'} TESTE FINALIZADO: ${result ? 'SUCESSO' : 'FALHA'}`]);
    } catch (error: any) {
      setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ❌ ERRO NO TESTE: ${error.message}`]);
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusIcon = () => {
    if (status.connected && status.authenticated) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status.connected) return <Activity className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusColor = () => {
    if (status.connected && status.authenticated) return 'bg-green-500';
    if (status.connected) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (status.connected && status.authenticated) return 'Conectado & Autenticado';
    if (status.connected) return 'Conectado (Não Autenticado)';
    return 'Desconectado';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            {getStatusIcon()}
            WebSocket Debug Panel - PLANO DE CORREÇÃO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Atual */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Status da Conexão</div>
              <Badge variant="secondary" className={`text-white ${getStatusColor()}`}>
                {getStatusText()}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Tentativas de Reconexão</div>
              <Badge variant="outline">
                {status.reconnectAttempts || 0} / 3
              </Badge>
            </div>
          </div>

          {/* Informações Detalhadas */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Conectado:</span>
              <span className="ml-2">{status.connected ? '✅' : '❌'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Autenticado:</span>
              <span className="ml-2">{status.authenticated ? '✅' : '❌'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Configurado:</span>
              <span className="ml-2">{status.configured ? '✅' : '❌'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Último Heartbeat:</span>
              <span className="ml-2">
                {status.lastHeartbeat ? new Date(status.lastHeartbeat).toLocaleTimeString() : 'Nunca'}
              </span>
            </div>
          </div>

          {/* Erro Atual */}
          {status.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {status.error}
              </AlertDescription>
            </Alert>
          )}

          {/* Contador de Mensagens */}
          <div className="text-xs">
            <span className="text-muted-foreground">Mensagens Recebidas:</span>
            <span className="ml-2 font-mono">{messageCount}</span>
          </div>

          {/* Última Mensagem */}
          {lastMessage && (
            <div className="text-xs p-2 bg-muted rounded border">
              <div className="text-muted-foreground mb-1">Última Mensagem:</div>
              <div className="font-mono text-xs break-all">
                ID: {lastMessage.messageId}<br/>
                Tipo: {lastMessage.contentType}<br/>
                De: {lastMessage.keyFromMe ? 'Eu' : lastMessage.pushName}
              </div>
            </div>
          )}

          {/* Botão de Teste */}
          <Button 
            onClick={testConnection} 
            disabled={isConnecting}
            size="sm"
            className="w-full"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                Testando...
              </>
            ) : (
              'Executar Teste de Conexão'
            )}
          </Button>

          {/* Logs de Debug */}
          <div className="border rounded p-2 bg-black text-green-400 text-xs font-mono max-h-48 overflow-y-auto">
            <div className="text-white mb-2">📋 Logs do Sistema:</div>
            {logs.length === 0 ? (
              <div className="text-gray-500">Aguardando logs...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebSocketDebugPanel;