
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw, Activity } from "lucide-react";
import whatsappService from "@/services/whatsappMultiClient";
import QRCodeTestHttps from "./QRCodeTestHttps";
import SSLCertificateHelper from "./SSLCertificateHelper";

const WebSocketStatusDebug = () => {
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [instanceEvents, setInstanceEvents] = useState<any[]>([]);

  useEffect(() => {
    const socket = whatsappService.getSocket();
    
    if (socket) {
      const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setConnectionLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
      };

      const handleConnect = () => {
        setWsConnected(true);
        addLog("✅ WebSocket conectado via Nginx HTTPS");
      };

      const handleDisconnect = (reason: string) => {
        setWsConnected(false);
        addLog(`❌ WebSocket desconectado: ${reason}`);
      };

      const handleError = (error: any) => {
        addLog(`❌ Erro WebSocket: ${error.message || error}`);
      };

      // Listener genérico para eventos de instância
      const handleInstanceEvent = (eventName: string) => (data: any) => {
        const timestamp = new Date().toLocaleTimeString();
        setInstanceEvents(prev => [...prev.slice(-4), {
          timestamp,
          event: eventName,
          data: {
            instanceId: data.clientId || data.instanceId,
            status: data.status,
            phoneNumber: data.phoneNumber || 'N/A',
            hasQrCode: data.hasQrCode || false
          }
        }]);
        addLog(`📱 Evento ${eventName}: ${data.clientId || data.instanceId} -> ${data.status}`);
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleError);

      // Status inicial
      if (socket.connected) {
        handleConnect();
      }

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleError);
      };
    }
  }, []);

  const testConnection = async () => {
    try {
      const result = await whatsappService.testConnection();
      setConnectionLogs(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] Test Nginx: ${result.message}`]);
    } catch (error: any) {
      setConnectionLogs(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] Test Nginx failed: ${error.message}`]);
    }
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
                <span>WebSocket via Nginx HTTPS</span>
              </CardTitle>
              <CardDescription>
                Monitor de conexão WebSocket via proxy Nginx
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={wsConnected ? "default" : "destructive"}>
                {wsConnected ? "Conectado via Nginx" : "Desconectado"}
              </Badge>
              <Button size="sm" onClick={testConnection}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Testar Nginx
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <h4 className="font-medium">Logs de Conexão via Nginx:</h4>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono max-h-32 overflow-y-auto">
              {connectionLogs.length > 0 ? (
                connectionLogs.map((log, index) => (
                  <div key={index} className="text-xs">{log}</div>
                ))
              ) : (
                <div className="text-gray-500">Aguardando logs do Nginx...</div>
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
            <span>Eventos de Instâncias HTTPS</span>
          </CardTitle>
          <CardDescription>
            Últimos eventos WebSocket HTTPS das instâncias
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
                Nenhum evento HTTPS de instância ainda...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Code Test HTTPS */}
      <QRCodeTestHttps />
    </div>
  );
};

export default WebSocketStatusDebug;
