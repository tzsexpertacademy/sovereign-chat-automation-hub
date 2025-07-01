
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
import WhatsAppMasterController from "./WhatsAppMasterController";

interface InstancesListFixedProps {
  instances: WhatsAppInstanceData[];
  clients: ClientData[];
  onInstanceUpdated: () => void;
  systemHealth: any;
}

const InstancesListFixed = ({ instances, clients, onInstanceUpdated, systemHealth }: InstancesListFixedProps) => {
  const [selectedInstanceForQR, setSelectedInstanceForQR] = useState<string | null>(null);
  const [instancesWithFixer, setInstancesWithFixer] = useState<Set<string>>(new Set());
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

  // Obter cliente único para o Master Controller
  const clientId = instances[0]?.client_id || '';
  const instanceIds = instances.map(i => i.instance_id);

  return (
    <div className="space-y-6">
      {/* Master Controller */}
      <WhatsAppMasterController 
        clientId={clientId}
        instanceIds={instanceIds}
        onStatusUpdate={onInstanceUpdated}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Instâncias WhatsApp ({instances.length}) - SISTEMA INTELIGENTE v2.0 🚀</span>
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
              const displayStatus = realTimeStatus.reallyConnected ? 'connected' : realTimeStatus.status || instance.status;
              const displayPhone = realTimeStatus.phoneNumber || instance.phone_number;
              const isConnected = realTimeStatus.reallyConnected || (displayStatus === 'connected' && displayPhone);
              const isStuck = realTimeStatus.isStuck && !realTimeStatus.reallyConnected;
              const hasIssues = isStuck || (displayStatus === 'qr_ready' && !realTimeStatus.hasQrCode && !realTimeStatus.reallyConnected);
              const showFixer = instancesWithFixer.has(instance.instance_id);
              
              return (
                <div key={instance.id} className="space-y-4">
                  <Card className={`hover:shadow-lg transition-shadow ${hasIssues ? 'border-l-4 border-l-red-500' : isConnected ? 'border-l-4 border-l-green-500' : ''}`}>
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
                          
                          {/* Status Debug Info */}
                          {selectedInstanceForQR === instance.instance_id && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                              <div className="font-medium text-blue-800 mb-1">🔍 Status Debug v2.0:</div>
                              <div>API Status: <strong>{realTimeStatus.status}</strong></div>
                              <div>Really Connected: <strong>{realTimeStatus.reallyConnected ? 'SIM ✅' : 'NÃO ❌'}</strong></div>
                              <div>Phone: <strong>{realTimeStatus.phoneNumber || 'N/A'}</strong></div>
                              <div>QR Available: <strong>{realTimeStatus.hasQrCode ? 'SIM' : 'NÃO'}</strong></div>
                              <div>Stuck: <strong>{realTimeStatus.isStuck ? 'SIM' : 'NÃO'}</strong></div>
                              <div>Retries: <strong>{realTimeStatus.retryCount || 0}</strong></div>
                              <div className="mt-1 text-blue-700">
                                <strong>Sistema v2.0:</strong> Detecção inteligente ativa 🧠
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(displayStatus, realTimeStatus.reallyConnected)}`} />
                          <Badge variant={isConnected ? 'default' : hasIssues ? 'destructive' : 'secondary'}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(displayStatus, realTimeStatus.reallyConnected)}
                              <span>{getStatusText(displayStatus, realTimeStatus.reallyConnected)}</span>
                              {isStuck && <AlertTriangle className="w-3 h-3 ml-1" />}
                              {realTimeStatus.reallyConnected && <CheckCircle className="w-3 h-3 ml-1 text-green-600" />}
                            </div>
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Real Connection Alert */}
                      {realTimeStatus.reallyConnected && (
                        <Alert className="border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            <div className="space-y-1">
                              <p><strong>🎉 WhatsApp Realmente Conectado!</strong></p>
                              <p>Sistema v2.0 detectou conexão ativa via verificação de chats.</p>
                              <p>Telefone: {realTimeStatus.phoneNumber || 'Detectado'}</p>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Issues Alert */}
                      {hasIssues && !realTimeStatus.reallyConnected && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-2">
                              <p><strong>⚠️ Problema Detectado:</strong></p>
                              {isStuck && <p>• Instância presa há muito tempo (tentativas: {realTimeStatus.retryCount || 0})</p>}
                              {displayStatus === 'qr_ready' && !realTimeStatus.hasQrCode && <p>• QR Code não disponível</p>}
                              <p><strong>Solução:</strong> Use "Status Fixer" ou "Forçar Reconexão"</p>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* QR Code Display */}
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
                            <p className="text-xs text-blue-600 mt-1">
                              🧠 Sistema v2.0 detectará a conexão automaticamente
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Connected Info */}
                      {isConnected && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-800">
                                ✅ WhatsApp Conectado {realTimeStatus.reallyConnected ? '(Verificado v2.0)' : ''}
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
                          Debug v2.0
                        </Button>

                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRefreshStatus(instance.instance_id)}
                          disabled={isLoading(instance.instance_id)}
                          className="bg-blue-50 hover:bg-blue-100"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>

                        {!realTimeStatus.reallyConnected && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleForceReconnect(instance.instance_id)}
                            disabled={isLoading(instance.instance_id)}
                            className="bg-orange-50 hover:bg-orange-100 text-orange-700"
                          >
                            <Zap className="w-4 h-4 mr-1" />
                            Forçar Reconexão
                          </Button>
                        )}

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
