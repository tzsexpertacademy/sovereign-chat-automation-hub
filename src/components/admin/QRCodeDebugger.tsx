
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
  EyeOff 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";

const QRCodeDebugger = () => {
  const { toast } = useToast();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testInstanceId] = useState("35f36a03-39b2-412c-bba6-01fdd45c2dd3");

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      console.log('🔍 Iniciando diagnóstico do QR Code...');
      
      const diagnostics = {
        timestamp: new Date().toISOString(),
        websocket: null,
        serverHealth: null,
        instanceStatus: null,
        connectionTest: null,
        errors: []
      };

      // 1. Testar saúde do servidor
      try {
        console.log('🔍 Testando saúde do servidor...');
        const health = await whatsappService.checkServerHealth();
        diagnostics.serverHealth = health;
        console.log('✅ Servidor saudável:', health);
      } catch (error: any) {
        console.error('❌ Erro na saúde do servidor:', error);
        diagnostics.errors.push(`Server Health: ${error.message}`);
      }

      // 2. Testar WebSocket
      try {
        console.log('🔍 Testando WebSocket...');
        const socket = whatsappService.connectSocket();
        diagnostics.websocket = {
          connected: socket?.connected || false,
          transport: socket?.io?.engine?.transport?.name || 'unknown',
          url: socket?.io?.uri || 'unknown'
        };
        console.log('🔌 WebSocket info:', diagnostics.websocket);
      } catch (error: any) {
        console.error('❌ Erro no WebSocket:', error);
        diagnostics.errors.push(`WebSocket: ${error.message}`);
      }

      // 3. Testar status da instância
      try {
        console.log('🔍 Testando status da instância...');
        const status = await whatsappService.getClientStatus(testInstanceId);
        diagnostics.instanceStatus = status;
        console.log('📱 Status da instância:', status);
      } catch (error: any) {
        console.error('❌ Erro no status da instância:', error);
        diagnostics.errors.push(`Instance Status: ${error.message}`);
      }

      // 4. Testar conexão da instância
      try {
        console.log('🔍 Testando conexão da instância...');
        const connection = await whatsappService.connectClient(testInstanceId);
        diagnostics.connectionTest = connection;
        console.log('🔗 Resultado da conexão:', connection);
      } catch (error: any) {
        console.error('❌ Erro na conexão da instância:', error);
        diagnostics.errors.push(`Connection Test: ${error.message}`);
      }

      setDebugInfo(diagnostics);
      
      if (diagnostics.errors.length === 0) {
        toast({
          title: "Diagnóstico Concluído",
          description: "Sistema funcionando corretamente!",
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

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            Diagnóstico QR Code
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!debugInfo && (
          <div className="text-center py-4">
            <QrCode className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600">Clique em "Diagnosticar" para verificar o QR Code</p>
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
                {getStatusBadge(debugInfo.websocket?.connected)}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Instância:</span>
                {getStatusBadge(debugInfo.instanceStatus?.status === 'qr_ready' || 
                                debugInfo.instanceStatus?.status === 'connected')}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Conexão:</span>
                {getStatusBadge(debugInfo.connectionTest?.success !== false)}
              </div>
            </div>

            {debugInfo.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-800 mb-2">Erros Encontrados:</h4>
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
      </CardContent>
    </Card>
  );
};

export default QRCodeDebugger;
