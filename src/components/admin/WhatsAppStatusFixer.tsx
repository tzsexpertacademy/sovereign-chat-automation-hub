
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Wrench, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Timer,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppStatusMonitor } from "@/hooks/useWhatsAppStatusMonitor";

interface WhatsAppStatusFixerProps {
  instanceId: string;
  onStatusChange?: (status: any) => void;
}

const WhatsAppStatusFixer = ({ instanceId, onStatusChange }: WhatsAppStatusFixerProps) => {
  const [autoFix, setAutoFix] = useState(false);
  const { toast } = useToast();

  const { 
    status, 
    isMonitoring, 
    error, 
    startMonitoring, 
    stopMonitoring, 
    forceReconnect 
  } = useWhatsAppStatusMonitor({
    instanceId,
    pollInterval: 5000,
    maxRetries: 3,
    qrTimeout: 60000 // 1 minuto
  });

  const handleAutoFix = () => {
    if (autoFix) {
      stopMonitoring();
      setAutoFix(false);
      toast({
        title: "Auto-fix Desativado",
        description: "Monitoramento automático parado",
      });
    } else {
      startMonitoring();
      setAutoFix(true);
      toast({
        title: "Auto-fix Ativado",
        description: "Sistema irá detectar e corrigir problemas automaticamente",
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'authenticated': return 'Autenticado';
      default: return 'Desconhecido';
    }
  };

  // Notificar mudanças de status
  if (status && onStatusChange) {
    onStatusChange(status);
  }

  const isConnected = status?.status === 'connected' && status?.phoneNumber;
  const isStuck = status?.isStuck;
  const hasIssues = error || isStuck;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wrench className="w-5 h-5" />
            <CardTitle>Status Fixer</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            {isMonitoring && (
              <Badge variant="secondary" className="animate-pulse">
                <Timer className="w-3 h-3 mr-1" />
                Monitorando
              </Badge>
            )}
            {status && (
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(status.status)}`} />
                <span className="text-sm">{getStatusText(status.status)}</span>
              </div>
            )}
          </div>
        </div>
        <CardDescription>
          Ferramenta automática para detectar e corrigir problemas de status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status Display */}
        {status && (
          <div className="p-3 bg-gray-50 rounded">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Status: <strong>{status.status}</strong></div>
              <div>Telefone: <strong>{status.phoneNumber || 'N/A'}</strong></div>
              <div>QR Disponível: <strong>{status.hasQrCode ? 'SIM' : 'NÃO'}</strong></div>
              <div>Tentativas: <strong>{status.retryCount}</strong></div>
              <div>Última Mudança: <strong>{status.lastChange.toLocaleTimeString()}</strong></div>
              <div>Travado: <strong>{status.isStuck ? 'SIM' : 'NÃO'}</strong></div>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {isConnected && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>✅ WhatsApp Conectado com Sucesso!</strong><br />
              Telefone: {status?.phoneNumber}<br />
              O sistema está funcionando corretamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Issues Alert */}
        {hasIssues && !isConnected && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>⚠️ Problema Detectado:</strong></p>
                {isStuck && (
                  <p>• Instância travada em "{status?.status}" há muito tempo</p>
                )}
                {error && (
                  <p>• Erro: {error}</p>
                )}
                <p><strong>Solução:</strong> Ative o "Auto-fix" ou use "Forçar Correção"</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Erro:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Control Buttons */}
        <div className="flex space-x-2 flex-wrap gap-2">
          <Button 
            onClick={handleAutoFix}
            variant={autoFix ? "default" : "outline"}
            className={autoFix ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {autoFix ? (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                Auto-fix Ativo
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-1" />
                Ativar Auto-fix
              </>
            )}
          </Button>
          
          <Button 
            onClick={forceReconnect}
            variant="outline"
            disabled={isMonitoring}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Forçar Correção
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Como funciona o Auto-fix:</strong></p>
          <p>• Monitora o status a cada 5 segundos</p>
          <p>• Detecta quando fica preso em "qr_ready"</p>
          <p>• Limpa sessão automaticamente e gera novo QR</p>
          <p>• Para automaticamente quando conecta</p>
          <p>• Máximo de 3 tentativas de reconexão</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppStatusFixer;
