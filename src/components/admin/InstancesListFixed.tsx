
import { useState, useEffect } from "react";
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

  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup,
    refreshInstanceStatus
  } = useInstanceManager();

  // Auto-refresh MAIS AGRESSIVO - a cada 10 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      instances.forEach(instance => {
        const currentStatus = getInstanceStatus(instance.instance_id);
        console.log(`🔄 Auto-refresh ${instance.instance_id}: status=${currentStatus.status}, phone=${currentStatus.phoneNumber}`);
        
        // Sempre verificar se não está definitivamente conectado
        if (currentStatus.status !== 'connected' || !currentStatus.phoneNumber) {
          refreshInstanceStatus(instance.instance_id).catch(console.error);
        }
      });
    }, 10000); // A cada 10 segundos

    return () => clearInterval(interval);
  }, [instances, getInstanceStatus, refreshInstanceStatus]);

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
    // Forçar refresh do status para pegar QR mais recente
    refreshInstanceStatus(instanceId).catch(console.error);
  };

  const handleRefreshStatus = async (instanceId: string) => {
    try {
      console.log(`🔄 Refresh manual solicitado para ${instanceId}`);
      await refreshInstanceStatus(instanceId);
      toast({
        title: "Status Atualizado",
        description: `Status da instância ${instanceId} foi atualizado`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar status",
        variant: "destructive",
      });
    }
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
          <CardTitle className="flex items-center justify-between">
            <span>Instâncias WhatsApp ({instances.length}) - STATUS CORRIGIDO ✅</span>
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${websocketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-600">{websocketConnected ? 'WebSocket Conectado' : 'WebSocket Desconectado'}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            {instances.map((instance) => {
              const realTimeStatus = getInstanceStatus(instance.instance_id);
              const displayStatus = realTimeStatus.status || instance.status;
              const displayPhone = realTimeStatus.phoneNumber || instance.phone_number;
              const isConnected = displayStatus === 'connected' && displayPhone;
              
              // LOG PARA DEBUG
              console.log(`🔍 Renderizando ${instance.instance_id}:`, {
                realTimeStatus: realTimeStatus.status,
                dbStatus: instance.status,
                displayStatus,
                displayPhone,
                isConnected,
                hasQrCode: realTimeStatus.hasQrCode
              });
              
              return (
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
                        <p className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-gray-500'}`}>
                          {displayPhone || 'Não conectado'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(displayStatus)}`} />
                        <Badge variant={isConnected ? 'default' : 'secondary'}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(displayStatus)}
                            <span>{getStatusText(displayStatus)}</span>
                          </div>
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    
                    {/* Debug Info - MAIS DETALHADO */}
                    {selectedInstanceForQR === instance.instance_id && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>Status Real: <strong>{realTimeStatus.status}</strong></div>
                          <div>Status DB: <strong>{instance.status}</strong></div>
                          <div>Phone Real: <strong>{realTimeStatus.phoneNumber || 'N/A'}</strong></div>
                          <div>Phone DB: <strong>{instance.phone_number || 'N/A'}</strong></div>
                          <div>QR Disponível: <strong>{realTimeStatus.hasQrCode ? 'SIM' : 'NÃO'}</strong></div>
                          <div>WebSocket: <strong>{websocketConnected ? 'ATIVO' : 'INATIVO'}</strong></div>
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <div>Timestamp: <strong>{realTimeStatus.timestamp || 'N/A'}</strong></div>
                        </div>
                      </div>
                    )}

                    {/* QR Code Display - LÓGICA MELHORADA */}
                    {selectedInstanceForQR === instance.instance_id && 
                     displayStatus === 'qr_ready' && 
                     realTimeStatus.hasQrCode && 
                     realTimeStatus.qrCode && 
                     !isConnected && (
                      <div className="space-y-3">
                        <div className="text-center">
                          <h4 className="font-medium mb-2 text-blue-600">📱 QR Code Disponível!</h4>
                          <div className="bg-white p-4 rounded border-2 border-blue-300">
                            <img 
                              src={realTimeStatus.qrCode} 
                              alt="QR Code WhatsApp"
                              className="mx-auto max-w-[200px]"
                            />
                          </div>
                          <p className="text-xs text-green-600 mt-2 font-medium">
                            ✅ Escaneie com seu WhatsApp para conectar
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Connected Info - MELHORADO */}
                    {isConnected && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-800">
                              ✅ WhatsApp Conectado DEFINITIVAMENTE
                            </p>
                            <p className="text-xs text-green-600">
                              {displayPhone} - {realTimeStatus.timestamp}
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenChat(instance)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Ir para Chat
                          </Button>
                        </div>
                      </div>
                    )}

                     {/* Action Buttons */}
                     <div className="flex space-x-2 pt-2 flex-wrap gap-2">
                      {!isConnected ? (
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
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDisconnectInstance(instance.instance_id)}
                          disabled={isLoading(instance.instance_id)}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pausar
                        </Button>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewQRCode(instance.instance_id)}
                        disabled={isLoading(instance.instance_id)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {displayStatus === 'qr_ready' && realTimeStatus.hasQrCode ? 'Ver QR' : 'Debug'}
                      </Button>

                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRefreshStatus(instance.instance_id)}
                        disabled={isLoading(instance.instance_id)}
                        title="FORÇAR atualização de status"
                        className="bg-blue-50 hover:bg-blue-100"
                      >
                        <RefreshCw className="w-4 h-4" />
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
    </div>
  );
};

export default InstancesListFixed;
