
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
import { useInstanceManager } from "@/hooks/useInstanceManager";

interface InstancesListProps {
  instances: WhatsAppInstanceData[];
  clients: ClientData[];
  onInstanceUpdated: () => void;
  systemHealth: any;
}

const InstancesList = ({ instances, clients, onInstanceUpdated, systemHealth }: InstancesListProps) => {
  const [selectedInstanceForQR, setSelectedInstanceForQR] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Hook unificado para gerenciar instâncias
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
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'authenticated': return 'Autenticado';
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

  if (instances.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma instância encontrada</h3>
            <p className="text-gray-600">
              Crie uma nova instância para começar a usar o WhatsApp
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
          <CardTitle>Instâncias WhatsApp ({instances.length})</CardTitle>
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
                        {instance.phone_number || 'Não conectado'}
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
                  
                  {/* Status específico para instância selecionada */}
                  {selectedInstanceForQR === instance.instance_id && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Status WebSocket:</span>
                        <div className="flex items-center space-x-1">
                          {websocketConnected ? (
                            <Wifi className="w-4 h-4 text-green-500" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-xs">
                            {websocketConnected ? 'Conectado' : 'Desconectado'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-blue-800">
                        Status atual: {getInstanceStatus(instance.instance_id).status}
                      </p>
                    </div>
                  )}

                  {/* QR Code Display */}
                  {selectedInstanceForQR === instance.instance_id && 
                   getInstanceStatus(instance.instance_id).hasQrCode && 
                   getInstanceStatus(instance.instance_id).qrCode && (
                    <div className="space-y-3">
                      <div className="text-center">
                        <h4 className="font-medium mb-2">QR Code Disponível!</h4>
                        <div className="bg-white p-4 rounded border">
                          <img 
                            src={getInstanceStatus(instance.instance_id).qrCode} 
                            alt="QR Code WhatsApp"
                            className="mx-auto max-w-[200px]"
                          />
                        </div>
                        <p className="text-xs text-green-600 mt-2">
                          ✅ Escaneie com seu WhatsApp para conectar
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Connected Info */}
                  {instance.status === 'connected' && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        ✅ WhatsApp conectado e funcionando
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-2">
                    {instance.status === 'connected' ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDisconnectInstance(instance.instance_id)}
                          disabled={isLoading(instance.instance_id) || !systemHealth.serverOnline}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pausar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenChat(instance)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat
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
                      disabled={isLoading(instance.instance_id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      QR Code
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

export default InstancesList;
