import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { QRCodeDisplay } from "@/components/ui/QRCodeDisplay";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  MessageSquare,
  Trash2,
  Play,
  Pause,
  Settings,
  Wifi,
  WifiOff,
  Clock,
  Edit3,
  Save,
  X,
  Zap,
  Bot,
  Link,
  Unlink
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";
import { useRealTimeInstanceSync } from "@/hooks/useRealTimeInstanceSync";
import clientYumerService from "@/services/clientYumerService";
import { useAutoQueueConnection } from "@/hooks/useAutoQueueConnection";
import { humanizedMessageProcessor } from "@/services/humanizedMessageProcessor";
import { queuesService, QueueWithAssistant } from "@/services/queuesService";
import { supabase } from "@/integrations/supabase/client";

const WhatsAppConnectionManagerV2 = () => {
  const { clientId } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [availableQueues, setAvailableQueues] = useState<QueueWithAssistant[]>([]);
  const [instanceConnections, setInstanceConnections] = useState<Record<string, any>>({});
  const [connectingQueue, setConnectingQueue] = useState<string | null>(null);

  // Hook unificado para gerenciamento de instâncias
  const { 
    instances: managerInstances, 
    connectInstance, 
    disconnectInstance, 
    getInstanceStatus, 
    isLoading: isInstanceLoading,
    refreshStatus,
    serverOnline
  } = useUnifiedInstanceManager(instances);

  // Hook para conexão automática de filas
  const { 
    connectInstanceToAvailableQueue, 
    checkAndCreateAutoConnections,
    isConnecting: isAutoConnecting 
  } = useAutoQueueConnection();

  // Sincronização em tempo real
  const { startSync, stopSync, manualSync } = useRealTimeInstanceSync({
    onInstanceUpdate: (instanceId, data) => {
      console.log(`🔄 [REAL-TIME] Atualizando instância: ${instanceId}`, data);
      setInstances(prev => prev.map(i => 
        i.instance_id === instanceId 
          ? { 
              ...i, 
              status: data.status || i.status,
              phone_number: data.phoneNumber || i.phone_number,
              qr_code: data.qrCode || i.qr_code,
              has_qr_code: data.hasQrCode !== undefined ? data.hasQrCode : i.has_qr_code,
              updated_at: new Date().toISOString()
            }
          : i
      ));
    },
    enableWebhookConfig: true,
    intervalMs: 15000 // Polling mais frequente
  });

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  useEffect(() => {
    // Iniciar sincronização em tempo real
    startSync();
    return () => stopSync();
  }, [startSync, stopSync]);

  useEffect(() => {
    // Verificar e criar conexões automáticas quando carregar dados
    if (clientId && instances.length > 0) {
      const delay = setTimeout(() => {
        checkAndCreateAutoConnections(clientId);
        
        // Inicializar processador humanizado automaticamente
        if (!humanizedMessageProcessor.getStatus().isInitialized) {
          humanizedMessageProcessor.initialize(clientId);
        }
      }, 2000); // Aguardar 2s para dar tempo das instâncias serem carregadas
      
      return () => clearTimeout(delay);
    }
  }, [clientId, instances.length, checkAndCreateAutoConnections]);

  const loadData = async () => {
    if (!clientId) return;
    
    setLoading(true);
    try {
      // Carregar dados do cliente
      const clients = await clientsService.getAllClients();
      const client = clients.find(c => c.id === clientId);
      if (!client) {
        toast({
          title: "Cliente não encontrado",
          description: "Redirecionando para dashboard",
          variant: "destructive",
        });
        navigate('/admin/clients');
        return;
      }
      setClientData(client);

      // Carregar instâncias
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      
      // Atualizar status de cada instância
      const updatedInstances = await Promise.all(
        instancesData.map(async (instance) => {
          const status = getInstanceStatus(instance.instance_id);
          return {
            ...instance,
            ...status
          };
        })
      );
      
      setInstances(updatedInstances);
      
      // Carregar filas disponíveis
      await loadQueuesAndConnections();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Tente novamente em alguns instantes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadQueuesAndConnections = async () => {
    if (!clientId) return;
    
    try {
      // Carregar filas ativas com assistentes
      const queues = await queuesService.getClientQueues(clientId);
      const activeQueuesWithAssistants = queues.filter(q => 
        q.is_active && q.assistant_id && q.assistants?.is_active
      );
      setAvailableQueues(activeQueuesWithAssistants);

      // Carregar conexões existentes
      const { data: connections } = await supabase
        .from('instance_queue_connections')
        .select(`
          *,
          queues:queue_id(id, name, assistant_id),
          whatsapp_instances:instance_id(id, instance_id)
        `)
        .eq('is_active', true);

      const connectionsMap: Record<string, any> = {};
      connections?.forEach(conn => {
        if (conn.whatsapp_instances?.instance_id) {
          connectionsMap[conn.whatsapp_instances.instance_id] = {
            queueId: conn.queue_id,
            queueName: conn.queues?.name,
            connectionId: conn.id
          };
        }
      });
      setInstanceConnections(connectionsMap);
      
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
    }
  };

  const canCreateNewInstance = () => {
    if (!clientData) return false;
    return instances.length < clientData.max_instances;
  };

  const handleCreateInstance = async () => {
    if (!clientId || !clientData || !canCreateNewInstance()) return;
    
    setCreating(true);
    try {
      const instanceName = `WPP_${Date.now()}`;
      
      // Criar instância via API v2.2.1
      const newInstance = await clientYumerService.createInstance(clientId, instanceName);
      
      // Salvar no banco local
      const savedInstance = await whatsappInstancesService.createInstance({
        client_id: clientId,
        instance_id: newInstance.instanceId,
        status: 'disconnected',
        custom_name: `Instância ${instances.length + 1}`
      });

      setInstances(prev => [...prev, savedInstance]);
      
      toast({
        title: "Instância criada com sucesso!",
        description: `${instanceName} foi criada e está pronta para conexão`,
      });
      
      // Trigger manual sync para a nova instância
      setTimeout(() => {
        manualSync(newInstance.instanceId);
      }, 1000);
      
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      toast({
        title: "Erro ao criar instância",
        description: error.message || "Tente novamente em alguns instantes",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInstance = async (instance: WhatsAppInstanceData) => {
    if (!clientId) return;
    
    try {
      // Excluir via API v2.2.1
      await clientYumerService.deleteInstance(clientId, instance.instance_id);
      
      // Remover do banco local
      await whatsappInstancesService.deleteInstance(instance.id);
      
      setInstances(prev => prev.filter(i => i.id !== instance.id));
      
      toast({
        title: "Instância excluída",
        description: `${instance.custom_name || instance.instance_id} foi removida`,
      });
    } catch (error: any) {
      console.error('Erro ao excluir instância:', error);
      toast({
        title: "Erro ao excluir instância",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleEditName = async (instanceId: string, name: string) => {
    try {
      await whatsappInstancesService.updateInstanceById(instanceId, { custom_name: name });
      setInstances(prev => prev.map(i => 
        i.id === instanceId ? { ...i, custom_name: name } : i
      ));
      setEditingName(null);
      toast({
        title: "Nome atualizado",
        description: "Nome da instância foi alterado com sucesso",
      });
    } catch (error) {
      console.error('Erro ao atualizar nome:', error);
      toast({
        title: "Erro ao atualizar nome",
        variant: "destructive",
      });
    }
  };

  const getStatusInfo = (instance: WhatsAppInstanceData) => {
    const status = getInstanceStatus(instance.instance_id);
    
    switch (status.status) {
      case 'connected':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          label: 'Conectado',
          variant: 'default' as const,
          color: 'text-green-600',
          description: status.phoneNumber ? `📱 ${status.phoneNumber}` : 'WhatsApp ativo'
        };
      case 'connecting':
        return {
          icon: <Clock className="h-4 w-4 animate-spin" />,
          label: 'Conectando',
          variant: 'secondary' as const,
          color: 'text-yellow-600',
          description: 'Aguardando QR Code'
        };
      case 'qr_ready':
        return {
          icon: <QrCode className="h-4 w-4" />,
          label: 'QR Pronto',
          variant: 'outline' as const,
          color: 'text-blue-600',
          description: 'Escaneie o QR Code'
        };
      case 'disconnected':
      default:
        return {
          icon: <WifiOff className="h-4 w-4" />,
          label: 'Desconectado',
          variant: 'destructive' as const,
          color: 'text-red-600',
          description: 'Clique para conectar'
        };
    }
  };

  const handleConnectQueue = async (instanceId: string, queueId: string) => {
    if (!clientId) return;
    
    setConnectingQueue(instanceId);
    try {
      // Buscar o UUID da instância
      const instance = instances.find(i => i.instance_id === instanceId);
      if (!instance) throw new Error('Instância não encontrada');

      // Desconectar fila anterior se existir
      const currentConnection = instanceConnections[instanceId];
      if (currentConnection?.connectionId) {
        await supabase
          .from('instance_queue_connections')
          .update({ is_active: false })
          .eq('id', currentConnection.connectionId);
      }

      // Conectar nova fila
      const { error } = await supabase
        .from('instance_queue_connections')
        .insert({
          instance_id: instance.id,
          queue_id: queueId,
          is_active: true
        });

      if (error) throw error;

      // Recarregar conexões
      await loadQueuesAndConnections();
      
      const selectedQueue = availableQueues.find(q => q.id === queueId);
      toast({
        title: "Fila conectada com sucesso!",
        description: `Instância conectada à fila "${selectedQueue?.name}"`,
      });

    } catch (error: any) {
      console.error('Erro ao conectar fila:', error);
      toast({
        title: "Erro ao conectar fila",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConnectingQueue(null);
    }
  };

  const handleDisconnectQueue = async (instanceId: string) => {
    setConnectingQueue(instanceId);
    try {
      const currentConnection = instanceConnections[instanceId];
      if (!currentConnection?.connectionId) return;

      await supabase
        .from('instance_queue_connections')
        .update({ is_active: false })
        .eq('id', currentConnection.connectionId);

      await loadQueuesAndConnections();
      
      toast({
        title: "Fila desconectada",
        description: "Instância desconectada da fila com sucesso",
      });

    } catch (error: any) {
      console.error('Erro ao desconectar fila:', error);
      toast({
        title: "Erro ao desconectar fila",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConnectingQueue(null);
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'text-blue-600';
      case 'standard': return 'text-green-600';
      case 'premium': return 'text-purple-600';
      case 'enterprise': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!clientData) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Cliente não encontrado. 
          <Button variant="link" onClick={() => navigate('/admin/clients')} className="ml-2">
            Voltar para clientes
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com informações do cliente */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Conexões WhatsApp - {clientData.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {clientData.email} • Plano: 
                <span className={`ml-1 font-medium ${getPlanColor(clientData.plan)}`}>
                  {clientData.plan.toUpperCase()}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {serverOnline ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <Wifi className="h-3 w-3 mr-1" />
                  Servidor Online
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Servidor Offline
                </Badge>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                Instâncias: {instances.length} / {clientData.max_instances}
              </div>
              <Progress 
                value={(instances.length / clientData.max_instances) * 100} 
                className="w-48 h-2"
              />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>{instances.filter(i => getInstanceStatus(i.instance_id).status === 'connected').length} Conectadas</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span>{instances.filter(i => ['connecting', 'qr_ready'].includes(getInstanceStatus(i.instance_id).status)).length} Conectando</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>{instances.filter(i => getInstanceStatus(i.instance_id).status === 'disconnected').length} Desconectadas</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão para criar nova instância */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Instâncias WhatsApp</h3>
        <Button 
          onClick={handleCreateInstance}
          disabled={!canCreateNewInstance() || creating || !serverOnline}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {creating ? 'Criando...' : 'Nova Instância'}
        </Button>
      </div>

      {!canCreateNewInstance() && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Limite de instâncias atingido ({clientData.max_instances}). 
            Atualize seu plano para criar mais instâncias.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de instâncias */}
      <div className="grid gap-4">
        {instances.map((instance) => {
          const statusInfo = getStatusInfo(instance);
          const instanceStatus = getInstanceStatus(instance.instance_id);
          const isConnecting = isInstanceLoading(instance.instance_id);

          return (
            <Card key={instance.id} className="relative">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {statusInfo.icon}
                        <Badge variant={statusInfo.variant} className="font-medium">
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <span className={`text-sm ${statusInfo.color}`}>
                        {statusInfo.description}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {editingName === instance.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="max-w-xs"
                            placeholder="Nome da instância"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleEditName(instance.id, newName)}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setEditingName(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            {instance.custom_name || instance.instance_id}
                          </h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingName(instance.id);
                              setNewName(instance.custom_name || instance.instance_id);
                            }}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <p className="text-sm text-gray-500">
                        ID: {instance.instance_id}
                      </p>
                      {instanceStatus.phoneNumber && (
                        <p className="text-sm text-gray-600 font-medium">
                          📱 {instanceStatus.phoneNumber}
                        </p>
                      )}
                    </div>

                    {/* Seção de Configuração de Fila */}
                    {instanceStatus.status === 'connected' && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Configuração de Fila</span>
                        </div>
                        
                        {instanceConnections[instance.instance_id] ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <Link className="h-3 w-3 mr-1" />
                                {instanceConnections[instance.instance_id].queueName}
                              </Badge>
                              <span className="text-xs text-gray-500">Auto-resposta ativa</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisconnectQueue(instance.instance_id)}
                              disabled={connectingQueue === instance.instance_id}
                            >
                              <Unlink className="h-3 w-3 mr-1" />
                              Desconectar
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Select onValueChange={(queueId) => handleConnectQueue(instance.instance_id, queueId)}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecionar fila para auto-resposta" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableQueues.map((queue) => (
                                  <SelectItem key={queue.id} value={queue.id}>
                                    <div className="flex items-center gap-2">
                                      <Bot className="h-3 w-3" />
                                      <span>{queue.name}</span>
                                      {queue.assistants && (
                                        <span className="text-xs text-gray-500">
                                          ({queue.assistants.name})
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {availableQueues.length === 0 && (
                              <p className="text-xs text-gray-500">
                                Nenhuma fila ativa com assistente disponível
                              </p>
                            )}
                            {connectingQueue === instance.instance_id && (
                              <p className="text-xs text-blue-600">Conectando fila...</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* QR Code Display */}
                  {instanceStatus.status === 'qr_ready' && instanceStatus.qrCode && (
                    <div className="ml-4">
                      <QRCodeDisplay qrCode={instanceStatus.qrCode} instanceName={instance.instance_id} />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  {instanceStatus.status === 'connected' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectInstance(instance.instance_id)}
                      disabled={isConnecting}
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Desconectar
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => connectInstance(instance.instance_id)}
                      disabled={isConnecting || !serverOnline}
                    >
                      {isConnecting ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3 mr-1" />
                      )}
                      {isConnecting ? 'Conectando...' : 'Conectar'}
                    </Button>
                  )}

                  {instanceStatus.status === 'connected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/client/${clientId}/chat/${instance.id}`)}
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Chat
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/client/${clientId}/queues?instance=${instance.id}`)}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Filas
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => manualSync(instance.instance_id)}
                    disabled={isConnecting}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Sync
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Excluir ${instance.custom_name || instance.instance_id}?`)) {
                        handleDeleteInstance(instance);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {instances.length === 0 && !loading && (
          <Card>
            <CardContent className="text-center py-12">
              <Smartphone className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma instância criada
              </h3>
              <p className="text-gray-500 mb-4">
                Crie sua primeira instância WhatsApp para começar
              </p>
              <Button 
                onClick={handleCreateInstance}
                disabled={!canCreateNewInstance() || creating}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Instância
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WhatsAppConnectionManagerV2;