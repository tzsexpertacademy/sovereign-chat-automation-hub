import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Smartphone, Wifi, WifiOff, QrCode, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { whatsappService } from '@/services/whatsappMultiClient';

interface WhatsAppClient {
  clientId: string;
  status: string;
  phoneNumber?: string;
  hasQrCode?: boolean;
  qrCode?: string;
}

interface WhatsAppConnectionProps {
  clientId: string;
}

const WhatsAppConnection: React.FC<WhatsAppConnectionProps> = ({ clientId }) => {
  const [client, setClient] = useState<WhatsAppClient | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadClientStatus();

    const interval = setInterval(loadClientStatus, 15000);

    return () => clearInterval(interval);
  }, [clientId]);

  const loadClientStatus = async () => {
    try {
      setLoading(true);
      const clientStatus = await whatsappService.getClientStatus(clientId);
      setClient(clientStatus);
    } catch (error: any) {
      console.error("Erro ao carregar status do cliente:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao carregar status do cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectClient = async () => {
    try {
      setLoading(true);
      await whatsappService.connectClient(clientId);
      toast({
        title: "Sucesso",
        description: `Conectando cliente ${clientId}...`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectClient = async () => {
    try {
      setLoading(true);
      await whatsappService.disconnectClient(clientId);
      toast({
        title: "Sucesso",
        description: `Desconectando cliente ${clientId}...`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      case 'disconnected': return 'bg-gray-500';
      case 'error': case 'auth_failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'authenticated': return 'Autenticado';
      case 'disconnected': return 'Desconectado';
      case 'error': return 'Erro';
      case 'auth_failed': return 'Falha na Auth';
      default: return 'Desconhecido';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'qr_ready': return <QrCode className="w-4 h-4" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'authenticated': return <Smartphone className="w-4 h-4" />;
      case 'disconnected': return <WifiOff className="w-4 h-4" />;
      case 'error': case 'auth_failed': return <WifiOff className="w-4 h-4" />;
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  if (!client) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cliente WhatsApp</CardTitle>
          <CardDescription>Carregando status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Cliente WhatsApp: {clientId}</CardTitle>
            <CardDescription>
              Status da conexão WhatsApp
            </CardDescription>
          </div>
          <div className={`w-3 h-3 rounded-full ${getStatusColor(client.status)}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            {getStatusIcon(client.status)}
            <Badge variant={client.status === 'connected' ? 'default' : 'secondary'}>
              {getStatusText(client.status)}
            </Badge>
          </div>

          {client.phoneNumber && (
            <p>
              <strong>Número:</strong> {client.phoneNumber}
            </p>
          )}

          {client.status === 'qr_ready' && client.hasQrCode && client.qrCode && (
            <div className="space-y-2">
              <img src={client.qrCode} alt="QR Code WhatsApp" className="border rounded" />
              <p className="text-sm text-gray-500">
                Escaneie o QR Code com seu WhatsApp para conectar
              </p>
            </div>
          )}

          <div className="flex space-x-2">
            {client.status === 'connected' ? (
              <Button variant="outline" onClick={handleDisconnectClient} disabled={loading}>
                Desconectar
              </Button>
            ) : (
              <Button onClick={handleConnectClient} disabled={loading || client.status === 'connecting'}>
                {client.status === 'connecting' ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  'Conectar'
                )}
              </Button>
            )}
          </div>

          {client.status === 'error' && (
            <div className="text-red-500">
              <AlertCircle className="w-4 h-4 inline-block mr-1" />
              Erro ao conectar. Verifique o servidor.
            </div>
          )}

          {client.status === 'disconnected' && (
            <div className="text-gray-500">
              <WifiOff className="w-4 h-4 inline-block mr-1" />
              Desconectado.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppConnection;
