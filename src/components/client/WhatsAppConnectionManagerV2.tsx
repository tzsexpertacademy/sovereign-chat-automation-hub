import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { QRCodeDisplay } from "@/components/ui/QRCodeDisplay";
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
    intervalMs: 15000
  });

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  useEffect(() => {
    startSync();
    return () => stopSync();
  }, [startSync, stopSync]);

  useEffect(() => {
    if (clientId && instances.length > 0) {
      const delay = setTimeout(() => {
        checkAndCreateAutoConnections(clientId);
      }, 2000);
      
      return () => clearTimeout(delay);
    }
  }, [clientId, instances.length, checkAndCreateAutoConnections]);

  const loadData = async () => {
    if (!clientId) return;
    
    setLoading(true);
    try {
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

      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      
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
      const queues = await queuesService.getClientQueues(clientId);
      const activeQueuesWithAssistants = queues.filter(q => 
        q.is_active && q.assistant_id && q.assistants?.is_active
      );
      setAvailableQueues(activeQueuesWithAssistants);

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
      
      const newInstance = await clientYumerService.createInstance(clientId, instanceName);
      
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
      await clientYumerService.deleteInstance(clientId, instance.instance_id);
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
          color: 'text-emerald-600',
          description: status.phoneNumber ? `📱 ${status.phoneNumber}` : 'WhatsApp ativo'
        };
      case 'connecting':
        return {
          icon: <Clock className="h-4 w-4 animate-spin" />,
          label: 'Conectando',
          variant: 'secondary' as const,
          color: 'text-amber-600',
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
      const instance = instances.find(i => i.instance_id === instanceId);
      if (!instance) throw new Error('Instância não encontrada');

      const { data: existingConnection } = await supabase
        .from('instance_queue_connections')
        .select('id, is_active')
        .eq('instance_id', instance.id)
        .eq('queue_id', queueId)
        .maybeSingle();

      if (existingConnection) {
        if (!existingConnection.is_active) {
          await supabase
            .from('instance_queue_connections')
            .update({ is_active: true })
            .eq('id', existingConnection.id);
        }
      } else {
        const currentConnection = instanceConnections[instanceId];
        if (currentConnection?.connectionId) {
          await supabase
            .from('instance_queue_connections')
            .update({ is_active: false })
            .eq('id', currentConnection.connectionId);
        }

        const { error } = await supabase
          .from('instance_queue_connections')
          .insert({
            instance_id: instance.id,
            queue_id: queueId,
            is_active: true
          });

        if (error) throw error;
      }

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
      case 'standard': return 'text-emerald-600';
      case 'premium': return 'text-purple-600';
      case 'enterprise': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-muted/50 rounded-lg animate-pulse" />
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
      {/* Header moderno com gradiente */}
      <Card className="bg-gradient-to-br from-background to-primary/5 border-0 shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Conexões WhatsApp
                  </span>
                  <div className="text-sm font-normal text-muted-foreground">
                    {clientData.name}
                  </div>
                </div>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{clientData.email}</span>
                <Badge variant="outline" className={`${getPlanColor(clientData.plan)} border-current`}>
                  {clientData.plan.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {serverOnline ? (
                <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  <Wifi className="h-3 w-3 mr-1" />
                  API Online
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                  <WifiOff className="h-3 w-3 mr-1" />
                  API Offline
                </Badge>
              )}
              <Badge variant="secondary" className="bg-secondary/50">
                <Smartphone className="h-3 w-3 mr-1" />
                {instances.length}/{clientData.max_instances}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Toolbar moderno */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <Alert className="flex-1 border-0 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            💡 Sincronização automática ativa - as instâncias são atualizadas em tempo real
          </AlertDescription>
        </Alert>
        
        <div className="flex gap-3 w-full lg:w-auto">
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            disabled={loading}
            className="flex-1 lg:flex-none hover:bg-primary/5 border-primary/20"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          {canCreateNewInstance() && (
            <Button
              onClick={handleCreateInstance}
              disabled={creating || !serverOnline}
              size="sm"
              className="flex-1 lg:flex-none bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              {creating ? 'Criando...' : 'Nova Instância'}
            </Button>
          )}
        </div>
      </div>

      {/* Grid responsivo de instâncias */}
      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {instances.map((instance) => {
          const statusInfo = getStatusInfo(instance);
          const isConnecting = isInstanceLoading(instance.instance_id);
          const instanceStatus = getInstanceStatus(instance.instance_id);
          const queueConnection = instanceConnections[instance.instance_id];
          
          return (
            <Card key={instance.id} className="group relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-card to-secondary/10 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    {editingName === instance.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="h-8 bg-background/80"
                          placeholder="Nome da instância"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleEditName(instance.id, newName)}
                          className="h-8 w-8 p-0"
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingName(null);
                            setNewName("");
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg cursor-pointer flex items-center gap-2 group-hover:text-primary transition-colors" 
                            onClick={() => {
                              setEditingName(instance.id);
                              setNewName(instance.custom_name || `Instância ${instances.indexOf(instance) + 1}`);
                            }}
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center text-xs font-bold">
                              {(instances.indexOf(instance) + 1)}
                            </div>
                            {instance.custom_name || `Instância ${instances.indexOf(instance) + 1}`}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono mt-1 text-muted-foreground/80">
                            {instance.instance_id}
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingName(instance.id);
                            setNewName(instance.custom_name || `Instância ${instances.indexOf(instance) + 1}`);
                          }}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <Badge 
                    variant={statusInfo.variant}
                    className={`${statusInfo.color} flex items-center gap-1 shadow-sm`}
                  >
                    {statusInfo.icon}
                    {statusInfo.label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 pt-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`font-medium ${statusInfo.color}`}>
                        {statusInfo.description}
                      </span>
                      {instanceStatus.phoneNumber && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {instanceStatus.phoneNumber}
                        </Badge>
                      )}
                    </div>

                    {/* Seção de Configuração de Fila */}
                    {instanceStatus.status === 'connected' && (
                      <div className="p-4 bg-gradient-to-r from-background to-secondary/20 rounded-lg border">
                        <div className="flex items-center gap-2 mb-3">
                          <Bot className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Auto-Resposta</span>
                        </div>
                        
                        {queueConnection ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-emerald-100 text-emerald-700">
                                <Link className="h-3 w-3 mr-1" />
                                {queueConnection.queueName}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Ativa</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisconnectQueue(instance.instance_id)}
                              disabled={connectingQueue === instance.instance_id}
                              className="h-7"
                            >
                              <Unlink className="h-3 w-3 mr-1" />
                              Desconectar
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Select onValueChange={(queueId) => handleConnectQueue(instance.instance_id, queueId)}>
                              <SelectTrigger className="h-8 bg-background/80">
                                <SelectValue placeholder="Selecionar fila..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableQueues.map((queue) => (
                                  <SelectItem key={queue.id} value={queue.id}>
                                    <div className="flex items-center gap-2">
                                      <Bot className="h-3 w-3" />
                                      <span>{queue.name}</span>
                                      {queue.assistants && (
                                        <span className="text-xs text-muted-foreground">
                                          ({queue.assistants.name})
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {availableQueues.length === 0 && (
                              <p className="text-xs text-muted-foreground">
                                Nenhuma fila ativa disponível
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* QR Code Display */}
                  {instanceStatus.status === 'qr_ready' && instanceStatus.qrCode && (
                    <div className="ml-4 flex-shrink-0">
                      <QRCodeDisplay 
                        qrCode={instanceStatus.qrCode} 
                        instanceName={instance.custom_name || instance.instance_id} 
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
                  {instanceStatus.status === 'connected' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectInstance(instance.instance_id)}
                      disabled={isConnecting}
                      className="hover:bg-red-50 hover:border-red-200"
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
                      className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
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
                      className="hover:bg-blue-50 hover:border-blue-200"
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Chat
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/client/${clientId}/queues?instance=${instance.id}`)}
                    className="hover:bg-primary/5 hover:border-primary/20"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Configurar
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Excluir ${instance.custom_name || instance.instance_id}?`)) {
                        handleDeleteInstance(instance);
                      }
                    }}
                    className="ml-auto"
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
          <Card className="text-center py-12 bg-gradient-to-br from-card to-secondary/10 col-span-full">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">
                  Nenhuma instância conectada
                </h3>
                <p className="text-muted-foreground mb-6">
                  Crie sua primeira instância WhatsApp para começar a receber e enviar mensagens
                </p>
              </div>
              <Button 
                onClick={handleCreateInstance}
                disabled={!canCreateNewInstance() || creating}
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                {creating ? 'Criando...' : 'Criar Primeira Instância'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WhatsAppConnectionManagerV2;