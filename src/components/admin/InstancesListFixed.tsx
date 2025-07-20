
import { useState, useEffect } from "react";
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
  Eye,
  MessageSquare,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { ClientData } from "@/services/clientsService";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";

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

  // Hook unificado OTIMIZADO - sem loops
  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading,
    restMode,
    cleanup,
    refreshStatus,
    serverOnline
  } = useUnifiedInstanceManager();

  // ============ SYNC INICIAL APENAS UMA VEZ ============
  useEffect(() => {
    console.log('🔄 [ADMIN] Sync inicial das instâncias (uma única vez)');
    
    const syncInitialInstances = async () => {
      // Sync apenas das instâncias existentes, sem loop
      for (const instance of instances) {
        try {
          console.log(`🔄 [ADMIN] Sincronizando ${instance.instance_id} uma vez`);
          await refreshStatus(instance.instance_id);
        } catch (error) {
          console.warn(`⚠️ [ADMIN] Erro ao sincronizar ${instance.instance_id}:`, error);
        }
      }
    };

    if (instances.length > 0 && serverOnline) {
      syncInitialInstances();
    }
  }, [instances.length]); // Apenas quando número de instâncias mudar

  // ============ HANDLERS OTIMIZADOS ============
  const handleViewQRCode = async (instanceId: string) => {
    console.log(`👁️ [ADMIN] Visualizando QR Code para: ${instanceId}`);
    setSelectedInstanceForQR(instanceId);
    
    // Refresh apenas se necessário
    const currentStatus = getInstanceStatus(instanceId);
    if (!currentStatus.hasQrCode && currentStatus.status !== 'connected') {
      try {
        await refreshStatus(instanceId);
      } catch (error) {
        console.warn(`⚠️ [ADMIN] Erro ao atualizar status:`, error);
      }
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    console.log(`🔗 [ADMIN] CONECTANDO INSTÂNCIA: ${instanceId}`);
    setSelectedInstanceForQR(instanceId);
    
    try {
      await connectInstance(instanceId);
      console.log(`✅ [ADMIN] Conexão iniciada com sucesso`);
    } catch (error: any) {
      console.error(`❌ [ADMIN] Erro na conexão:`, error);
      
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

  // ============ HANDLER PARA RECRIAR ÓRFÃS ============
  const handleRecreateInstance = async (instance: WhatsAppInstanceData) => {
    if (!confirm('Esta instância está órfã (sem token de autenticação). Deseja recriá-la? Isso irá gerar um novo QR Code.')) {
      return;
    }

    try {
      console.log(`🔄 [ADMIN] Recriando instância órfã: ${instance.instance_id}`);
      
      const { instancesUnifiedService } = await import('@/services/instancesUnifiedService');
      
      await instancesUnifiedService.deleteInstance(instance.instance_id);
      
      const customName = instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`;
      const result = await instancesUnifiedService.createInstanceForClient(
        instance.client_id!, 
        customName
      );

      console.log('✅ [ADMIN] Instância recriada com sucesso:', result);

      toast({
        title: "Instância Recriada",
        description: "Instância órfã foi recriada com sucesso",
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

  // ============ FUNÇÕES AUXILIARES ============
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

  const isOrphanedInstance = (instance: WhatsAppInstanceData) => {
    return !instance.auth_token || instance.auth_token === null;
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
            <span>Instâncias WhatsApp OTIMIZADAS ({instances.length})</span>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {serverOnline ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs">
                  {serverOnline ? 'Servidor Online' : 'Servidor Offline'}
                </span>
              </div>
              <Badge variant={restMode ? 'default' : 'destructive'}>
                {restMode ? '🔄 Modo REST' : '❌ Erro'}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            {instances.map((instance) => {
              const instanceStatus = getInstanceStatus(instance.instance_id);
              
              // Determinar status final
              const finalStatus = instanceStatus.status === 'connected' || instance.status === 'connected' || instanceStatus.phoneNumber || instance.phone_number ? 'connected' : instanceStatus.status || instance.status;
              const finalPhoneNumber = instanceStatus.phoneNumber || instance.phone_number;
              const isConnected = finalStatus === 'connected' && finalPhoneNumber;
              
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
                        <p className="text-sm text-gray-500">
                          {finalPhoneNumber || 'Desconectado'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(finalStatus)}`} />
                        <Badge variant={isConnected ? 'default' : 'secondary'}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(finalStatus)}
                            <span>{getStatusText(finalStatus)}</span>
                          </div>
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    
                     {/* Status da Instância */}
                     {!isOrphanedInstance(instance) && (
                       <div className="p-3 bg-green-50 border border-green-200 rounded">
                         <div className="flex items-center space-x-2">
                           <CheckCircle className="w-4 h-4 text-green-500" />
                           <span className="text-sm font-medium text-green-900">Instância Sincronizada</span>
                         </div>
                         <p className="text-sm text-green-700 mt-1">
                           ✅ Token: {instance.auth_token ? 'Válido' : 'Ausente'} | YUMER: {serverOnline ? 'Online' : 'Offline'} | Status: {finalStatus}
                         </p>
                       </div>
                     )}

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
                           🔧 Esta instância existe no banco mas sem token de autenticação válido
                         </p>
                       </div>
                     )}

                     {/* Status Debugging - SEM LOOP */}
                     {selectedInstanceForQR === instance.instance_id && (
                       <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-sm font-medium">Status OTIMIZADO (sem loops):</span>
                           <div className="flex items-center space-x-1">
                             <RefreshCw className="w-4 h-4 text-blue-500" />
                             <span className="text-xs">Modo REST Inteligente</span>
                           </div>
                         </div>
                          <div className="text-sm text-blue-800 space-y-1">
                            <div>Status Hook: {instanceStatus.status}</div>
                            <div>Status DB: {instance.status}</div>
                            <div>Status Final: {finalStatus}</div>
                            <div>Phone Hook: {instanceStatus.phoneNumber || 'N/A'}</div>
                            <div>Phone DB: {instance.phone_number || 'N/A'}</div>
                            <div>Is Connected: {isConnected ? 'SIM' : 'NÃO'}</div>
                            <div>Servidor: {serverOnline ? 'Online' : 'Offline'}</div>
                            <div className="text-xs text-muted-foreground">
                              Modo: Polling inteligente apenas quando necessário
                            </div>
                          </div>
                       </div>
                     )}

                     {/* QR Code Display OTIMIZADO */}
                     {selectedInstanceForQR === instance.instance_id && (
                       <div>
                         {/* Mostrar Connected Info se conectado */}
                         {isConnected ? (
                           <div className="text-center p-4 bg-green-50 border border-green-200 rounded">
                             <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                             <div className="text-lg font-semibold text-green-800">WhatsApp Conectado!</div>
                             <div className="text-sm text-green-700">{finalPhoneNumber}</div>
                             <div className="text-xs text-green-600 mt-1">
                               ✅ Instância funcionando perfeitamente
                             </div>
                           </div>
                         ) : (
                           <>
                             {/* Mostrar QR Code se disponível */}
                             {instanceStatus.hasQrCode && instanceStatus.qrCode ? (
                               <div>
                                 <div className="text-sm text-green-600 mb-2">✅ QR Code disponível!</div>
                                 <QRCodeDisplay 
                                   qrCode={instanceStatus.qrCode}
                                   instanceName={instance.yumer_instance_name || instance.instance_id}
                                 />
                               </div>
                             ) : instance.has_qr_code && instance.qr_code ? (
                               <div>
                                 <div className="text-sm text-blue-600 mb-2">📋 QR Code no banco!</div>
                                 <QRCodeDisplay 
                                   qrCode={instance.qr_code}
                                   instanceName={instance.yumer_instance_name || instance.instance_id}
                                 />
                               </div>
                             ) : (
                               <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                                 ⏳ QR Code não disponível. Status: {finalStatus}
                                 {finalStatus === 'connecting' && (
                                   <div className="mt-2 text-xs">
                                     • Aguardando geração do QR Code...
                                     <br />
                                     • O sistema irá detectar automaticamente quando estiver pronto
                                   </div>
                                 )}
                               </div>
                             )}
                           </>
                         )}
                       </div>
                     )}

                     {/* Action Buttons OTIMIZADOS */}
                     <div className="flex space-x-2 pt-2 flex-wrap">
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
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Abrir Chat
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => handleConnectInstance(instance.instance_id)}
                          disabled={isLoading(instance.instance_id) || !serverOnline || isOrphanedInstance(instance)}
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
                        Ver QR
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
