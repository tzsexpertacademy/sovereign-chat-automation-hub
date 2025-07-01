
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Play, 
  Pause, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Activity,
  Wifi,
  WifiOff,
  MessageSquare,
  RefreshCw,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { WhatsAppInstanceData, whatsappInstancesService } from "@/services/whatsappInstancesService";
import { ClientData, clientsService } from "@/services/clientsService";
import { useInstanceManager } from "@/contexts/InstanceManagerContext";

interface MultipleInstancesManagerFixedProps {
  clientId: string;
  client: ClientData;
  onInstancesUpdate: () => void;
}

const MultipleInstancesManagerFixed = ({ 
  clientId, 
  client, 
  onInstancesUpdate 
}: MultipleInstancesManagerFixedProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedInstanceForQR, setSelectedInstanceForQR] = useState<string | null>(null);

  // Hook unificado para gerenciar instâncias
  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup
  } = useInstanceManager();

  useEffect(() => {
    loadInstances();
  }, [clientId]);

  const loadInstances = async () => {
    try {
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      setInstances(instancesData);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const handleCreateInstance = async () => {
    const canCreate = await clientsService.canCreateInstance(clientId);
    if (!canCreate) {
      toast({
        title: "Limite Atingido",
        description: `Limite de ${client.max_instances} instância(s) atingido.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const instanceId = `${clientId}_${Date.now()}`;
      
      await whatsappInstancesService.createInstance({
        client_id: clientId,
        instance_id: instanceId,
        status: 'disconnected',
        custom_name: `Instância ${instances.length + 1}`
      });

      toast({
        title: "Instância Criada",
        description: "Nova instância WhatsApp criada com sucesso",
      });

      await loadInstances();
      onInstancesUpdate();
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar nova instância",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    setSelectedInstanceForQR(instanceId);
    await connectInstance(instanceId);
    await loadInstances();
    onInstancesUpdate();
  };

  const handleDisconnectInstance = async (instanceId: string) => {
    await disconnectInstance(instanceId);
    cleanup(instanceId);
    setSelectedInstanceForQR(null);
    await loadInstances();
    onInstancesUpdate();
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
        await whatsappInstancesService.deleteInstance(instanceId);
        
        toast({
          title: "Instância Removida",
          description: "Instância WhatsApp removida com sucesso",
        });

        await loadInstances();
        onInstancesUpdate();
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
      case 'connected': return <CheckCircle className="w-4 h-4" />;
      case 'qr_ready': return <QrCode className="w-4 h-4" />;
      case 'connecting': return <Clock className="w-4 h-4" />;
      case 'authenticated': return <CheckCircle className="w-4 h-4" />;
      case 'disconnected': return <AlertCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Gerenciar Instâncias WhatsApp - DEFINITIVO ✅</CardTitle>
          <Button 
            onClick={handleCreateInstance} 
            disabled={creating || instances.length >= client.max_instances}
          >
            <Plus className="w-4 h-4 mr-2" />
            {creating ? 'Criando...' : 'Nova Instância'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {instances.length === 0 ? (
          <div className="text-center py-8">
            <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma instância encontrada</h3>
            <p className="text-gray-600 mb-4">
              Crie sua primeira instância WhatsApp para começar
            </p>
            <Button onClick={handleCreateInstance} disabled={creating}>
              <Plus className="w-4 h-4 mr-2" />
              {creating ? 'Criando...' : 'Criar Primeira Instância'}
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {instances.map((instance) => {
              const realTimeStatus = getInstanceStatus(instance.instance_id);
              const displayStatus = realTimeStatus.status || instance.status;
              const displayPhone = realTimeStatus.phoneNumber || instance.phone_number;
              
              return (
                <Card key={instance.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-lg">
                          {instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {displayPhone || 'Não conectado'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(displayStatus)}`} />
                        <Badge variant={displayStatus === 'connected' ? 'default' : 'secondary'}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(displayStatus)}
                            <span className="text-xs">{getStatusText(displayStatus)}</span>
                          </div>
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    
                    {/* Status específico para instância selecionada */}
                    {selectedInstanceForQR === instance.instance_id && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">WebSocket:</span>
                          <div className="flex items-center space-x-1">
                            {websocketConnected ? (
                              <Wifi className="w-3 h-3 text-green-500" />
                            ) : (
                              <WifiOff className="w-3 h-3 text-red-500" />
                            )}
                            <span className="text-xs">
                              {websocketConnected ? 'Conectado' : 'Desconectado'}
                            </span>
                          </div>
                        </div>
                        <p className="text-blue-800 mt-1">Status: {displayStatus}</p>
                        {realTimeStatus.phoneNumber && (
                          <p className="text-green-700">Tel: {realTimeStatus.phoneNumber}</p>
                        )}
                      </div>
                    )}

                    {/* QR Code Display - LÓGICA DEFINITIVA */}
                    {selectedInstanceForQR === instance.instance_id && 
                     displayStatus === 'qr_ready' && 
                     realTimeStatus.hasQrCode && 
                     realTimeStatus.qrCode && 
                     !displayPhone && (
                      <div className="text-center space-y-2">
                        <h5 className="font-medium text-sm">QR Code Disponível!</h5>
                        <div className="bg-white p-2 rounded border inline-block">
                          <img 
                            src={realTimeStatus.qrCode} 
                            alt="QR Code WhatsApp"
                            className="w-32 h-32"
                          />
                        </div>
                        <p className="text-xs text-green-600">
                          ✅ Escaneie para conectar
                        </p>
                      </div>
                    )}

                    {/* Connected Info */}
                    {displayStatus === 'connected' && displayPhone && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm text-green-800">
                          ✅ Conectado: {displayPhone}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons - LÓGICA DEFINITIVA */}
                    <div className="flex flex-wrap gap-2">
                      {/* MOSTRAR "Ir para Chat" se tem phoneNumber OU status connected */}
                      {(displayPhone || displayStatus === 'connected') ? (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDisconnectInstance(instance.instance_id)}
                            disabled={isLoading(instance.instance_id)}
                            className="flex-1"
                          >
                            <Pause className="w-3 h-3 mr-1" />
                            Pausar
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenChat(instance)}
                            className="bg-green-600 hover:bg-green-700 text-white flex-1"
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Chat
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => handleConnectInstance(instance.instance_id)}
                          disabled={isLoading(instance.instance_id)}
                          className="bg-green-600 hover:bg-green-700 flex-1"
                        >
                          {isLoading(instance.instance_id) ? (
                            <>
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              Conectando...
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 mr-1" />
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
                        <QrCode className="w-3 h-3 mr-1" />
                        {displayStatus === 'qr_ready' && realTimeStatus.hasQrCode ? 'Ver QR' : 'Status'}
                      </Button>

                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteInstance(instance.instance_id)}
                        disabled={isLoading(instance.instance_id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MultipleInstancesManagerFixed;
