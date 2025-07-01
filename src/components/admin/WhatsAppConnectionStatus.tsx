
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Smartphone, 
  MessageSquare,
  Eye,
  Wifi
} from "lucide-react";
import { useWhatsAppConnectionDetector } from "@/hooks/useWhatsAppConnectionDetector";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppConnectionStatusProps {
  instanceId: string;
  onConnected?: (phoneNumber: string) => void;
  onOpenChat?: () => void;
  showQRCode?: boolean;
  qrCode?: string;
}

const WhatsAppConnectionStatus = ({ 
  instanceId, 
  onConnected, 
  onOpenChat,
  showQRCode = false,
  qrCode 
}: WhatsAppConnectionStatusProps) => {
  const [showDebug, setShowDebug] = useState(false);
  const { toast } = useToast();

  const { 
    isReallyConnected, 
    phoneNumber, 
    isChecking, 
    forceCheck 
  } = useWhatsAppConnectionDetector({
    instanceId,
    onConnectionDetected: (phone) => {
      console.log(`🎉 [STATUS] Conexão detectada: ${phone}`);
      if (onConnected) {
        onConnected(phone);
      }
    },
    onConnectionLost: () => {
      console.log(`❌ [STATUS] Conexão perdida`);
    }
  });

  const handleForceCheck = async () => {
    console.log(`🔄 [STATUS] Verificação forçada iniciada`);
    const result = await forceCheck();
    
    if (result.connected) {
      toast({
        title: "✅ Conexão Confirmada",
        description: `WhatsApp conectado: ${result.phone}`,
      });
    } else {
      toast({
        title: "❌ Não Conectado",
        description: "WhatsApp ainda não está conectado",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className={`${isReallyConnected ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isReallyConnected ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <Smartphone className="w-5 h-5 text-blue-600" />
            )}
            <CardTitle className={isReallyConnected ? 'text-green-800' : 'text-blue-800'}>
              {isReallyConnected ? 'WhatsApp Conectado!' : 'Aguardando Conexão'}
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            {isChecking && (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
            )}
            <Badge variant={isReallyConnected ? 'default' : 'secondary'}>
              {isReallyConnected ? 'Conectado' : 'Aguardando'}
            </Badge>
          </div>
        </div>
        <CardDescription>
          {isReallyConnected 
            ? `Conexão ativa detectada: ${phoneNumber}`
            : 'Sistema verificando conexão automaticamente a cada 3 segundos'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status Conectado */}
        {isReallyConnected && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="space-y-2">
                <p><strong>🎉 WhatsApp Realmente Conectado!</strong></p>
                <p>Telefone: {phoneNumber}</p>
                <p>Sistema detectou conexão ativa via verificação de chats.</p>
                <p>Você pode usar o chat normalmente!</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* QR Code Display */}
        {!isReallyConnected && showQRCode && qrCode && (
          <div className="text-center p-4 bg-white border rounded">
            <h4 className="font-medium mb-2 text-blue-600">📱 QR Code Disponível</h4>
            <img 
              src={qrCode} 
              alt="QR Code WhatsApp"
              className="mx-auto max-w-[200px] border rounded"
            />
            <p className="text-sm text-green-600 mt-2 font-medium">
              ✅ Escaneie com seu WhatsApp - Sistema detectará automaticamente!
            </p>
          </div>
        )}

        {/* Instruções */}
        {!isReallyConnected && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>📱 Como conectar:</strong></p>
                <p>1. Escaneie o QR Code com seu WhatsApp</p>
                <p>2. O sistema detectará automaticamente a conexão</p>
                <p>3. Aguarde a confirmação aparecer aqui</p>
                <p><strong>Não feche esta tela!</strong> O sistema está monitorando.</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Botões de Ação */}
        <div className="flex space-x-2 flex-wrap gap-2">
          {isReallyConnected ? (
            <Button 
              onClick={onOpenChat}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Ir para Chat
            </Button>
          ) : (
            <Button 
              onClick={handleForceCheck}
              disabled={isChecking}
              variant="outline"
              className="border-blue-300"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 mr-1" />
                  Verificar Conexão
                </>
              )}
            </Button>
          )}
          
          <Button 
            onClick={() => setShowDebug(!showDebug)}
            variant="outline"
            size="sm"
          >
            <Eye className="w-4 h-4 mr-1" />
            {showDebug ? 'Ocultar' : 'Mostrar'} Debug
          </Button>
        </div>

        {/* Debug Info */}
        {showDebug && (
          <div className="p-3 bg-gray-100 rounded text-xs font-mono">
            <div className="space-y-1">
              <div>Instance ID: <strong>{instanceId}</strong></div>
              <div>Really Connected: <strong>{isReallyConnected ? 'SIM' : 'NÃO'}</strong></div>
              <div>Phone Number: <strong>{phoneNumber || 'N/A'}</strong></div>
              <div>Is Checking: <strong>{isChecking ? 'SIM' : 'NÃO'}</strong></div>
              <div>QR Available: <strong>{qrCode ? 'SIM' : 'NÃO'}</strong></div>
            </div>
          </div>
        )}

        {/* Mensagem de Encorajamento */}
        {!isReallyConnected && (
          <div className="text-center text-sm text-gray-600 bg-blue-50 p-3 rounded">
            <p className="font-medium text-blue-800">🔄 Sistema Inteligente Ativo</p>
            <p>Não se preocupe! O sistema está verificando a conexão automaticamente.</p>
            <p>Assim que você escanear o QR, a conexão será detectada imediatamente!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnectionStatus;
