
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";

const QRCodeDebugger = () => {
  const { toast } = useToast();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testInstanceId] = useState("debug-test-instance");
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [instanceStatus, setInstanceStatus] = useState<string>('disconnected');
  const [socketConnecting, setSocketConnecting] = useState(false);

  useEffect(() => {
    console.log('🔍 Iniciando QR Code Debugger - Socket.IO CORRIGIDO');
    connectToSocket();
    
    return () => {
      console.log('🧹 Limpando QR Code Debugger');
      if (whatsappService.getSocket()) {
        whatsappService.offClientStatus(testInstanceId);
      }
    };
  }, [testInstanceId, toast]);

  const connectToSocket = () => {
    try {
      setSocketConnecting(true);
      console.log('🔌 Conectando ao Socket.IO corrigido...');
      
      const socket = whatsappService.connectSocket();
      
      if (socket) {
        socket.on('connect', () => {
          console.log('✅ Socket.IO conectado com sucesso!');
          setWebsocketConnected(true);
          setSocketConnecting(false);
          
          toast({
            title: "Socket.IO Conectado!",
            description: "WebSocket funcionando perfeitamente",
          });
          
          // Entrar na sala da instância de teste
          whatsappService.joinClientRoom(testInstanceId);
        });

        socket.on('disconnect', (reason) => {
          console.log('❌ Socket.IO desconectado:', reason);
          setWebsocketConnected(false);
        });

        socket.on('connect_error', (error) => {
          console.error('❌ Erro de conexão Socket.IO:', error);
          setWebsocketConnected(false);
          setSocketConnecting(false);
          
          toast({
            title: "Erro Socket.IO",
            description: `Falha na conexão: ${error.message}`,
            variant: "destructive",
          });
        });

        // Escutar status da instância de teste
        whatsappService.onClientStatus(testInstanceId, (clientData) => {
          console.log('📱 Status recebido via Socket.IO:', clientData);
          setInstanceStatus(clientData.status);
          
          if (clientData.hasQrCode && clientData.qrCode) {
            console.log('🎉 QR Code recebido via Socket.IO!');
            setQrCodeData(clientData.qrCode);
            toast({
              title: "QR Code Gerado!",
              description: "QR Code recebido via Socket.IO em tempo real",
            });
          }

          if (clientData.status === 'connected') {
            toast({
              title: "WhatsApp Conectado!",
              description: `Instância ${testInstanceId} conectada com sucesso`,
            });
          }
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao configurar Socket.IO:', error);
      setSocketConnecting(false);
      toast({
        title: "Erro Socket.IO",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      console.log('🔍 Executando diagnóstico Socket.IO...');
      
      const diagnostics = {
        timestamp: new Date().toISOString(),
        websocket: null,
        serverHealth: null,
        instanceStatus: null,
        socketioHandshake: null,
        errors: []
      };

      // 1. Testar saúde do servidor
      try {
        console.log('🔍 Testando health check...');
        const health = await whatsappService.checkServerHealth();
        diagnostics.serverHealth = health;
        console.log('✅ Servidor saudável:', health);
      } catch (error: any) {
        console.error('❌ Erro na saúde do servidor:', error);
        diagnostics.errors.push(`Server Health: ${error.message}`);
      }

      // 2. Testar Socket.IO diretamente
      try {
        console.log('🔍 Testando Socket.IO handshake...');
        const response = await fetch('https://146.59.227.248/socket.io/?EIO=4&transport=polling', {
          method: 'GET',
          mode: 'cors'
        });
        
        diagnostics.socketioHandshake = {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        };
        
        if (response.ok) {
          console.log('✅ Socket.IO handshake funcionando!');
        } else {
          console.error('❌ Socket.IO handshake falhando:', response.status);
          diagnostics.errors.push(`Socket.IO Handshake: ${response.status} ${response.statusText}`);
        }
      } catch (error: any) {
        console.error('❌ Erro no handshake Socket.IO:', error);
        diagnostics.errors.push(`Socket.IO Handshake: ${error.message}`);
      }

      // 3. Testar WebSocket
      try {
        console.log('🔍 Testando WebSocket status...');
        const socket = whatsappService.getSocket();
        diagnostics.websocket = {
          connected: socket?.connected || false,
          transport: socket?.io?.engine?.transport?.name || 'unknown',
          url: 'wss://146.59.227.248/socket.io/',
          realTimeStatus: websocketConnected,
          id: socket?.id || null
        };
        console.log('🔌 WebSocket info:', diagnostics.websocket);
      } catch (error: any) {
        console.error('❌ Erro no WebSocket:', error);
        diagnostics.errors.push(`WebSocket: ${error.message}`);
      }

      // 4. Testar status da instância
      try {
        console.log('🔍 Testando status da instância...');
        const status = await whatsappService.getClientStatus(testInstanceId);
        diagnostics.instanceStatus = status;
        console.log('📱 Status da instância:', status);
        
        if (status.hasQrCode && status.qrCode) {
          setQrCodeData(status.qrCode);
          console.log('📱 QR Code encontrado no status!');
        }
      } catch (error: any) {
        console.error('❌ Erro no status da instância:', error);
        diagnostics.errors.push(`Instance Status: ${error.message}`);
      }

      setDebugInfo(diagnostics);
      
      if (diagnostics.errors.length === 0) {
        toast({
          title: "Diagnóstico Socket.IO Concluído",
          description: qrCodeData ? "QR Code disponível!" : "Sistema funcionando, teste geração QR...",
        });
      } else {
        toast({
          title: "Problemas Socket.IO Encontrados",
          description: `${diagnostics.errors.length} erro(s) detectado(s)`,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('❌ Erro geral no diagnóstico:', error);
      toast({
        title: "Erro no Diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async () => {
    try {
      setLoading(true);
      console.log('🚀 Gerando QR Code via Socket.IO...');
      
      // Limpar QR anterior
      setQrCodeData(null);
      
      await whatsappService.connectClient(testInstanceId);
      
      toast({
        title: "Gerando QR Code",
        description: "Aguarde... QR Code será exibido automaticamente via Socket.IO",
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao gerar QR:', error);
      toast({
        title: "Erro na Geração QR",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (condition: boolean) => {
    return condition ? (
      <Badge className="bg-green-500">
        <CheckCircle className="w-3 h-3 mr-1" />
        OK
      </Badge>
    ) : (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Erro
      </Badge>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      case 'disconnected': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2 text-blue-500" />
            Socket.IO QR Code Debugger
            {socketConnecting ? (
              <RefreshCw className="w-4 h-4 ml-2 animate-spin text-blue-500" />
            ) : websocketConnected ? (
              <Wifi className="w-4 h-4 ml-2 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 ml-2 text-red-500" />
            )}
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              onClick={runDiagnostics}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Diagnosticar
            </Button>
            <Button
              size="sm"
              onClick={generateQRCode}
              disabled={loading || !websocketConnected}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              Gerar QR
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Socket.IO Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <div className="flex items-center space-x-2">
            {socketConnecting ? (
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            ) : websocketConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              Socket.IO: {socketConnecting ? 'Conectando...' : websocketConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <Badge className={getStatusColor(instanceStatus)}>
            Status: {instanceStatus}
          </Badge>
        </div>

        {/* QR Code Display */}
        {qrCodeData && (
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2 text-green-600">🎉 QR Code Via Socket.IO!</h3>
              <div className="bg-white p-4 rounded border-2 border-green-300">
                <img 
                  src={qrCodeData} 
                  alt="QR Code WhatsApp"
                  className="mx-auto max-w-xs"
                />
              </div>
              <p className="text-sm text-green-600 mt-2 font-medium">
                ✅ QR Code recebido via Socket.IO em tempo real - FUNCIONANDO!
              </p>
            </div>
          </div>
        )}

        {!debugInfo && !qrCodeData && (
          <div className="text-center py-8">
            <Zap className="w-16 h-16 mx-auto mb-4 text-blue-400" />
            <h3 className="text-lg font-medium mb-2">Socket.IO QR Code Tester</h3>
            <p className="text-gray-600 mb-4">
              Teste o sistema Socket.IO corrigido para geração de QR Codes
            </p>
            <p className="text-sm text-gray-500">
              Clique em "Gerar QR" para testar o fluxo completo via Socket.IO
            </p>
          </div>
        )}

        {debugInfo && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Servidor:</span>
                {getStatusBadge(debugInfo.serverHealth?.status === 'ok')}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Socket.IO:</span>
                {getStatusBadge(debugInfo.websocket?.connected && websocketConnected)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Handshake:</span>
                {getStatusBadge(debugInfo.socketioHandshake?.ok)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">QR Code:</span>
                {getStatusBadge(!!qrCodeData)}
              </div>
            </div>

            {debugInfo.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-800 mb-2">Erros Socket.IO:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {debugInfo.errors.map((error: string, index: number) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {showDebug && (
              <div className="bg-gray-50 border rounded p-3">
                <h4 className="font-medium mb-2">Debug Socket.IO:</h4>
                <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        {websocketConnected && qrCodeData && (
          <div className="bg-green-50 border-2 border-green-200 rounded p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-800">Socket.IO Funcionando Perfeitamente!</p>
                <p className="text-sm text-green-700">
                  WebSocket conectado ✅ | QR Code gerado ✅ | Tempo real ✅
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QRCodeDebugger;
