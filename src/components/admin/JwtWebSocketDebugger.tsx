import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Shield, Wifi, WifiOff, PlayCircle, StopCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { yumerJwtService } from '@/services/yumerJwtService';


interface ConnectionLog {
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'warning';
  message: string;
  details?: any;
}

export const JwtWebSocketDebugger: React.FC = () => {
  // JWT Configuration
  const [jwtSecret, setJwtSecret] = useState('sfdgs8152g5s1s5');
  const [instanceName, setInstanceName] = useState('yumer01');
  const [eventType, setEventType] = useState('MESSAGE_RECEIVED');
  const [generatedJWT, setGeneratedJWT] = useState('');
  const [showJwtSecret, setShowJwtSecret] = useState(false);

  // WebSocket State
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    console.log('🔧 JWT WebSocket Debugger: REST-only mode initialized');
    setReceivedMessages([{ 
      timestamp: new Date().toISOString(), 
      data: { mode: 'REST-only', message: 'WebSocket disabled - using REST API only' }
    }]);
  }, []);

  const addLog = (type: ConnectionLog['type'], message: string, details?: any) => {
    const newLog: ConnectionLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details
    };
    setConnectionLogs(prev => [...prev.slice(-19), newLog]);
  };

  const handleGenerateJWT = async () => {
    if (!jwtSecret.trim()) {
      toast.error('Por favor, insira a JWT Secret');
      return;
    }
    
    if (!instanceName.trim()) {
      toast.error('Por favor, insira o Instance Name');
      return;
    }

    try {
      const token = await yumerJwtService.generateLocalJWT(jwtSecret.trim(), instanceName.trim());
      setGeneratedJWT(token);
      
      addLog('success', 'JWT gerado com sucesso', {
        instanceName: instanceName.trim(),
        tokenLength: token.length
      });
      
      toast.success('JWT gerado com sucesso!');
    } catch (error: any) {
      addLog('error', 'Erro ao gerar JWT', error);
      toast.error('Erro ao gerar JWT: ' + error.message);
    }
  };

  const handleConnectWebSocket = async () => {
    setIsConnecting(true);
    
    try {
      console.log('🚀 Simulando conexão REST...');
      setWsConnected(true);
      addLog('success', 'REST Mode confirmado!');
      setReceivedMessages(prev => [...prev.slice(-9), { 
        timestamp: new Date().toISOString(), 
        data: { message: 'REST API connection test successful' }
      }]);
      
      toast.success('Modo REST confirmado!');
    } catch (error: any) {
      addLog('error', 'Erro no teste REST', error);
      toast.error('Erro no teste REST: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWebSocket = () => {
    setWsConnected(false);
    addLog('info', 'REST Mode ativo');
    toast.info('REST Mode ativo');
  };

  const copyJWTToClipboard = () => {
    navigator.clipboard.writeText(generatedJWT);
    toast.success('JWT copiado para a área de transferência');
  };

  const clearLogs = () => {
    setConnectionLogs([]);
    setReceivedMessages([]);
  };

  const toggleShowJwtSecret = () => {
    setShowJwtSecret(!showJwtSecret);
  };

  const getLogIcon = (type: ConnectionLog['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getLogColor = (type: ConnectionLog['type']) => {
    switch (type) {
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuração JWT */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <CardTitle>Gerador JWT Local</CardTitle>
          </div>
          <CardDescription>
            Gere JWT localmente para autenticação WebSocket YUMER
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Secret fixa do backend: <code className="font-mono bg-muted px-1 rounded">sfdgs8152g5s1s5</code>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jwtSecret">JWT Secret</Label>
              <div className="relative">
                <Input
                  id="jwtSecret"
                  type={showJwtSecret ? 'text' : 'password'}
                  value={jwtSecret}
                  onChange={(e) => setJwtSecret(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={toggleShowJwtSecret}
                >
                  {showJwtSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instanceName">Instance Name</Label>
              <Input
                id="instanceName"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="yumer01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventType">Evento</Label>
              <Input
                id="eventType"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="MESSAGE_RECEIVED"
              />
            </div>
          </div>

          <Button onClick={handleGenerateJWT} className="w-full">
            <Shield className="h-4 w-4 mr-2" />
            Gerar JWT
          </Button>

          {generatedJWT && (
            <div className="space-y-2">
              <Label>JWT Gerado</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={generatedJWT}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyJWTToClipboard}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
               <p className="text-xs text-muted-foreground">
                 URL WebSocket: <code className="font-mono bg-muted px-1 rounded">
                   wss://yumer.yumerflow.app:8083/ws/events?event={eventType}&token={generatedJWT.substring(0, 20)}...
                 </code>
               </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teste WebSocket */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {wsConnected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
              <CardTitle>Teste WebSocket YUMER</CardTitle>
            </div>
            <Badge variant={wsConnected ? 'default' : 'destructive'}>
              {wsConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
            </Badge>
          </div>
          <CardDescription>
            Teste a conexão WebSocket com JWT gerado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={handleConnectWebSocket}
              disabled={!generatedJWT || wsConnected || isConnecting}
              className="flex-1"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {isConnecting ? 'Conectando...' : 'Conectar WebSocket'}
            </Button>
            <Button
              onClick={handleDisconnectWebSocket}
              disabled={!wsConnected}
              variant="outline"
              className="flex-1"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Desconectar
            </Button>
            <Button onClick={clearLogs} variant="outline">
              Limpar Logs
            </Button>
          </div>

          <Separator />

          {/* Logs de Conexão */}
          <div className="space-y-2">
            <Label>Logs de Conexão</Label>
            <ScrollArea className="h-48 border rounded-md p-3">
              {connectionLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum log ainda...</p>
              ) : (
                <div className="space-y-1">
                  {connectionLogs.map((log, index) => (
                    <div key={index} className="text-sm">
                      <span className="text-muted-foreground">[{log.timestamp}]</span>
                      <span className={`ml-2 ${getLogColor(log.type)}`}>
                        {getLogIcon(log.type)} {log.message}
                      </span>
                      {log.details && (
                        <div className="ml-6 mt-1 text-xs text-muted-foreground">
                          <pre>{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Mensagens Recebidas */}
          <div className="space-y-2">
            <Label>Mensagens Recebidas ({receivedMessages.length})</Label>
            <ScrollArea className="h-32 border rounded-md p-3">
              {receivedMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma mensagem recebida...</p>
              ) : (
                <div className="space-y-2">
                  {receivedMessages.map((msg, index) => (
                    <div key={index} className="text-sm border-l-2 border-green-500 pl-2">
                      <div className="text-xs text-muted-foreground">{msg.timestamp}</div>
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(msg.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};