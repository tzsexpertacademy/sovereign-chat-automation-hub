import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Wifi, WifiOff, Clock, Zap } from 'lucide-react';
import { yumerNativeWebSocketService } from '@/services/yumerNativeWebSocketService';
import { yumerJwtService } from '@/services/yumerJwtService';
import { toast } from 'sonner';

interface ConnectionLog {
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'warning';
  message: string;
  details?: any;
}

interface WebSocketEvent {
  timestamp: string;
  eventType: string;
  data: any;
}

export const NativeWebSocketDebugger: React.FC = () => {
  // Estado da conexão
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting'>('disconnected');
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  
  // Parâmetros de conexão
  const [instanceName, setInstanceName] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('qrcode.updated');
  const [availableEvents, setAvailableEvents] = useState<string[]>([
    'qrcode.updated',
    'connection.update',
    'message.upsert',
    'MESSAGE_RECEIVED'
  ]);
  const [useSecureConnection, setUseSecureConnection] = useState(true);
  
  // Logs e eventos
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([]);
  const [receivedEvents, setReceivedEvents] = useState<WebSocketEvent[]>([]);
  
  // Estado de teste
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  // ============ INICIALIZAÇÃO ============
  useEffect(() => {
    loadAvailableEvents();
    checkCurrentStatus();
    
    // Cleanup na desmontagem
    return () => {
      if (isConnected) {
        yumerNativeWebSocketService.disconnect();
      }
    };
  }, []);

  const loadAvailableEvents = async () => {
    // Eventos padrão do CodeChat
    const codechatEvents = [
      'qrcode.updated',
      'connection.update', 
      'message.upsert',
      'MESSAGE_RECEIVED'
    ];
    
    setAvailableEvents(codechatEvents);
    addLog('success', 'Eventos CodeChat carregados', { count: codechatEvents.length, events: codechatEvents });
  };

  const checkCurrentStatus = () => {
    const connected = yumerNativeWebSocketService.isConnected();
    const info = yumerNativeWebSocketService.getConnectionInfo();
    
    setIsConnected(connected);
    setConnectionInfo(info);
    setConnectionStatus(connected ? 'connected' : 'disconnected');
    
    if (info) {
      setInstanceName(info.instanceName || '');
      setSelectedEvent(info.event || 'qrcode.updated');
      setUseSecureConnection(info.useSecureConnection !== false);
    }
  };

  // ============ GESTÃO DE LOGS ============
  const addLog = (type: 'info' | 'error' | 'success' | 'warning', message: string, details?: any) => {
    const log: ConnectionLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details
    };
    
    setConnectionLogs(prev => [log, ...prev].slice(0, 100));
    console.log(`[WebSocket Debug] ${type.toUpperCase()}: ${message}`, details);
  };

  const addEvent = (eventType: string, data: any) => {
    const event: WebSocketEvent = {
      timestamp: new Date().toLocaleTimeString(),
      eventType,
      data
    };
    
    setReceivedEvents(prev => [event, ...prev].slice(0, 50));
  };

  // ============ CONEXÃO WEBSOCKET ============
  const handleConnect = async () => {
    if (!instanceName.trim()) {
      toast.error('Nome da instância é obrigatório');
      return;
    }

    try {
      setConnectionStatus('connecting');
      addLog('info', 'Iniciando conexão WebSocket nativa...', {
        instanceName,
        event: selectedEvent,
        secure: useSecureConnection
      });

      // Configurar listeners antes de conectar
      setupEventListeners();

      // Gerar JWT local com instanceId real
      const JWT_SECRET = 'sfdgs8152g5s1s5';
      const jwt = await yumerJwtService.generateLocalJWT(JWT_SECRET, instanceName);
      addLog('success', 'JWT gerado com sucesso', { instanceName, jwt: jwt.substring(0, 50) + '...' });

      await yumerNativeWebSocketService.connect({
        instanceName,
        event: selectedEvent,
        useSecureConnection,
        autoReconnect: true,
        maxReconnectAttempts: 10
      });
      
      setIsConnected(true);
      setConnectionStatus('connected');
      
      const info = yumerNativeWebSocketService.getConnectionInfo();
      setConnectionInfo(info);
      
      addLog('success', 'WebSocket conectado com sucesso!', info);
      toast.success('WebSocket conectado!');
      
    } catch (error: any) {
      setConnectionStatus('error');
      addLog('error', 'Erro na conexão WebSocket', error.message);
      toast.error(`Erro na conexão: ${error.message}`);
    }
  };

  const handleDisconnect = () => {
    try {
      yumerNativeWebSocketService.disconnect();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setConnectionInfo(null);
      
      addLog('info', 'WebSocket desconectado manualmente');
      toast.info('WebSocket desconectado');
    } catch (error: any) {
      addLog('error', 'Erro ao desconectar', error.message);
    }
  };

  const setupEventListeners = () => {
    // Configurar listeners para eventos CodeChat
    yumerNativeWebSocketService.on('qrcode.updated', (data) => {
      addEvent('qrcode.updated', data);
      addLog('success', 'QR Code CodeChat recebido!', { hasQrCode: !!data.qrCode || !!data.qr });
    });
    
    yumerNativeWebSocketService.on('connection.update', (data) => {
      addEvent('connection.update', data);
      addLog('info', 'Status de conexão CodeChat atualizado', data);
    });
    
    yumerNativeWebSocketService.on('message.upsert', (data) => {
      addEvent('message.upsert', data);
      addLog('info', 'Mensagem CodeChat recebida', data);
    });

    // Listeners para eventos mapeados
    yumerNativeWebSocketService.on('qr_code', (data) => {
      addEvent('qr_code', data);
      addLog('success', 'QR Code mapeado recebido!', { hasQrCode: !!data.qrCode || !!data.qr });
    });
    
    yumerNativeWebSocketService.on('instance_status', (data) => {
      addEvent('instance_status', data);
      addLog('info', 'Status da instância mapeado', data);
    });
    
    yumerNativeWebSocketService.on('message_received', (data) => {
      addEvent('message_received', data);
      addLog('info', 'Mensagem mapeada recebida', data);
    });

    // Listener para eventos genéricos
    yumerNativeWebSocketService.on('message', (data) => {
      addEvent('message', data);
      addLog('info', 'Evento genérico recebido', data);
    });

    // Listener para mudanças de status de conexão
    yumerNativeWebSocketService.onStatus((status) => {
      addLog('info', `Status da conexão: ${status}`, { status });
      setConnectionStatus(status as any);
      setIsConnected(status === 'connected');
    });
  };

  // ============ TESTE DE CONEXÃO ============
  const handleTestConnection = async () => {
    if (!instanceName.trim()) {
      toast.error('Nome da instância é obrigatório para teste');
      return;
    }

    setIsTestingConnection(true);
    setTestResults(null);
    
    try {
      addLog('info', 'Iniciando teste de conectividade...', {
        instanceName,
        event: selectedEvent,
        protocols: ['wss://', 'ws://']
      });

      // Teste com protocolo seguro
      const secureTest = await yumerNativeWebSocketService.testConnection({
        instanceName, 
        event: selectedEvent, 
        useSecureConnection: true,
        autoReconnect: false,
        maxReconnectAttempts: 1
      });
      
      // Teste com protocolo inseguro se o seguro falhar
      const insecureTest = secureTest.success ? null : await yumerNativeWebSocketService.testConnection({
        instanceName, 
        event: selectedEvent, 
        useSecureConnection: false,
        autoReconnect: false,
        maxReconnectAttempts: 1
      });

      const results = {
        secure: secureTest,
        insecure: insecureTest,
        recommendation: secureTest.success ? 'wss://' : (insecureTest?.success ? 'ws://' : 'nenhum'),
        timestamp: new Date().toISOString()
      };
      
      setTestResults(results);
      addLog('success', 'Teste de conectividade concluído', results);
      
      if (secureTest.success) {
        toast.success('Conexão segura (wss://) funcionando!');
      } else if (insecureTest?.success) {
        toast.warning('Apenas conexão insegura (ws://) funcionando');
      } else {
        toast.error('Nenhuma conexão WebSocket funcionando');
      }
      
    } catch (error: any) {
      addLog('error', 'Erro no teste de conectividade', error.message);
      toast.error(`Erro no teste: ${error.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // ============ FUNÇÕES AUXILIARES ============
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'connecting': 
      case 'reconnecting': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': 
      case 'reconnecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const clearLogs = () => {
    setConnectionLogs([]);
    setReceivedEvents([]);
    toast.info('Logs limpos');
  };

  return (
    <div className="space-y-6">
      {/* Status da Conexão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            WebSocket Nativo - Status da Conexão
            <Badge variant={isConnected ? "default" : "secondary"}>
              {connectionStatus.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>
            Monitor em tempo real da conexão WebSocket nativa com YUMER backend
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionInfo && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Instância</Label>
                <p className="text-sm font-medium">{connectionInfo.instanceName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Evento</Label>
                <p className="text-sm font-medium">{connectionInfo.event}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Protocolo</Label>
                <p className="text-sm font-medium">{connectionInfo.isSecure ? 'wss://' : 'ws://'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <p className="text-sm font-medium">{connectionInfo.stateText}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração da Conexão */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração da Conexão</CardTitle>
          <CardDescription>
            Configure os parâmetros para conexão WebSocket nativa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="instanceName">Nome da Instância</Label>
              <Input
                id="instanceName"
                placeholder="minha-instancia"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                disabled={isConnected}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="event">Evento</Label>
              <Select value={selectedEvent} onValueChange={setSelectedEvent} disabled={isConnected}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um evento" />
                </SelectTrigger>
                <SelectContent>
                  {availableEvents.map((event) => (
                    <SelectItem key={event} value={event}>
                      {event}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="secure"
              checked={useSecureConnection}
              onCheckedChange={setUseSecureConnection}
              disabled={isConnected}
            />
            <Label htmlFor="secure">Usar conexão segura (wss://)</Label>
          </div>

          <div className="flex gap-2">
            {!isConnected ? (
              <Button onClick={handleConnect} disabled={connectionStatus === 'connecting'}>
                <Wifi className="h-4 w-4 mr-2" />
                {connectionStatus === 'connecting' ? 'Conectando...' : 'Conectar'}
              </Button>
            ) : (
              <Button onClick={handleDisconnect} variant="destructive">
                <WifiOff className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
            )}
            
            <Button 
              onClick={handleTestConnection} 
              variant="outline"
              disabled={isTestingConnection || !instanceName.trim()}
            >
              <Zap className="h-4 w-4 mr-2" />
              {isTestingConnection ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados do Teste */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados do Teste de Conectividade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>wss:// (Seguro):</strong> {testResults.secure.success ? '✅ Funcionando' : '❌ Falhou'}
                  {testResults.secure.error && <p className="text-sm text-muted-foreground mt-1">{testResults.secure.error}</p>}
                </AlertDescription>
              </Alert>
              
              {testResults.insecure && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>ws:// (Inseguro):</strong> {testResults.insecure.success ? '✅ Funcionando' : '❌ Falhou'}
                    {testResults.insecure.error && <p className="text-sm text-muted-foreground mt-1">{testResults.insecure.error}</p>}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <strong>Recomendação:</strong> Use {testResults.recommendation}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs e Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logs de Conexão */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Logs de Conexão</CardTitle>
              <Button onClick={clearLogs} variant="outline" size="sm">
                Limpar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {connectionLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum log ainda</p>
              ) : (
                <div className="space-y-2">
                  {connectionLogs.map((log, index) => (
                    <div key={index} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{log.timestamp}</span>
                        <Badge 
                          variant={log.type === 'error' ? 'destructive' : log.type === 'success' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {log.type}
                        </Badge>
                      </div>
                      <p className="mt-1">{log.message}</p>
                      {log.details && (
                        <pre className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                      <Separator className="mt-2" />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Eventos Recebidos */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos WebSocket</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {receivedEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum evento recebido</p>
              ) : (
                <div className="space-y-2">
                  {receivedEvents.map((event, index) => (
                    <div key={index} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{event.timestamp}</span>
                        <Badge variant="outline">{event.eventType}</Badge>
                      </div>
                      <pre className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                      <Separator className="mt-2" />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};