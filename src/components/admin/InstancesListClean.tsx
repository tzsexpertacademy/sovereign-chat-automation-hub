
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCodeDisplay } from '@/components/ui/QRCodeDisplay';
import { 
  Play, 
  Pause, 
  QrCode, 
  Smartphone, 
  Wifi,
  WifiOff,
  MessageSquare,
  Trash2,
  Clock,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { ClientData } from "@/services/clientsService";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";

interface InstancesListCleanProps {
  instances: WhatsAppInstanceData[];
  clients: ClientData[];
  onInstanceUpdated: () => void;
  serverOnline: boolean;
}

const InstancesListClean = ({ instances, clients, onInstanceUpdated, serverOnline }: InstancesListCleanProps) => {
  const [selectedInstanceForQR, setSelectedInstanceForQR] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading
  } = useUnifiedInstanceManager();

  const handleConnectInstance = async (instanceId: string) => {
    try {
      await connectInstance(instanceId);
      onInstanceUpdated();
    } catch (error: any) {
      console.error('Erro na conexão:', error);
    }
  };

  const handleDisconnectInstance = async (instanceId: string) => {
    try {
      await disconnectInstance(instanceId);
      setSelectedInstanceForQR(null);
      onInstanceUpdated();
    } catch (error: any) {
      console.error('Erro na desconexão:', error);
    }
  };

  const handleViewQRCode = (instanceId: string) => {
    setSelectedInstanceForQR(selectedInstanceForQR === instanceId ? null : instanceId);
  };

  const handleOpenChat = (instance: WhatsAppInstanceData) => {
    navigate(`/client/${instance.client_id}/chat`);
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (confirm('Tem certeza que deseja remover esta instância?')) {
      try {
        const { whatsappInstancesService } = await import('@/services/whatsappInstancesService');
        await whatsappInstancesService.deleteInstance(instanceId);
        
        toast({
          title: "Instância Removida",
          description: "Instância removida com sucesso",
        });

        onInstanceUpdated();
      } catch (error) {
        console.error('Erro ao deletar instância:', error);
        toast({
          title: "Erro",
          description: "Falha ao remover instância",
          variant: "destructive",
        });
      }
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente Desconhecido';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'default';
      case 'connecting': return 'secondary';
      case 'qr_ready': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando';
      case 'qr_ready': return 'QR Pronto';
      default: return 'Desconectado';
    }
  };

  const getStatusIcon = (status: string, hasPhone: boolean) => {
    if (hasPhone) return <Wifi className="w-4 h-4 text-green-500" />;
    
    switch (status) {
      case 'connecting': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'qr_ready': return <QrCode className="w-4 h-4 text-blue-500" />;
      default: return <WifiOff className="w-4 h-4 text-gray-500" />;
    }
  };

  if (instances.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Smartphone className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma instância encontrada</h3>
            <p className="text-muted-foreground">
              Crie uma nova instância para começar
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instâncias Ativas ({instances.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-2 gap-4">
          {instances.map((instance) => {
            const instanceStatus = getInstanceStatus(instance.instance_id);
            const finalStatus = instanceStatus.status || instance.status || 'disconnected';
            const finalPhoneNumber = instanceStatus.phoneNumber || instance.phone_number;
            const isConnected = finalStatus === 'connected' && finalPhoneNumber;
            const showQR = selectedInstanceForQR === instance.instance_id;

            return (
              <Card key={instance.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {getStatusIcon(finalStatus, !!finalPhoneNumber)}
                        <h4 className="font-semibold">
                          {instance.custom_name || instance.instance_id}
                        </h4>
                      </div>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground mb-1">
                        <User className="w-3 h-3" />
                        <span>{getClientName(instance.client_id)}</span>
                      </div>
                      {finalPhoneNumber && (
                        <p className="text-sm font-medium text-green-600">
                          {finalPhoneNumber}
                        </p>
                      )}
                    </div>
                    <Badge variant={getStatusColor(finalStatus)}>
                      {getStatusText(finalStatus)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0 space-y-3">
                  {/* QR Code Display */}
                  {showQR && (
                    <div className="border rounded-lg p-4">
                      {isConnected ? (
                        <div className="text-center py-4">
                          <Wifi className="w-12 h-12 text-green-500 mx-auto mb-2" />
                          <p className="font-medium text-green-600">WhatsApp Conectado</p>
                          <p className="text-sm text-muted-foreground">{finalPhoneNumber}</p>
                        </div>
                      ) : instanceStatus.hasQrCode && instanceStatus.qrCode ? (
                        <QRCodeDisplay 
                          qrCode={instanceStatus.qrCode}
                          instanceName={instance.custom_name || instance.instance_id}
                        />
                      ) : instance.has_qr_code && instance.qr_code ? (
                        <QRCodeDisplay 
                          qrCode={instance.qr_code}
                          instanceName={instance.custom_name || instance.instance_id}
                        />
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <QrCode className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">QR Code não disponível</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {isConnected ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDisconnectInstance(instance.instance_id)}
                          disabled={isLoading(instance.instance_id) || !serverOnline}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Desconectar
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleOpenChat(instance)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => handleConnectInstance(instance.instance_id)}
                        disabled={isLoading(instance.instance_id) || !serverOnline}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isLoading(instance.instance_id) ? (
                          <>
                            <Clock className="w-4 h-4 mr-1 animate-spin" />
                            Conectando...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            Conectar
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewQRCode(instance.instance_id)}
                    >
                      <QrCode className="w-4 h-4 mr-1" />
                      QR
                    </Button>

                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDeleteInstance(instance.instance_id)}
                      disabled={isLoading(instance.instance_id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default InstancesListClean;
