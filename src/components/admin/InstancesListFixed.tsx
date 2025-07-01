import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Trash2,
  AlertTriangle,
  Zap,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { ClientData } from "@/services/clientsService";
import { useInstanceManager } from "@/contexts/InstanceManagerContext";
import WhatsAppStatusFixer from "./WhatsAppStatusFixer";
import WhatsAppConnectionStatus from "./WhatsAppConnectionStatus";

interface InstancesListFixedProps {
  instances: WhatsAppInstanceData[];
  clients: ClientData[];
  onInstanceUpdated: () => void;
  systemHealth: any;
}

const InstancesListFixed = ({ instances, clients, onInstanceUpdated, systemHealth }: InstancesListFixedProps) => {
  const [selectedInstanceForQR, setSelectedInstanceForQR] = useState<string | null>(null);
  const [instancesWithFixer, setInstancesWithFixer] = useState<Set<string>>(new Set());
  const [connectedInstances, setConnectedInstances] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();

  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    websocketConnected,
    cleanup,
    refreshInstanceStatus,
    forceReconnectInstance
  } = useInstanceManager();

  // Auto-refresh mais inteligente
  useEffect(() => {
    const interval = setInterval(() => {
      instances.forEach(instance => {
        const currentStatus = getInstanceStatus(instance.instance_id);
        
        // Só verificar se NÃO estiver definitivamente conectado
        if (!currentStatus.reallyConnected && currentStatus.status !== 'connected') {
          refreshInstanceStatus(instance.instance_id).catch(console.error);
        }
      });
    }, 8000); // A cada 8 segundos

    return () => clearInterval(interval);
  }, [instances, getInstanceStatus, refreshInstanceStatus]);

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente Desconhecido';
  };

  const getStatusColor = (status: string, reallyConnected?: boolean) => {
    // Se realmente conectado, sempre verde
    if (reallyConnected) return 'bg-green-500';
    
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      case 'disconnected': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string, reallyConnected?: boolean) => {
    // Se realmente conectado, sempre "Conectado"
    if (reallyConnected) return 'Conectado';
    
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'authenticated': return 'Autenticado';
      case 'disconnected': return 'Desconectado';
      default: return 'Desconhecido';
    }
  };

  const getStatusIcon = (status: string, reallyConnected?: boolean) => {
    // Se realmente conectado, sempre ícone de conectado
    if (reallyConnected) return <Wifi className="w-4 h-4" />;
    
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

  const handleForceReconnect = async (instanceId: string) => {
    await forceReconnectInstance(instanceId);
    onInstanceUpdated();
  };

  const handleViewQRCode = (instanceId: string) => {
    setSelectedInstanceForQR(instanceId);
    refreshInstanceStatus(instanceId).catch(console.error);
  };

  const handleRefreshStatus = async (instanceId: string) => {
    try {
      console.log(`🔄 [LIST] Refresh manual: ${instanceId}`);
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

  const toggleStatusFixer = (instanceId: string) => {
    setInstancesWithFixer(prev => {
      const newSet = new Set(prev);
      if (newSet.has(instanceId)) {
        newSet.delete(instanceId);
      } else {
        newSet.add(instanceId);
      }
      return newSet;
    });
  };

  const handleInstanceConnected = (instanceId: string, phoneNumber: string) => {
    console.log(`🎉 [LIST] Instância ${instanceId} conectada: ${phoneNumber}`);
    setConnectedInstances(prev => new Set(prev).add(instanceId));
    onInstanceUpdated();
    
    toast({
      title: "🎉 WhatsApp Conectado!",
      description: `Instância conectada com sucesso: ${phoneNumber}`,
    });
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
            <span>Instâncias WhatsApp ({instances.length}) - DETECTOR INTELIGENTE 🎯</span>
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${websocketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-600">{websocketConnected ? 'WebSocket Conectado' : 'WebSocket Desconectado'}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-1 gap-6">
            {instances.map((instance) => {
              const realTimeStatus = getInstanceStatus(instance.instance_id);
              const isConnectedByDetector = connectedInstances.has(instance.instance_id);
              const showFixer = instancesWithFixer.has(instance.instance_id);
              
              return (
                <div key={instance.id} className="space-y-4">
                  <Card className={`hover:shadow-lg transition-shadow ${isConnectedByDetector ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-blue-500'}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {instance.custom_name || instance.instance_id}
                          </CardTitle>
                          <p className="text-sm text-gray-600">
                            Cliente: {getClientName(instance.client_id)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {isConnectedByDetector ? (
                            <Badge className="bg-green-600">
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="w-4 h-4" />
                                <span>Conectado (Detectado)</span>
                              </div>
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <div className="flex items-center space-x-1">
                                <QrCode className="w-4 h-4" />
                                <span>Aguardando Conexão</span>
                              </div>
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Novo Componente de Status Inteligente */}
                      <WhatsAppConnectionStatus
                        instanceId={instance.instance_id}
                        onConnected={(phoneNumber) => handleInstanceConnected(instance.instance_id, phoneNumber)}
                        onOpenChat={() => handleOpenChat(instance)}
                        showQRCode={selectedInstanceForQR === instance.instance_id}
                        qrCode={realTimeStatus.qrCode}
                      />

                      {/* Action Buttons */}
                      <div className="flex space-x-2 pt-2 flex-wrap gap-2">
                        {!isConnectedByDetector ? (
                          <>
                            <Button 
                              size="sm"
                              onClick={() => {
                                setSelectedInstanceForQR(instance.instance_id);
                                connectInstance(instance.instance_id);
                              }}
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
                            
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedInstanceForQR(instance.instance_id)}
                              disabled={isLoading(instance.instance_id)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver QR
                            </Button>
                          </>
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
                          onClick={() => handleRefreshStatus(instance.instance_id)}
                          disabled={isLoading(instance.instance_id)}
                          className="bg-blue-50 hover:bg-blue-100"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>

                        <Button 
                          size="sm" 
                          variant={showFixer ? "default" : "outline"}
                          onClick={() => toggleStatusFixer(instance.instance_id)}
                          className={showFixer ? "bg-purple-600 hover:bg-purple-700" : ""}
                        >
                          <Zap className="w-4 h-4 mr-1" />
                          Status Fixer
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

                  {/* Status Fixer Component */}
                  {showFixer && (
                    <WhatsAppStatusFixer 
                      instanceId={instance.instance_id}
                      onStatusChange={(status) => {
                        console.log(`🔧 [FIXER] Status change for ${instance.instance_id}:`, status);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstancesListFixed;
