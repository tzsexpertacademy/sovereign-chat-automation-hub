
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw, Activity } from "lucide-react";
import { yumerWhatsAppService } from "@/services/yumerWhatsappService";
import QRCodeTestHttps from "./QRCodeTestHttps";
import SSLCertificateHelper from "./SSLCertificateHelper";
import ConnectionDiagnostics from "./ConnectionDiagnostics";

const WebSocketStatusDebug = () => {
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [instanceEvents, setInstanceEvents] = useState<any[]>([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let socket = yumerWhatsAppService.getSocket();
    
    // Se não existe socket, tenta conectar
    if (!socket) {
      console.log('🔌 Iniciando conexão WebSocket...');
      socket = yumerWhatsAppService.connectWebSocket();
    }

    const addLog = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]);
    };

    const handleConnect = () => {
      setWsConnected(true);
      setLastError(null);
      addLog("✅ WebSocket conectado com sucesso");
      addLog(`📊 Socket ID: ${socket?.id}`);
      addLog(`🔄 Transport: ${socket?.io.engine.transport.name}`);
    };

    const handleDisconnect = (reason: string) => {
      setWsConnected(false);
      addLog(`❌ WebSocket desconectado: ${reason}`);
      if (reason === 'transport close') {
        addLog("🔧 Conexão perdida - tentando reconectar...");
      }
    };

    const handleError = (error: any) => {
      const errorMsg = error.message || error.toString();
      setLastError(errorMsg);
      addLog(`❌ Erro WebSocket: ${errorMsg}`);
      
      // Diagnóstico de erro
      if (errorMsg.includes('ECONNREFUSED')) {
        addLog("🔧 Diagnóstico: Servidor rejeitou conexão - verificar se está rodando");
      } else if (errorMsg.includes('timeout')) {
        addLog("🔧 Diagnóstico: Timeout - servidor muito lento ou não responde");
      } else if (errorMsg.includes('ENOTFOUND')) {
        addLog("🔧 Diagnóstico: Erro DNS - verificar URL do servidor");
      }
    };

    const handleReconnectAttempt = (attemptNumber: number) => {
      setConnectionAttempts(attemptNumber);
      addLog(`🔄 Tentativa de reconexão #${attemptNumber}`);
    };

    const handleReconnect = (attemptNumber: number) => {
      setConnectionAttempts(0);
      addLog(`✅ Reconectado após ${attemptNumber} tentativas`);
    };

    const handleReconnectError = (error: any) => {
      addLog(`❌ Erro na reconexão: ${error.message}`);
    };

    const handleReconnectFailed = () => {
      addLog("❌ Falha total na reconexão - todas as tentativas esgotadas");
    };

    // Listener genérico para eventos de instância
    const handleInstanceEvent = (eventName: string) => (data: any) => {
      const timestamp = new Date().toLocaleTimeString();
      setInstanceEvents(prev => [...prev.slice(-9), {
        timestamp,
        event: eventName,
        data: {
          instanceId: data.clientId || data.instanceId || 'unknown',
          status: data.status || 'unknown',
          phoneNumber: data.phoneNumber || 'N/A',
          hasQrCode: data.hasQrCode || false
        }
      }]);
      addLog(`📱 Evento ${eventName}: ${data.clientId || data.instanceId} -> ${data.status}`);
    };

    // Registrar todos os event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect', handleReconnect);
    socket.on('reconnect_error', handleReconnectError);
    socket.on('reconnect_failed', handleReconnectFailed);

    // Eventos específicos do YUMER
    socket.on('instance:status', handleInstanceEvent('instance:status'));
    socket.on('instance:qr', handleInstanceEvent('instance:qr'));
    socket.on('instance:ready', handleInstanceEvent('instance:ready'));
    socket.on('instance:disconnected', handleInstanceEvent('instance:disconnected'));

    // Status inicial
    if (socket.connected) {
      handleConnect();
    } else {
      addLog("🔌 Aguardando conexão WebSocket...");
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleError);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect', handleReconnect);
      socket.off('reconnect_error', handleReconnectError);
      socket.off('reconnect_failed', handleReconnectFailed);
      socket.off('instance:status', handleInstanceEvent('instance:status'));
      socket.off('instance:qr', handleInstanceEvent('instance:qr'));
      socket.off('instance:ready', handleInstanceEvent('instance:ready'));
      socket.off('instance:disconnected', handleInstanceEvent('instance:disconnected'));
    };
  }, []);

  const testConnection = async () => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] 🧪 Iniciando teste de conectividade...`]);
    
    try {
      // Test 1: Health Check
      const healthCheck = await yumerWhatsAppService.checkServerHealth();
      if (healthCheck.status === 'online') {
        setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] ✅ Health check: Servidor online`]);
        
        // Test 2: API Call
        const instances = await yumerWhatsAppService.fetchAllInstances();
        setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] ✅ API: ${instances.length} instâncias encontradas`]);
        
        // Test 3: WebSocket
        const socket = yumerWhatsAppService.getSocket();
        if (socket && socket.connected) {
          setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] ✅ WebSocket: Conectado (${socket.id})`]);
        } else {
          setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] ⚠️ WebSocket: Desconectado, tentando reconectar...`]);
          yumerWhatsAppService.connectWebSocket();
        }
      } else {
        setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] ❌ Health check falhou: ${healthCheck.details.error}`]);
      }
    } catch (error: any) {
      setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] ❌ Teste falhou: ${error.message}`]);
      
      // Diagnóstico detalhado
      if (error.message.includes('Failed to fetch')) {
        setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] 🔧 Possível problema: CORS, SSL ou firewall`]);
      } else if (error.message.includes('timeout')) {
        setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] 🔧 Possível problema: Servidor muito lento`]);
      }
    }
  };

  const forceReconnectWebSocket = () => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] 🔄 Forçando reconexão WebSocket...`]);
    
    yumerWhatsAppService.disconnectWebSocket();
    setTimeout(() => {
      yumerWhatsAppService.connectWebSocket();
      setConnectionLogs(prev => [...prev.slice(-19), `[${timestamp}] 🔌 Nova conexão WebSocket iniciada`]);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* SSL Certificate Helper - NOVO */}
      <SSLCertificateHelper />

      {/* Status Geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                {wsConnected ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span>WebSocket via YUMER</span>
              </CardTitle>
              <CardDescription>
                Monitor de conexão WebSocket do YUMER Backend
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={wsConnected ? "default" : "destructive"}>
                {wsConnected ? "Conectado" : "Desconectado"}
                {connectionAttempts > 0 && ` (Tentando #${connectionAttempts})`}
              </Badge>
              <Button size="sm" onClick={testConnection} variant="outline">
                <RefreshCw className="w-4 h-4 mr-1" />
                Testar
              </Button>
              <Button size="sm" onClick={forceReconnectWebSocket} variant="ghost">
                🔄 Reconectar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Logs de Conexão:</h4>
              {lastError && (
                <Badge variant="destructive" className="text-xs">
                  {lastError.substring(0, 30)}...
                </Badge>
              )}
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono max-h-40 overflow-y-auto">
              {connectionLogs.length > 0 ? (
                connectionLogs.map((log, index) => (
                  <div key={index} className={`text-xs ${
                    log.includes('✅') ? 'text-green-600' : 
                    log.includes('❌') ? 'text-red-600' : 
                    log.includes('🔄') ? 'text-blue-600' : 
                    log.includes('🔧') ? 'text-yellow-600' : 
                    ''
                  }`}>{log}</div>
                ))
              ) : (
                <div className="text-gray-500">Aguardando logs de conexão...</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eventos de Instâncias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Eventos de Instâncias</span>
          </CardTitle>
          <CardDescription>
            Últimos eventos WebSocket das instâncias WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {instanceEvents.length > 0 ? (
              instanceEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-gray-500">{event.timestamp}</span>
                    <span className="font-medium">{event.data.instanceId}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{event.data.status}</Badge>
                    {event.data.phoneNumber !== 'N/A' && (
                      <span className="text-xs text-green-600">{event.data.phoneNumber}</span>
                    )}
                    {event.data.hasQrCode && (
                      <Badge variant="secondary">QR</Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-4">
                {wsConnected ? 
                  'Aguardando eventos de instâncias...' : 
                  'WebSocket desconectado - nenhum evento recebido'
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connection Diagnostics */}
      <ConnectionDiagnostics />

      {/* QR Code Test HTTPS */}
      <QRCodeTestHttps />
    </div>
  );
};

export default WebSocketStatusDebug;
