
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QrCode, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { useInstanceManager } from "@/hooks/useInstanceManager";
import { useToast } from "@/hooks/use-toast";

const QRCodeDebugger = () => {
  const [testInstanceId] = useState("35f36a03-39b2-412c-bba6-01fdd45c2dd3");
  const { connectInstance, getInstanceStatus, isLoading, websocketConnected } = useInstanceManager();
  const { toast } = useToast();

  const instanceStatus = getInstanceStatus(testInstanceId);
  const loading = isLoading(testInstanceId);

  const handleGenerateQR = async () => {
    try {
      console.log('🔍 Iniciando geração de QR Code...');
      
      if (!websocketConnected) {
        toast({
          title: "WebSocket Desconectado",
          description: "Conectando ao WebSocket primeiro...",
          variant: "destructive",
        });
        return;
      }

      await connectInstance(testInstanceId);
      
      toast({
        title: "QR Code Solicitado",
        description: "Aguarde alguns segundos para o QR Code aparecer",
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao gerar QR:', error);
      toast({
        title: "Erro ao Gerar QR",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = () => {
    switch (instanceStatus.status) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-blue-600';
      case 'qr_ready': return 'text-orange-600';
      case 'disconnected': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (instanceStatus.status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'qr_ready': return <QrCode className="w-4 h-4 text-orange-500" />;
      default: return <XCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <QrCode className="w-5 h-5" />
          <span>Diagnóstico QR Code</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* WebSocket Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <span className="text-sm font-medium">WebSocket:</span>
          <div className="flex items-center space-x-2">
            {websocketConnected ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm ${websocketConnected ? 'text-green-600' : 'text-red-600'}`}>
              {websocketConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Instance Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <span className="text-sm font-medium">Status da Instância:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className={`text-sm ${getStatusColor()}`}>
              {instanceStatus.status}
            </span>
          </div>
        </div>

        {/* QR Code Display */}
        {instanceStatus.hasQrCode && instanceStatus.qrCode && (
          <div className="text-center space-y-4">
            <Alert>
              <QrCode className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">QR Code Disponível!</p>
                <p className="text-sm">Escaneie com o WhatsApp do seu celular</p>
              </AlertDescription>
            </Alert>
            
            <div className="flex justify-center p-4 bg-white border-2 border-dashed border-gray-300 rounded-lg">
              <img 
                src={instanceStatus.qrCode} 
                alt="QR Code WhatsApp" 
                className="max-w-xs max-h-xs"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            
            <p className="text-xs text-gray-500">
              QR Code gerado em: {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}

        {/* No QR Code */}
        {instanceStatus.status === 'connected' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium text-green-800">WhatsApp Conectado!</p>
              <p className="text-sm text-green-600">
                Instância já está conectada e funcionando
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Generate QR Button */}
        <div className="flex justify-center">
          <Button 
            onClick={handleGenerateQR} 
            disabled={loading || !websocketConnected}
            className="w-full max-w-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Gerando QR Code...
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4 mr-2" />
                Gerar QR Code
              </>
            )}
          </Button>
        </div>

        {/* Debug Info */}
        <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-2 rounded">
          <p><strong>Instance ID:</strong> {testInstanceId}</p>
          <p><strong>Status:</strong> {instanceStatus.status}</p>
          <p><strong>Tem QR:</strong> {instanceStatus.hasQrCode ? 'Sim' : 'Não'}</p>
          <p><strong>Telefone:</strong> {instanceStatus.phoneNumber || 'N/A'}</p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-3 rounded text-sm">
          <p className="font-medium text-blue-900">📋 Como usar:</p>
          <ol className="text-blue-800 mt-1 space-y-1 list-decimal list-inside text-xs">
            <li>Certifique-se que WebSocket está conectado</li>
            <li>Clique em "Gerar QR Code"</li>
            <li>Aguarde o QR Code aparecer (pode demorar 10-30 segundos)</li>
            <li>Escaneie com WhatsApp do celular</li>
            <li>Status mudará para "connected" quando funcionar</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default QRCodeDebugger;
