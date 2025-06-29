
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Smartphone, 
  Trash2, 
  RefreshCw, 
  Eye, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  User,
  Wifi,
  WifiOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";

interface InstancesListProps {
  instances: WhatsAppInstanceData[];
  clients: ClientData[];
  onInstanceUpdated: () => void;
  systemHealth: {
    serverOnline: boolean;
    corsEnabled: boolean;
    httpsEnabled: boolean;
    issues: string[];
  };
}

const InstancesList = ({ instances, clients, onInstanceUpdated, systemHealth }: InstancesListProps) => {
  const { toast } = useToast();

  const getClientByInstanceId = (instanceId: string) => {
    return clients.find(client => client.instance_id === instanceId);
  };

  const getClientById = (clientId: string) => {
    return clients.find(client => client.id === clientId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-4 h-4 text-blue-500" />;
      case 'connecting': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <WifiOff className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'default';
      case 'qr_ready': return 'secondary';
      case 'connecting': return 'secondary';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'error': return 'Erro';
      case 'disconnected': return 'Desconectado';
      default: return status;
    }
  };

  const handleReconnectInstance = async (instance: WhatsAppInstanceData) => {
    try {
      console.log('🔄 Reconectando instância:', instance.instance_id);
      
      // Update status to connecting
      await whatsappInstancesService.updateInstanceById(instance.id, {
        status: 'connecting'
      });
      
      // Try to connect to server if available
      if (systemHealth.serverOnline && systemHealth.corsEnabled) {
        try {
          await whatsappService.connectClient(instance.instance_id);
          toast({
            title: "Reconectando",
            description: `Instância ${instance.custom_name || instance.instance_id} está reconectando`,
          });
        } catch (serverError) {
          console.warn('⚠️ Erro no servidor, mas status atualizado no BD');
          toast({
            title: "Status Atualizado",
            description: "Status atualizado. Conectará quando servidor estiver disponível.",
          });
        }
      } else {
        toast({
          title: "Status Atualizado",
          description: "Instância marcada para reconexão. Verifique conexão do servidor.",
        });
      }
      
      onInstanceUpdated();
      
    } catch (error: any) {
      console.error('❌ Erro ao reconectar:', error);
      toast({
        title: "Erro na Reconexão",
        description: error.message || "Falha ao reconectar instância",
        variant: "destructive",
      });
    }
  };

  const handleDeleteInstance = async (instance: WhatsAppInstanceData) => {
    try {
      console.log('🗑️ Removendo instância:', instance.instance_id);
      
      // Try to disconnect from server first
      if (systemHealth.serverOnline && systemHealth.corsEnabled) {
        try {
          await whatsappService.disconnectClient(instance.instance_id);
        } catch (serverError) {
          console.warn('⚠️ Erro ao desconectar do servidor, mas removendo do BD');
        }
      }
      
      // Remove from database
      await whatsappInstancesService.deleteInstance(instance.instance_id);
      
      // Update client status
      const client = getClientById(instance.client_id);
      if (client) {
        await clientsService.updateClientInstance(client.id, "", "disconnected");
      }
      
      toast({
        title: "Instância Removida",
        description: `Instância ${instance.custom_name || instance.instance_id} foi removida`,
      });
      
      onInstanceUpdated();
      
    } catch (error: any) {
      console.error('❌ Erro ao remover instância:', error);
      toast({
        title: "Erro na Remoção",
        description: error.message || "Falha ao remover instância",
        variant: "destructive",
      });
    }
  };

  const handleViewQRCode = async (instance: WhatsAppInstanceData) => {
    try {
      if (systemHealth.serverOnline && systemHealth.corsEnabled) {
        const status = await whatsappService.getClientStatus(instance.instance_id);
        if (status.qrCode) {
          // Show QR code in a modal or new window
          const qrWindow = window.open('', '_blank', 'width=400,height=400');
          qrWindow?.document.write(`
            <html>
              <head><title>QR Code - ${instance.custom_name}</title></head>
              <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                <div style="text-align: center;">
                  <h3>QR Code - ${instance.custom_name}</h3>
                  <img src="${status.qrCode}" alt="QR Code" style="max-width: 100%;" />
                  <p>Escaneie com seu WhatsApp</p>
                </div>
              </body>
            </html>
          `);
        } else {
          toast({
            title: "QR Code Indisponível",
            description: "QR Code não está disponível para esta instância",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Servidor Indisponível",
          description: "Não é possível obter QR Code - servidor offline ou CORS não configurado",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('❌ Erro ao obter QR Code:', error);
      toast({
        title: "Erro",
        description: "Falha ao obter QR Code",
        variant: "destructive",
      });
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
              Crie sua primeira instância WhatsApp usando o formulário acima
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Instâncias Ativas ({instances.length})</h2>
      
      <div className="grid gap-4">
        {instances.map((instance) => {
          const client = getClientById(instance.client_id);
          const displayName = instance.custom_name || `Instância ${instance.instance_id}`;
          
          return (
            <Card key={instance.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="w-6 h-6 text-blue-500" />
                    <div>
                      <CardTitle className="text-lg">{displayName}</CardTitle>
                      <CardDescription className="flex items-center space-x-2">
                        <span>ID: {instance.instance_id}</span>
                        {client && (
                          <>
                            <span>•</span>
                            <User className="w-3 h-3" />
                            <span>{client.name}</span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusColor(instance.status)}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(instance.status)}
                        <span>{getStatusText(instance.status)}</span>
                      </div>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Instance Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Telefone</p>
                    <p className="font-medium">{instance.phone_number || 'Não conectado'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Última atualização</p>
                    <p className="font-medium">{new Date(instance.updated_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Connection Status */}
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
                  {systemHealth.serverOnline ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    Servidor: {systemHealth.serverOnline ? 'Online' : 'Offline'}
                  </span>
                  {systemHealth.corsEnabled ? (
                    <span className="text-xs text-green-600">• CORS OK</span>
                  ) : (
                    <span className="text-xs text-red-600">• CORS Erro</span>
                  )}
                </div>

                {/* Status-specific information */}
                {instance.status === 'qr_ready' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800">
                      📱 QR Code disponível - escaneie com seu WhatsApp
                    </p>
                  </div>
                )}

                {instance.status === 'connected' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-800">
                      ✅ WhatsApp conectado e funcionando
                    </p>
                  </div>
                )}

                {instance.status === 'error' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-800">
                      ❌ Erro na conexão - tente reconectar
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  {instance.status === 'qr_ready' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewQRCode(instance)}
                      disabled={!systemHealth.serverOnline || !systemHealth.corsEnabled}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver QR Code
                    </Button>
                  )}
                  
                  {['disconnected', 'error'].includes(instance.status) && (
                    <Button 
                      size="sm"
                      onClick={() => handleReconnectInstance(instance)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Reconectar
                    </Button>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleDeleteInstance(instance)}
                    className="text-red-600 hover:text-red-700"
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
    </div>
  );
};

export default InstancesList;
