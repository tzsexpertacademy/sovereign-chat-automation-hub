import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeManualFallbackProps {
  instanceId: string;
  onQRCodeFound?: (qrCode: string) => void;
}

export const QRCodeManualFallback: React.FC<QRCodeManualFallbackProps> = ({
  instanceId,
  onQRCodeFound
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  const handleOpenQRPage = () => {
    const qrUrl = `https://yumer.yumerflow.app:8083/instance/qrcode/${instanceId}`;
    window.open(qrUrl, '_blank');
    
    toast({
      title: "📱 Interface QR Aberta",
      description: "Clique no botão 'Generate qrcode' na nova aba",
    });
  };

  const handleRefreshCheck = async () => {
    setIsChecking(true);
    
    try {
      // Simular verificação do QR Code
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "🔄 Verificação Manual",
        description: "Verifique se o QR Code apareceu na interface web",
      });
    } catch (error) {
      console.error('Erro na verificação manual:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <ExternalLink className="h-5 w-5" />
          Fallback Manual do QR Code
        </CardTitle>
        <CardDescription className="text-orange-600 dark:text-orange-400">
          Se o QR Code não aparecer automaticamente, use a interface web manual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-orange-700 dark:text-orange-300">
            <strong>Passos para obter o QR Code manualmente:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-orange-600 dark:text-orange-400">
            <li>Clique no botão abaixo para abrir a interface QR</li>
            <li>Na nova aba, clique em "Generate qrcode"</li>
            <li>Escaneie o QR Code que aparecer</li>
          </ol>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={handleOpenQRPage}
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-900"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Interface QR
          </Button>
          
          <Button 
            onClick={handleRefreshCheck}
            disabled={isChecking}
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-900"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            Verificar Status
          </Button>
        </div>
        
        <div className="text-xs text-orange-600 dark:text-orange-400 p-2 bg-orange-100 dark:bg-orange-900 rounded">
          <strong>💡 Dica:</strong> Esta interface web é gerada diretamente pelo servidor YUMER 
          e funciona independentemente do sistema principal.
        </div>
      </CardContent>
    </Card>
  );
};