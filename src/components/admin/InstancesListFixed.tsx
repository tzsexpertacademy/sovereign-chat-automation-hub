
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCodeManualFallback } from '@/components/admin/QRCodeManualFallback';
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
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { ClientData } from "@/services/clientsService";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";
import { codechatQRService } from "@/services/codechatQRService";

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

  // Hook unificado REST-only
  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    restMode,
    cleanup
  } = useUnifiedInstanceManager();

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente Desconhecido';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'checking': return 'bg-purple-500';
      case 'creating': return 'bg-indigo-500';
      case 'waiting_qr': return 'bg-orange-500';
      case 'awaiting_qr': return 'bg-orange-500';
      case 'authenticated': return 'bg-cyan-500';
      case 'disconnected': return 'bg-gray-500';
      case 'not_found': return 'bg-red-500';
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'checking': return 'Verificando';
      case 'creating': return 'Criando';
      case 'waiting_qr': return 'Aguardando QR';
      case 'awaiting_qr': return 'Aguardando QR';
      case 'websocket_connected': return 'WebSocket OK';
      case 'authenticated': return 'Autenticado';
      case 'disconnected': return 'Desconectado';
      case 'not_found': return 'Não Encontrada';
      case 'error': return 'Erro';
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

  // Verificar se instância é órfã (existe no Supabase mas não no YUMER)
  const isOrphanedInstance = (instance: WhatsAppInstanceData) => {
    return !instance.auth_token || instance.auth_token === null;
  };

  // Handler para recriar instância órfã
  const handleRecreateInstance = async (instance: WhatsAppInstanceData) => {
    if (!confirm('Esta instância está órfã (não existe no servidor YUMER). Deseja recriá-la? Isso irá gerar um novo QR Code.')) {
      return;
    }

    try {
      console.log(`🔄 [ADMIN] Recriando instância órfã: ${instance.instance_id}`);
      
      const { instancesUnifiedService } = await import('@/services/instancesUnifiedService');
      
      // Deletar instância órfã do banco
      await instancesUnifiedService.deleteInstance(instance.instance_id);
      
      // Recriar com o mesmo nome
      const customName = instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`;
      const result = await instancesUnifiedService.createInstanceForClient(
        instance.client_id!, 
        customName
      );

      console.log('✅ [ADMIN] Instância recriada com sucesso:', result);

      toast({
        title: "Instância Recriada",
        description: "Instância órfã foi recriada com sucesso no servidor YUMER",
      });

      onInstanceUpdated();
    } catch (error: any) {
      console.error(`❌ [ADMIN] Erro ao recriar instância:`, error);
      toast({
        title: "Erro ao Recriar",
        description: error.message || "Falha ao recriar instância órfã",
        variant: "destructive",
      });
    }
  };

  // Handler de conexão simplificado com detecção de 404
  const handleConnectInstance = async (instanceId: string) => {
    console.log(`🔗 [ADMIN] CONECTANDO INSTÂNCIA: ${instanceId}`);
    setSelectedInstanceForQR(instanceId);
    
    try {
      await connectInstance(instanceId);
      console.log(`✅ [ADMIN] Conexão iniciada com sucesso`);
    } catch (error: any) {
      console.error(`❌ [ADMIN] Erro na conexão:`, error);
      
      // Detectar erro 404 (instância não encontrada no YUMER)
      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        toast({
          title: "Instância Órfã Detectada",
          description: "Esta instância existe no banco de dados mas não no servidor YUMER. Use o botão 'Recriar' para resolver.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro na Conexão",
          description: error?.message || "Falha ao conectar instância",
          variant: "destructive",
        });
      }
    }
    
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
          <CardTitle>Instâncias WhatsApp REST ({instances.length}) - {restMode ? '🔄 Modo REST' : '❌ Erro'}</CardTitle>
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
                        {instance.phone_number || 'Não conectado via REST'}
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
                  
                   {/* Alerta de Instância Órfã */}
                   {isOrphanedInstance(instance) && (
                     <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center space-x-2">
                           <AlertCircle className="w-4 h-4 text-orange-500" />
                           <span className="text-sm font-medium text-orange-900">Instância Órfã</span>
                         </div>
                         <Button
                           size="sm"
                           onClick={() => handleRecreateInstance(instance)}
                           className="bg-orange-600 hover:bg-orange-700 text-white"
                         >
                           <RefreshCw className="w-4 h-4 mr-1" />
                           Recriar
                         </Button>
                       </div>
                       <p className="text-sm text-orange-700 mt-1">
                         Esta instância existe no banco de dados mas não no servidor YUMER (auth_token: NULL)
                       </p>
                     </div>
                   )}

                   {/* Status REST Mode */}
                   {selectedInstanceForQR === instance.instance_id && (
                     <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-sm font-medium">Status REST API:</span>
                         <div className="flex items-center space-x-1">
                           <RefreshCw className="w-4 h-4 text-blue-500" />
                           <span className="text-xs">Modo REST Ativo</span>
                         </div>
                       </div>
                        <div className="text-sm text-blue-800 space-y-1">
                          <div>Status: {getInstanceStatus(instance.instance_id).status}</div>
                          <div>Polling: {restMode ? '✅ Ativo' : '❌ Inativo'}</div>
                          <div className="text-xs text-muted-foreground">
                            Modo: 100% REST API CodeChat v1.3.3
                          </div>
                        </div>
                     </div>
                   )}

                  {/* QR Code Display HTTPS */}
                  {selectedInstanceForQR === instance.instance_id && 
                   getInstanceStatus(instance.instance_id).hasQrCode && 
                   getInstanceStatus(instance.instance_id).qrCode && (
                      <div className="space-y-3">
                        <div className="text-center">
                          <h4 className="font-medium mb-2">QR Code REST Disponível!</h4>
                          <div className="bg-white p-4 rounded border">
                            <img 
                              src={getInstanceStatus(instance.instance_id).qrCode} 
                              alt="QR Code WhatsApp REST"
                              className="mx-auto max-w-[200px]"
                            />
                          </div>
                          <p className="text-xs text-green-600 mt-2">
                            ✅ Escaneie com seu WhatsApp para conectar via REST
                          </p>
                        </div>
                      </div>
                  )}

                   {/* Connected Info */}
                   {instance.status === 'connected' && (
                     <div className="p-3 bg-green-50 border border-green-200 rounded">
                       <p className="text-sm text-green-800">
                         ✅ WhatsApp conectado via REST e funcionando
                       </p>
                     </div>
                   )}

                   {/* Manual Fallback */}
                   {(getInstanceStatus(instance.instance_id).status === 'manual_fallback_available' || 
                     getInstanceStatus(instance.instance_id).status === 'waiting_qr') && 
                    selectedInstanceForQR === instance.instance_id && (
                     <QRCodeManualFallback 
                       instanceId={instance.instance_id}
                       onQRCodeFound={(qrCode) => {
                         console.log('QR Code encontrado via fallback manual:', qrCode);
                       }}
                     />
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
                          Pausar REST
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleOpenChat(instance)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat REST
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
                            Conectando REST...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            Conectar REST
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
                      QR REST
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
