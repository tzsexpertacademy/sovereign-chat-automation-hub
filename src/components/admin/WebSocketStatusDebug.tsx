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

// Componente interno para teste QR Code - VERSÃO FORÇADA
const QRCodeTest = () => {
  const [qrData, setQrData] = useState<{qrCode?: string, status: string, loading: boolean, phoneNumber?: string}>({
    status: 'disconnected',
    loading: false
  });
  const [testId] = useState(() => `test_${Date.now()}`);
  const [attempts, setAttempts] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-4), `[${timestamp}] ${message}`]);
    console.log(message);
  };

  // WebSocket listener em tempo real
  useEffect(() => {
    if (qrData.status === 'qr_ready') {
      addLog('🎧 Ativando WebSocket listener...');
      
      const socket = whatsappService.getSocket();
      if (socket) {
        const eventName = `client_status_${testId}`;
        
        const handleWebSocketStatus = (data: any) => {
          addLog(`📡 WebSocket evento: ${JSON.stringify(data)}`);
          
          if (data.phoneNumber && data.phoneNumber.length > 0) {
            addLog('🎉 TELEFONE DETECTADO via WebSocket!');
            setQrData({
              status: 'connected',
              loading: false,
              phoneNumber: data.phoneNumber
            });
          } else if (data.status === 'connected' || data.status === 'authenticated' || data.status === 'ready') {
            addLog('✅ STATUS CONECTADO via WebSocket!');
            setQrData({
              status: 'connected',
              loading: false,
              phoneNumber: data.phoneNumber
            });
          }
        };

        socket.on(eventName, handleWebSocketStatus);
        whatsappService.joinClientRoom(testId);
        
        return () => {
          socket.off(eventName, handleWebSocketStatus);
        };
      }
    }
  }, [qrData.status, testId]);

  const generateQR = async () => {
    try {
      setQrData(prev => ({ ...prev, loading: true, status: 'connecting' }));
      setLogs([]);
      
      addLog(`🚀 Conectando ${testId}...`);
      
      // 1. CONECTAR
      const response = await fetch(`https://146.59.227.248/clients/${testId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      addLog('✅ Comando connect enviado');
      
      // 2. VERIFICAÇÃO AGRESSIVA
      let attemptCount = 0;
      const aggressiveCheck = async () => {
        attemptCount++;
        setAttempts(attemptCount);
        addLog(`🔄 Verificação ${attemptCount}/50`);
        
        try {
          const statusResponse = await fetch(`https://146.59.227.248/clients/${testId}/status`, {
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            cache: 'no-cache'
          });
          
          if (statusResponse.ok) {
            const data = await statusResponse.json();
            addLog(`📊 Status: ${data.status}, Phone: ${data.phoneNumber || 'null'}, QR: ${data.hasQrCode}`);
            
            // DETECÇÃO SUPER AGRESSIVA
            if (data.phoneNumber && data.phoneNumber.trim().length > 5) {
              addLog('🎉 CONECTADO! Telefone detectado!');
              setQrData({
                status: 'connected',
                loading: false,
                qrCode: data.qrCode,
                phoneNumber: data.phoneNumber
              });
              return;
            }
            
            if (data.status === 'connected' || data.status === 'authenticated' || data.status === 'ready') {
              addLog('✅ CONECTADO! Status confirmado!');
              setQrData({
                status: 'connected',
                loading: false,
                qrCode: data.qrCode,
                phoneNumber: data.phoneNumber
              });
              return;
            }
            
            if (data.hasQrCode && data.qrCode) {
              addLog('📱 QR Code disponível - ativando WebSocket');
              setQrData({
                qrCode: data.qrCode,
                status: 'qr_ready',
                loading: false
              });
              
              // Continuar verificando por mais 2 minutos
              if (attemptCount < 50) {
                setTimeout(aggressiveCheck, 2500);
              }
              return;
            }
          }
          
          if (attemptCount < 20) {
            setTimeout(aggressiveCheck, 2500);
          } else {
            addLog('⏰ Timeout na verificação');
            setQrData(prev => ({ ...prev, loading: false, status: 'timeout' }));
          }
        } catch (error) {
          addLog(`❌ Erro: ${error}`);
          if (attemptCount < 20) {
            setTimeout(aggressiveCheck, 2500);
          } else {
            setQrData(prev => ({ ...prev, loading: false, status: 'error' }));
          }
        }
      };
      
      setTimeout(aggressiveCheck, 1500);
      
    } catch (error: any) {
      addLog(`❌ Erro fatal: ${error.message}`);
      setQrData({ status: 'error', loading: false });
    }
  };

  // Verificação ULTRA AGRESSIVA quando QR está escaneado
  useEffect(() => {
    if (qrData.status === 'qr_ready' && qrData.qrCode) {
      addLog('🚨 MODO ULTRA AGRESSIVO ATIVADO');
      
      // Verificação a cada 1 segundo por 5 minutos
      const ultraAggressiveCheck = setInterval(async () => {
        try {
          addLog('🔥 Verificação ULTRA AGRESSIVA...');
          
          const response = await fetch(`https://146.59.227.248/clients/${testId}/status`, {
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            mode: 'cors',
            cache: 'no-cache'
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // Log TODOS os dados recebidos
            addLog(`🔍 DADOS COMPLETOS: ${JSON.stringify(data)}`);
            
            // DETECÇÃO MÚLTIPLA CRITÉRIOS
            const hasPhone = data.phoneNumber && data.phoneNumber.trim().length > 5;
            const isConnected = data.status === 'connected' || data.status === 'authenticated' || data.status === 'ready';
            const hasSession = data.diagnostic?.hasWid || data.diagnostic?.hasInfo;
            
            if (hasPhone) {
              addLog('🎉 NÚMERO DETECTADO! Parando verificação...');
              setQrData({
                status: 'connected',
                loading: false,
                qrCode: data.qrCode,
                phoneNumber: data.phoneNumber
              });
              clearInterval(ultraAggressiveCheck);
              return;
            }
            
            if (isConnected) {
              addLog('✅ STATUS CONECTADO detectado!');
              setQrData({
                status: 'connected',
                loading: false,
                qrCode: data.qrCode,
                phoneNumber: data.phoneNumber || 'Conectado sem número'
              });
              clearInterval(ultraAggressiveCheck);
              return;
            }
            
            if (hasSession) {
              addLog('🔧 SESSÃO WhatsApp detectada no diagnóstico!');
              // Continuar verificando pois pode estar autenticando
            }
            
            addLog(`📊 Status: ${data.status}, Phone: ${data.phoneNumber || 'null'}, Diagnostic: ${JSON.stringify(data.diagnostic)}`);
          }
        } catch (error) {
          addLog(`❌ Erro verificação ultra: ${error}`);
        }
      }, 1000); // A cada 1 segundo!
      
      // Limpar após 5 minutos
      setTimeout(() => {
        addLog('⏰ Timeout verificação ultra agressiva');
        clearInterval(ultraAggressiveCheck);
      }, 300000);
      
      return () => {
        clearInterval(ultraAggressiveCheck);
      };
    }
  }, [qrData.status, qrData.qrCode, testId]);

  // Verificação manual forçada ULTRA
  const forceUltraCheck = async () => {
    addLog('🚨 VERIFICAÇÃO MANUAL ULTRA FORÇADA');
    
    try {
      // 1. Verificar status atual
      const statusResponse = await fetch(`https://146.59.227.248/clients/${testId}/status`, {
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        addLog(`📊 Status completo: ${JSON.stringify(statusData)}`);
        
        if (statusData.phoneNumber) {
          addLog('📞 NÚMERO ENCONTRADO na verificação manual!');
          setQrData({
            status: 'connected',
            loading: false,
            qrCode: statusData.qrCode,
            phoneNumber: statusData.phoneNumber
          });
          return;
        }
      }
      
      // 2. Forçar reconexão se necessário
      addLog('🔄 Tentando forçar reconexão...');
      const reconnectResponse = await fetch(`https://146.59.227.248/clients/${testId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });
      
      if (reconnectResponse.ok) {
        addLog('✅ Comando reconexão enviado');
        
        // Aguardar e verificar novamente
        setTimeout(async () => {
          const newStatusResponse = await fetch(`https://146.59.227.248/clients/${testId}/status`, {
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            cache: 'no-cache'
          });
          
          if (newStatusResponse.ok) {
            const newData = await newStatusResponse.json();
            addLog(`🔍 Após reconexão: ${JSON.stringify(newData)}`);
            
            if (newData.phoneNumber) {
              setQrData({
                status: 'connected',
                loading: false,
                qrCode: newData.qrCode,
                phoneNumber: newData.phoneNumber
              });
            }
          }
        }, 3000);
      }
      
    } catch (error) {
      addLog(`❌ Erro verificação ultra manual: ${error}`);
    }
  };

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

      {/* Logs em tempo real */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">📋 Logs em Tempo Real:</h4>
        <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))
          ) : (
            <div className="text-gray-500">Aguardando logs...</div>
          )}
        </div>
      </div>

      {qrData.phoneNumber && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800 font-medium">📞 Telefone Conectado:</p>
          <p className="text-green-600 text-sm font-mono">{qrData.phoneNumber}</p>
        </div>
      )}

      {qrData.status === 'connected' && (
        <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg text-center">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-green-800 font-bold text-xl">CONECTADO!</p>
          <p className="text-green-600">WhatsApp funcionando perfeitamente</p>
          {qrData.phoneNumber && (
            <p className="text-green-500 text-sm mt-2">Tel: {qrData.phoneNumber}</p>
          )}
        </div>
      )}

      {qrData.status === 'qr_ready' && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-center">
            <p className="text-blue-800 font-medium">📱 QR Code Escaneado</p>
            <p className="text-blue-600 text-sm">Verificação ULTRA AGRESSIVA ativa (1s)</p>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <Button 
              onClick={forceUltraCheck} 
              variant="destructive"
              size="sm"
              className="w-full"
            >
              🚨 FORÇA DETECÇÃO ULTRA
            </Button>
            
            <Button 
              onClick={() => {
                addLog('🔄 Reiniciando processo...');
                setQrData({ status: 'disconnected', loading: false });
                setLogs([]);
              }} 
              variant="outline"
              size="sm"
              className="w-full"
            >
              🔄 Reiniciar Processo
            </Button>
          </div>
        </div>
      )}

      {qrData.status === 'timeout' && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-center">
          <p className="text-yellow-800 font-medium">⏰ Timeout</p>
          <p className="text-yellow-600 text-sm">Use "FORÇA DETECÇÃO ULTRA" ou reinicie</p>
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