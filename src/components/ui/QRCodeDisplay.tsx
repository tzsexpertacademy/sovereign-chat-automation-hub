
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, QrCode, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRCodeDisplayProps {
  qrCode: string;
  instanceName: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  autoRefreshInterval?: number;
  showInstructions?: boolean;
}

export const QRCodeDisplay = ({ 
  qrCode, 
  instanceName, 
  onRefresh, 
  refreshing = false, 
  autoRefreshInterval = 60000,
  showInstructions = true 
}: QRCodeDisplayProps) => {
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutos
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!autoRefreshInterval) return;

    const countdown = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onRefresh?.();
          return 180; // Reset
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [autoRefreshInterval, onRefresh]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      toast({
        title: "QR Code copiado!",
        description: "O código foi copiado para a área de transferência",
      });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o QR Code",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="text-center space-y-4">
      <div className="flex items-center justify-center space-x-2">
        <QrCode className="w-5 h-5 text-blue-600" />
        <h4 className="font-medium text-blue-900">
          QR Code para {instanceName}
        </h4>
      </div>
      
      <div className="bg-white p-4 rounded-lg border-2 border-blue-200 inline-block">
        <img 
          src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} 
          alt={`QR Code WhatsApp - ${instanceName}`}
          className="max-w-[200px] mx-auto block"
        />
      </div>
      
      {showInstructions && (
        <div className="space-y-2">
          <p className="text-sm text-blue-700 font-medium">
            📱 Como conectar:
          </p>
          <ol className="text-xs text-blue-600 space-y-1 text-left max-w-md mx-auto">
            <li>1. Abra o WhatsApp no seu celular</li>
            <li>2. Toque em "Mais opções" (⋮) ou "Configurações"</li>
            <li>3. Toque em "Aparelhos conectados"</li>
            <li>4. Toque em "Conectar um aparelho"</li>
            <li>5. Escaneie este QR Code</li>
          </ol>
        </div>
      )}
      
      <div className="flex items-center justify-center space-x-2 text-sm">
        <div className="text-blue-600">
          ⏰ Expira em: {formatTime(timeLeft)}
        </div>
        
        <div className="flex space-x-1">
          <Button
            size="sm"
            variant="outline"
            onClick={copyToClipboard}
            className="h-8 px-2"
          >
            {copied ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-8 px-2"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
        ✅ Sistema integrado com YUMER - QR Code gerado automaticamente
      </div>
    </div>
  );
};
