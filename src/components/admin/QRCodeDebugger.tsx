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
import { useGlobalInstanceManager } from "@/contexts/InstanceManagerContext";

const QRCodeDebugger = () => {
  const { toast } = useToast();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testInstanceId] = useState("debug-test-instance");
  
  // Usar contexto global para sincronização
  const { 
    globalInstanceStatus,
    connectGlobalInstance,
    websocketConnected,
    refreshInstanceStatus
  } = useGlobalInstanceManager();
  
  // Status e QR da instância debug do contexto global
  const debugStatus = globalInstanceStatus[testInstanceId] || { 
    status: 'disconnected', 
    hasQrCode: false, 
    qrCode: null 
  };

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      console.log('🔍 [DEBUGGER] Executando diagnóstico...');
      
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
      } catch (error: any) {
        console.error('❌ Erro no status da instância:', error);
        diagnostics.errors.push(`Instance Status: ${error.message}`);
      }

      setDebugInfo(diagnostics);
      refreshInstanceStatus(testInstanceId);
      
      if (diagnostics.errors.length === 0) {
        toast({
          title: "Diagnóstico Concluído",
          description: debugStatus.hasQrCode ? "QR Code disponível!" : "Sistema funcionando",
        });
      } else {
        toast({
          title: "Problemas Encontrados",
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
      console.log('🚀 [DEBUGGER] Gerando QR Code via contexto global...');
      
      await connectGlobalInstance(testInstanceId);
      
      toast({
        title: "Conectando Instância",
        description: "Gerando QR Code via sistema global sincronizado",
      });
      
    } catch (error: any) {
      console.error('❌ [DEBUGGER] Erro ao gerar QR:', error);
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
            QR Code Debugger - Sincronizado
            {websocketConnected ? (
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
        {/* Status Sincronizado */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <div className="flex items-center space-x-2">
            {websocketConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              WebSocket: {websocketConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <Badge className={getStatusColor(debugStatus.status)}>
            Status: {debugStatus.status}
          </Badge>
        </div>

        {/* QR Code Display Global */}
        {debugStatus.hasQrCode && debugStatus.qrCode && (
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2 text-green-600">🎉 QR Code Sincronizado!</h3>
              <div className="bg-white p-4 rounded border-2 border-green-300">
                <img 
                  src={debugStatus.qrCode} 
                  alt="QR Code WhatsApp"
                  className="mx-auto max-w-xs"
                />
              </div>
              <p className="text-sm text-green-600 mt-2 font-medium">
                ✅ QR Code do contexto global - Funcionando em todos os componentes!
              </p>
            </div>
          </div>
        )}

        {!debugInfo && !debugStatus.hasQrCode && (
          <div className="text-center py-8">
            <Zap className="w-16 h-16 mx-auto mb-4 text-blue-400" />
            <h3 className="text-lg font-medium mb-2">QR Code Tester Sincronizado</h3>
            <p className="text-gray-600 mb-4">
              Sistema com sincronização global entre todos os componentes
            </p>
            <p className="text-sm text-gray-500">
              Teste qualquer instância - aparecerá em todos os painéis
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
                <span className="text-sm">WebSocket:</span>
                {getStatusBadge(debugInfo.websocket?.connected && websocketConnected)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Handshake:</span>
                {getStatusBadge(debugInfo.socketioHandshake?.ok)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">QR Code:</span>
                {getStatusBadge(!!debugStatus.hasQrCode)}
              </div>
            </div>

            {debugInfo.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-800 mb-2">Erros Detectados:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {debugInfo.errors.map((error: string, index: number) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {showDebug && (
              <div className="bg-gray-50 border rounded p-3">
                <h4 className="font-medium mb-2">Debug Info:</h4>
                <pre className="text-xs text-gray-700 overflow-auto max-h-40">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        {websocketConnected && debugStatus.hasQrCode && (
          <div className="bg-green-50 border-2 border-green-200 rounded p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-800">Sistema Sincronizado Funcionando!</p>
                <p className="text-sm text-green-700">
                  QR aparece em todos os componentes ✅ | Contexto global ativo ✅
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