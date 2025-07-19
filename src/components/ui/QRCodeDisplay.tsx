
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  QrCode, 
  RefreshCw, 
  CheckCircle, 
  Clock,
  Smartphone,
  Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeDisplayProps {
  qrCode: string;
  instanceName: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  autoRefreshInterval?: number;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  qrCode,
  instanceName,
  onRefresh,
  refreshing = false,
  autoRefreshInterval = 30000
}) => {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(autoRefreshInterval / 1000);

  useEffect(() => {
    if (!autoRefreshInterval || !onRefresh) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onRefresh();
          return autoRefreshInterval / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshInterval, onRefresh]);

  const handleCopyQRData = () => {
    navigator.clipboard.writeText(qrCode);
    toast({
      title: "Copiado!",
      description: "Dados do QR Code copiados para área de transferência",
    });
  };

  return (
    <Card className="border-2 border-green-200 bg-green-50">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-2 text-green-800">
          <QrCode className="h-5 w-5" />
          QR Code WhatsApp
        </CardTitle>
        <CardDescription className="text-green-700">
          Instância: {instanceName}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* QR Code Image */}
        <div className="flex justify-center">
          <div className="p-4 bg-white rounded-lg border-2 border-green-300 shadow-sm">
            <img 
              src={qrCode} 
              alt="QR Code WhatsApp"
              className="max-w-[250px] max-h-[250px] mx-auto"
            />
          </div>
        </div>

        {/* Instructions */}
        <Alert>
          <Smartphone className="h-4 w-4" />
          <AlertDescription>
            <strong>Como conectar:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque nos 3 pontos → Dispositivos conectados</li>
              <li>Toque em "Conectar dispositivo"</li>
              <li>Aponte a câmera para este QR Code</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Status & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-blue-500">
              <Clock className="h-3 w-3 mr-1" />
              Aguardando scan
            </Badge>
            {onRefresh && (
              <span className="text-xs text-muted-foreground">
                Refresh em {timeLeft}s
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyQRData}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar
            </Button>
            
            {onRefresh && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${refreshing && 'animate-spin'}`} />
                {refreshing ? 'Atualizando...' : 'Atualizar'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
