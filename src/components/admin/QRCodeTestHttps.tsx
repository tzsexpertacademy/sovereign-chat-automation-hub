
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Activity, CheckCircle } from "lucide-react";
import whatsappService from "@/services/whatsappMultiClient";

const QRCodeTestHttps = () => {
  const [qrData, setQrData] = useState<{
    qrCode?: string;
    status: string;
    loading: boolean;
    phoneNumber?: string;
  }>({
    status: 'disconnected',
    loading: false
  });
  
  // ID FIXO para debug - mesmo do Supabase
  const [testId] = useState('35f36a03-39b2-412c-bba6-01fdd45c2dd3');
  const [logs, setLogs] = useState<string[]>([]);
  const [connectionTest, setConnectionTest] = useState<{status: string, message: string} | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-7), logMessage]);
    console.log(logMessage);
  };

  // Testar conexão HTTPS primeiro
  const testHttpsConnection = async () => {
    try {
      addLog('🧪 Testando conexão HTTPS...');
      const result = await whatsappService.testConnection();
      setConnectionTest({
        status: result.success ? 'success' : 'error', // Corrigido aqui
        message: result.message
      });
      
      if (result.success) {
        addLog('✅ Conexão HTTPS funcionando!');
      } else {
        addLog(`❌ Problema HTTPS: ${result.message}`);
      }
    } catch (error) {
      addLog(`❌ Erro teste HTTPS: ${error}`);
      setConnectionTest({ status: 'error', message: 'Falha no teste' });
    }
  };

  // WebSocket listener para ID fixo
  useEffect(() => {
    if (qrData.status === 'qr_ready') {
      addLog('🎧 Ativando WebSocket HTTPS listener...');
      
      const socket = whatsappService.getSocket();
      if (socket) {
        const eventName = `client_status_${testId}`;
        
        const handleWebSocketStatus = (data: any) => {
          addLog(`📡 WebSocket HTTPS evento: ${JSON.stringify(data)}`);
          
          if (data.phoneNumber && data.phoneNumber.length > 0) {
            addLog('🎉 TELEFONE DETECTADO via WebSocket HTTPS!');
            setQrData({
              status: 'connected',
              loading: false,
              phoneNumber: data.phoneNumber
            });
          } else if (data.status === 'connected') {
            addLog('✅ CONECTADO via WebSocket HTTPS!');
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

  // Gerar QR Code HTTPS
  const generateQR = async () => {
    try {
      setQrData(prev => ({ ...prev, loading: true, status: 'connecting' }));
      setLogs([]);
      
      addLog(`🚀 Conectando HTTPS ${testId}...`);
      
      // 1. Conectar via HTTPS
      await whatsappService.connectClient(testId);
      addLog('✅ Comando connect HTTPS enviado');
      
      // 2. Verificação espaçada
      let attemptCount = 0;
      const checkStatus = async () => {
        attemptCount++;
        addLog(`🔄 Verificação HTTPS ${attemptCount}/20`);
        
        try {
          const status = await whatsappService.getClientStatus(testId);
          addLog(`📊 Status HTTPS: ${status.status}, Phone: ${status.phoneNumber || 'null'}, QR: ${status.hasQrCode}`);
          
          if (status.phoneNumber && status.phoneNumber.trim().length > 5) {
            addLog('🎉 CONECTADO HTTPS! Telefone detectado!');
            setQrData({
              status: 'connected',
              loading: false,
              qrCode: status.qrCode,
              phoneNumber: status.phoneNumber
            });
            return;
          }
          
          if (status.status === 'connected') {
            addLog('✅ CONECTADO HTTPS! Status confirmado!');
            setQrData({
              status: 'connected',
              loading: false,
              qrCode: status.qrCode,
              phoneNumber: status.phoneNumber
            });
            return;
          }
          
          if (status.hasQrCode && status.qrCode) {
            addLog('📱 QR Code HTTPS disponível');
            setQrData({
              qrCode: status.qrCode,
              status: 'qr_ready',
              loading: false
            });
            
            // Continuar verificando
            if (attemptCount < 20) {
              setTimeout(checkStatus, 4000);
            }
            return;
          }
          
          if (attemptCount < 20) {
            setTimeout(checkStatus, 4000);
          } else {
            addLog('⏰ Timeout HTTPS na verificação');
            setQrData(prev => ({ ...prev, loading: false, status: 'timeout' }));
          }
        } catch (error) {
          addLog(`❌ Erro HTTPS: ${error}`);
          if (attemptCount < 20) {
            setTimeout(checkStatus, 4000);
          } else {
            setQrData(prev => ({ ...prev, loading: false, status: 'error' }));
          }
        }
      };
      
      setTimeout(checkStatus, 2000);
      
    } catch (error: any) {
      addLog(`❌ Erro fatal HTTPS: ${error.message}`);
      setQrData({ status: 'error', loading: false });
    }
  };

  // Inicializar teste de conexão
  useEffect(() => {
    testHttpsConnection();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="w-5 h-5" />
          <span>Teste QR Code HTTPS - ID Fixo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status Conexão HTTPS */}
        {connectionTest && (
          <div className={`p-3 rounded border ${
            connectionTest.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              {connectionTest.status === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <RefreshCw className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                Status HTTPS: {connectionTest.status === 'success' ? 'OK' : 'ERRO'} {/* Corrigido aqui */}
              </span>
            </div>
            <p className="text-xs mt-1">{connectionTest.message}</p>
          </div>
        )}
        
        {/* Info do Teste */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <span className="text-sm font-medium">Test ID Fixo:</span>
          <code className="text-xs bg-white px-2 py-1 rounded">{testId}</code>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <span className="text-sm font-medium">Status HTTPS:</span>
          <Badge variant={qrData.status === 'connected' ? 'default' : 'secondary'}>
            {qrData.status}
          </Badge>
        </div>

        {/* QR Code */}
        {qrData.qrCode && (
          <div className="text-center space-y-2">
            <div className="p-4 bg-white border-2 border-dashed border-green-300 rounded-lg">
              <img 
                src={qrData.qrCode} 
                alt="QR Code HTTPS" 
                className="max-w-xs mx-auto"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <p className="text-xs text-green-600 font-medium">
              ✅ QR Code HTTPS Disponível! Escaneie com WhatsApp
            </p>
          </div>
        )}

        {/* Logs HTTPS */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">📋 Logs HTTPS:</h4>
          <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))
            ) : (
              <div className="text-gray-500">Aguardando logs HTTPS...</div>
            )}
          </div>
        </div>

        {/* Status Conectado */}
        {qrData.phoneNumber && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-medium">📞 Telefone HTTPS Conectado:</p>
            <p className="text-green-600 text-sm font-mono">{qrData.phoneNumber}</p>
          </div>
        )}

        {/* Sucesso */}
        {qrData.status === 'connected' && (
          <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-green-800 font-bold text-xl">CONECTADO HTTPS!</p>
            <p className="text-green-600">WhatsApp funcionando via HTTPS</p>
          </div>
        )}

        {/* Botões */}
        <div className="space-y-2">
          <Button 
            onClick={generateQR} 
            disabled={qrData.loading || connectionTest?.status !== 'success'}
            className="w-full"
            variant={qrData.status === 'connected' ? 'secondary' : 'default'}
          >
            {qrData.loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Conectando HTTPS...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                {qrData.status === 'connected' ? 'Reconectar HTTPS' : 'Gerar QR Code HTTPS'}
              </>
            )}
          </Button>
          
          <Button 
            onClick={testHttpsConnection} 
            variant="outline"
            size="sm"
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Testar Conexão HTTPS
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QRCodeTestHttps;
