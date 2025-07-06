
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  QrCode, 
  Smartphone, 
  Wifi,
  WifiOff,
  Eye,
  MessageSquare,
  RefreshCw,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { ClientData } from "@/services/clientsService";
import { useInstanceManager } from "@/contexts/InstanceManagerContext";

interface InstancesListFixedProps {
  instances: WhatsAppInstanceData[];
  clients: ClientData[];
  onInstanceUpdated: () => void;
  systemHealth: any;
}

const InstancesListFixed = ({ instances, clients, onInstanceUpdated, systemHealth }: InstancesListFixedProps) => {
  const [selectedInstanceForQR, setSelectedInstanceForQR] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Hook simplificado para HTTPS
  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup
  } = useInstanceManager();

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente Desconhecido';
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado HTTPS';
      case 'qr_ready': return 'QR Pronto HTTPS';
      case 'connecting': return 'Conectando HTTPS';
      case 'authenticated': return 'Autenticado HTTPS';
      case 'disconnected': return 'Desconectado';
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
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  // Handlers simplificados HTTPS
  const handleConnectInstance = async (instanceId: string) => {
    setSelectedInstanceForQR(instanceId);
    await connectInstance(instanceId);
    onInstanceUpdated();
  };

  const handleDisconnectInstance = async (instanceId: string) => {
    await disconnectInstance(instanceId);
    cleanup(instanceId);
    setSelectedInstanceForQR(null);
    onInstanceUpdated();
  };

  const handleViewQRCode = (instanceId: string) => {
    setSelectedInstanceForQR(instanceId);
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
          description: "Instância WhatsApp removida com sucesso",
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

  if (instances.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma instância encontrada</h3>
            <p className="text-gray-600">
              Crie uma nova instância para começar a usar o WhatsApp HTTPS
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Instâncias WhatsApp HTTPS ({instances.length}) - CORRIGIDO</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            {instances.map((instance) => (
              <Card key={instance.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {instance.custom_name || instance.instance_id}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        Cliente: {getClientName(instance.client_id)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {instance.phone_number || 'Não conectado via HTTPS'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                      <Badge variant={instance.status === 'connected' ? 'default' : 'secondary'}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(instance.status)}
                          <span>{getStatusText(instance.status)}</span>
                        </div>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Status WebSocket HTTPS */}
                  {selectedInstanceForQR === instance.instance_id && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Status WebSocket HTTPS:</span>
                        <div className="flex items-center space-x-1">
                          {websocketConnected ? (
                            <Wifi className="w-4 h-4 text-green-500" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-xs">
                            {websocketConnected ? 'Conectado HTTPS' : 'Desconectado'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-blue-800">
                        Status atual HTTPS: {getInstanceStatus(instance.instance_id).status}
                      </p>
                    </div>
                  )}

                  {/* QR Code Display HTTPS */}
                  {selectedInstanceForQR === instance.instance_id && 
                   getInstanceStatus(instance.instance_id).hasQrCode && 
                   getInstanceStatus(instance.instance_id).qrCode && (
                    <div className="space-y-3">
                      <div className="text-center">
                        <h4 className="font-medium mb-2">QR Code HTTPS Disponível!</h4>
                        <div className="bg-white p-4 rounded border">
                          <img 
                            src={getInstanceStatus(instance.instance_id).qrCode} 
                            alt="QR Code WhatsApp HTTPS"
                            className="mx-auto max-w-[200px]"
                          />
                        </div>
                        <p className="text-xs text-green-600 mt-2">
                          ✅ Escaneie com seu WhatsApp para conectar via HTTPS
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Connected Info */}
                  {instance.status === 'connected' && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        ✅ WhatsApp conectado via HTTPS e funcionando
                      </p>
                    </div>
                  )}

                   {/* Action Buttons HTTPS */}
                   <div className="flex space-x-2 pt-2 flex-wrap">
                    {(getInstanceStatus(instance.instance_id).phoneNumber || 
                      getInstanceStatus(instance.instance_id).status === 'connected' || 
                      instance.phone_number) ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDisconnectInstance(instance.instance_id)}
                          disabled={isLoading(instance.instance_id) || !systemHealth.serverOnline}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pausar HTTPS
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleOpenChat(instance)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat HTTPS
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => handleConnectInstance(instance.instance_id)}
                        disabled={isLoading(instance.instance_id) || !systemHealth.serverOnline}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isLoading(instance.instance_id) ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                            Conectando HTTPS...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            Conectar HTTPS
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewQRCode(instance.instance_id)}
                      disabled={isLoading(instance.instance_id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      QR HTTPS
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstancesListFixed;
