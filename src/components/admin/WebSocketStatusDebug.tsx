import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw, Activity } from "lucide-react";
import whatsappService from "@/services/whatsappMultiClient";

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
        addLog("✅ WebSocket conectado");
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

      // Interceptar eventos de status das instâncias
      const originalOn = socket.on.bind(socket);
      socket.on = function(event: string, callback: Function) {
        if (event.startsWith('client_status_')) {
          const wrappedCallback = (data: any) => {
            handleInstanceEvent(event)(data);
            callback(data);
          };
          return originalOn(event, wrappedCallback);
        }
        return originalOn(event, callback);
      };

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
      setConnectionLogs(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] Test: ${result.message}`]);
    } catch (error: any) {
      setConnectionLogs(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] Test failed: ${error.message}`]);
    }
  };

  return (
    <div className="space-y-4">
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
                <span>WebSocket Debug</span>
              </CardTitle>
              <CardDescription>
                Monitor de conexão em tempo real
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={wsConnected ? "default" : "destructive"}>
                {wsConnected ? "Conectado" : "Desconectado"}
              </Badge>
              <Button size="sm" onClick={testConnection}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Testar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <h4 className="font-medium">Logs de Conexão:</h4>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm font-mono max-h-32 overflow-y-auto">
              {connectionLogs.length > 0 ? (
                connectionLogs.map((log, index) => (
                  <div key={index} className="text-xs">{log}</div>
                ))
              ) : (
                <div className="text-gray-500">Nenhum log ainda...</div>
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
            Últimos eventos WebSocket das instâncias
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
                Nenhum evento de instância ainda...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* QR Code Debugger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Teste QR Code Rápido</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QRCodeTest />
        </CardContent>
      </Card>
    </div>
  );
};

// Componente interno para teste QR Code
const QRCodeTest = () => {
  const [qrData, setQrData] = useState<{qrCode?: string, status: string, loading: boolean}>({
    status: 'disconnected',
    loading: false
  });
  const [testId] = useState(() => `test_${Date.now()}`);
  const [attempts, setAttempts] = useState(0);
  const [isScanned, setIsScanned] = useState(false);

  const generateQR = async () => {
    try {
      setQrData(prev => ({ ...prev, loading: true, status: 'connecting' }));
      setIsScanned(false);
      
      console.log(`🚀 Conectando ${testId}...`);
      
      // Conectar diretamente via API
      const response = await fetch(`https://146.59.227.248/clients/${testId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      console.log('✅ Comando connect enviado');
      
      // Aguardar e verificar status - VERSÃO MELHORADA
      let attemptCount = 0;
      const checkStatus = async () => {
        attemptCount++;
        setAttempts(attemptCount);
        console.log(`🔄 Verificando status (${attemptCount}/20)...`);
        
        try {
          const statusResponse = await fetch(`https://146.59.227.248/clients/${testId}/status`, {
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
          });
          
          if (statusResponse.ok) {
            const data = await statusResponse.json();
            console.log('📊 Status recebido:', data);
            
            // DETECTAR CONEXÃO MELHORADA
            const isConnected = data.success && (
              data.status === 'connected' || 
              data.status === 'authenticated' ||
              data.status === 'ready' ||
              (data.phoneNumber && data.phoneNumber.length > 0)
            );
            
            if (isConnected) {
              console.log('🎉 WhatsApp CONECTADO com sucesso!');
              setQrData({
                status: 'connected',
                loading: false,
                qrCode: data.qrCode
              });
              setIsScanned(true);
              return;
            }
            
            if (data.success && data.hasQrCode && data.qrCode) {
              console.log('📱 QR Code disponível');
              setQrData({
                qrCode: data.qrCode,
                status: 'qr_ready',
                loading: false
              });
              
              // Se QR foi gerado, continuar verificando por mais tempo (até 2 minutos)
              if (attemptCount < 40) { // 40 x 3s = 2 minutos
                setTimeout(checkStatus, 3000);
              } else {
                setQrData(prev => ({ ...prev, loading: false, status: 'timeout' }));
              }
              return;
            }
            
            // Status ainda connecting - continuar verificando
            if (data.success && data.status === 'connecting') {
              if (attemptCount < 20) { // Primeira fase: 1 minuto
                setTimeout(checkStatus, 3000);
              } else {
                setQrData(prev => ({ ...prev, loading: false, status: 'waiting_qr' }));
              }
              return;
            }
          }
          
          if (attemptCount < 20) {
            setTimeout(checkStatus, 3000);
          } else {
            setQrData(prev => ({ ...prev, loading: false, status: 'timeout' }));
          }
        } catch (error) {
          console.error(`❌ Erro na verificação ${attemptCount}:`, error);
          if (attemptCount < 20) {
            setTimeout(checkStatus, 3000);
          } else {
            setQrData(prev => ({ ...prev, loading: false, status: 'error' }));
          }
        }
      };
      
      // Iniciar verificação após 2 segundos
      setTimeout(checkStatus, 2000);
      
    } catch (error: any) {
      console.error('❌ Erro ao gerar QR:', error);
      setQrData({ status: 'error', loading: false });
    }
  };

  // Verificação contínua quando QR foi escaneado
  useEffect(() => {
    if (qrData.status === 'qr_ready' && qrData.qrCode && !isScanned) {
      console.log('📱 QR Code ativo - iniciando verificação contínua...');
      
      const continuousCheck = setInterval(async () => {
        try {
          const response = await fetch(`https://146.59.227.248/clients/${testId}/status`, {
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors'
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('🔄 Verificação contínua:', data.status);
            
            const isConnected = data.success && (
              data.status === 'connected' || 
              data.status === 'authenticated' ||
              data.status === 'ready' ||
              (data.phoneNumber && data.phoneNumber.length > 0)
            );
            
            if (isConnected) {
              console.log('🎉 CONEXÃO DETECTADA na verificação contínua!');
              setQrData({
                status: 'connected',
                loading: false,
                qrCode: data.qrCode
              });
              setIsScanned(true);
              clearInterval(continuousCheck);
            }
          }
        } catch (error) {
          console.warn('Erro na verificação contínua:', error);
        }
      }, 2000); // Verificar a cada 2 segundos
      
      // Limpar após 3 minutos
      setTimeout(() => {
        clearInterval(continuousCheck);
      }, 180000);
      
      return () => clearInterval(continuousCheck);
    }
  }, [qrData.status, qrData.qrCode, isScanned, testId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
        <span className="text-sm font-medium">Test ID:</span>
        <code className="text-xs bg-white px-2 py-1 rounded">{testId}</code>
      </div>
      
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
        <span className="text-sm font-medium">Status:</span>
        <div className="flex items-center space-x-2">
          <Badge variant={qrData.status === 'connected' ? 'default' : 'secondary'}>
            {qrData.status}
          </Badge>
          {qrData.loading && attempts > 0 && (
            <span className="text-xs text-gray-500">({attempts}/10)</span>
          )}
        </div>
      </div>

      {qrData.qrCode && (
        <div className="text-center space-y-2">
          <div className="p-4 bg-white border-2 border-dashed border-green-300 rounded-lg">
            <img 
              src={qrData.qrCode} 
              alt="QR Code" 
              className="max-w-xs mx-auto"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <p className="text-xs text-green-600 font-medium">
            ✅ QR Code Disponível! Escaneie com WhatsApp
          </p>
        </div>
      )}

      {qrData.status === 'connected' && (
        <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg text-center">
          <div className="text-2xl mb-2">🎉</div>
          <p className="text-green-800 font-bold text-lg">WhatsApp Conectado!</p>
          <p className="text-green-600 text-sm">Instância funcionando perfeitamente</p>
        </div>
      )}

      {qrData.status === 'qr_ready' && !isScanned && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-center">
          <p className="text-blue-800 font-medium">📱 Aguardando escaneamento...</p>
          <p className="text-blue-600 text-sm">Verificação contínua ativa</p>
        </div>
      )}

      {qrData.status === 'timeout' && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-center">
          <p className="text-yellow-800 font-medium">⏰ Timeout</p>
          <p className="text-yellow-600 text-sm">Tente gerar um novo QR Code</p>
        </div>
      )}

      <Button 
        onClick={generateQR} 
        disabled={qrData.loading}
        className="w-full"
        variant={qrData.status === 'connected' ? 'secondary' : 'default'}
      >
        {qrData.loading ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            {qrData.status === 'qr_ready' ? 'Aguardando conexão...' : 'Gerando QR Code...'}
          </>
        ) : (
          <>
            <Activity className="w-4 h-4 mr-2" />
            {qrData.status === 'connected' ? 'Reconectar' : 'Gerar QR Code'}
          </>
        )}
      </Button>
    </div>
  );
};

export default WebSocketStatusDebug;