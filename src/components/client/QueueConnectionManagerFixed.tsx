
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  MessageSquare, 
  Settings, 
  Smartphone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Bot,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queuesService, QueueWithAssistant } from "@/services/queuesService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import whatsappService from "@/services/whatsappMultiClient";

interface QueueConnectionManagerProps {
  clientId: string;
  onConnectionChange?: () => void;
}

interface ErrorState {
  type: 'loading' | 'connection' | 'data' | null;
  message: string;
}

const QueueConnectionManagerFixed = ({ clientId, onConnectionChange }: QueueConnectionManagerProps) => {
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [selectedQueue, setSelectedQueue] = useState("");
  const [error, setError] = useState<ErrorState>({ type: null, message: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (clientId) {
      loadData();
    }
  }, [clientId]);

  const logDebug = (message: string, data?: any) => {
    console.log(`🔗 [QUEUE-CONNECTION] ${message}`, data || '');
  };

  const loadData = async () => {
    try {
      setError({ type: null, message: '' });
      setLoading(true);
      logDebug('Iniciando carregamento de dados...');
      
      if (!clientId) {
        throw new Error('Cliente ID não fornecido');
      }

      const [queuesData, instancesData] = await Promise.all([
        queuesService.getClientQueues(clientId).catch(err => {
          logDebug('Erro ao carregar filas:', err);
          throw new Error(`Falha ao carregar filas: ${err.message}`);
        }),
        whatsappInstancesService.getInstancesByClientId(clientId).catch(err => {
          logDebug('Erro ao carregar instâncias:', err);
          throw new Error(`Falha ao carregar instâncias: ${err.message}`);
        })
      ]);
      
      logDebug('Dados carregados:', { 
        queues: queuesData.length, 
        instances: instancesData.length 
      });

      // Verificar status real das instâncias no servidor WhatsApp
      const instancesWithRealStatus = await Promise.all(
        instancesData.map(async (instance) => {
          try {
            const serverStatus = await whatsappService.getClientStatus(instance.instance_id);
            if (serverStatus && serverStatus.status !== instance.status) {
              logDebug(`Status atualizado para ${instance.instance_id}:`, {
                old: instance.status,
                new: serverStatus.status
              });
              
              // Atualizar status no banco
              await whatsappInstancesService.updateInstanceById(instance.id, {
                status: serverStatus.status,
                phone_number: serverStatus.phoneNumber || instance.phone_number
              });
              
              return {
                ...instance,
                status: serverStatus.status,
                phone_number: serverStatus.phoneNumber || instance.phone_number
              };
            }
            return instance;
          } catch (error) {
            logDebug(`Erro ao verificar status para ${instance.instance_id}:`, error);
            return instance;
          }
        })
      );
      
      const connectedInstances = instancesWithRealStatus.filter(i => i.status === 'connected');
      logDebug('Instâncias conectadas filtradas:', connectedInstances.length);
      
      setQueues(queuesData);
      setInstances(connectedInstances);
      
      if (queuesData.length === 0 && connectedInstances.length === 0) {
        setError({
          type: 'data',
          message: 'Nenhuma fila ou instância conectada encontrada. Configure primeiro suas filas e conecte uma instância WhatsApp.'
        });
      }
      
    } catch (error: any) {
      logDebug('Erro no carregamento:', error);
      setError({
        type: 'connection',
        message: error.message || 'Falha ao carregar dados de filas e instâncias'
      });
      
      toast({
        title: "Erro",
        description: error.message || "Falha ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedInstance || !selectedQueue) {
      toast({
        title: "Erro",
        description: "Selecione uma instância e uma configuração",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      logDebug('Aplicando configuração:', { selectedInstance, selectedQueue });
      
      await queuesService.connectInstanceToQueue(selectedInstance, selectedQueue);
      
      const isHuman = selectedQueue === "human";
      logDebug('Configuração aplicada:', { isHuman });
      
      toast({
        title: "Sucesso",
        description: isHuman 
          ? "Instância configurada para interação humana" 
          : "Instância conectada à fila com sucesso",
      });

      setSelectedInstance("");
      setSelectedQueue("");
      await loadData();
      onConnectionChange?.();
      
    } catch (error: any) {
      logDebug('Erro ao aplicar configuração:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao aplicar configuração",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (instanceId: string, queueId: string) => {
    try {
      setLoading(true);
      logDebug('Desconectando:', { instanceId, queueId });
      
      await queuesService.disconnectInstanceFromQueue(instanceId, queueId);
      
      toast({
        title: "Sucesso",
        description: "Instância desconectada da fila",
      });

      await loadData();
      onConnectionChange?.();
      
    } catch (error: any) {
      logDebug('Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar da fila",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInstanceConnections = (instance: WhatsAppInstanceData) => {
    return queues.filter(queue => 
      queue.instance_queue_connections?.some(conn => 
        conn.instance_id === instance.id && conn.is_active
      )
    );
  };

  const getQueueConnections = (queueId: string) => {
    const queue = queues.find(q => q.id === queueId);
    return queue?.instance_queue_connections?.filter(conn => conn.is_active) || [];
  };

  const getInstanceDisplayName = (instance: WhatsAppInstanceData) => {
    return instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`;
  };

  // Estados de loading e erro
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Carregando sistema de filas...</p>
        </div>
      </div>
    );
  }

  if (error.type === 'connection') {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (error.type === 'data') {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recarregar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com status da integração */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Sistema de Filas</h2>
          <p className="text-muted-foreground">
            Configure conexões entre instâncias WhatsApp e assistentes IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={queues.length > 0 && instances.length > 0 ? "default" : "secondary"}>
            <Activity className="w-3 h-3 mr-1" />
            {queues.length > 0 && instances.length > 0 ? 'Sistema Ativo' : 'Aguardando Setup'}
          </Badge>
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queues.filter(q => q.is_active).length}</div>
            <p className="text-xs text-muted-foreground">
              de {queues.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instâncias Conectadas</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{instances.length}</div>
            <p className="text-xs text-muted-foreground">
              WhatsApp ativo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assistentes IA</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queues.filter(q => q.assistants).length}
            </div>
            <p className="text-xs text-muted-foreground">
              configurados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Configurar Conexão</span>
          </CardTitle>
          <CardDescription>
            Configure qual fila cada instância WhatsApp deve usar para processamento automático.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Instância WhatsApp</label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância..." />
                </SelectTrigger>
                <SelectContent>
                  {instances.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhuma instância conectada
                    </SelectItem>
                  ) : (
                    instances.map((instance) => (
                      <SelectItem key={instance.instance_id} value={instance.instance_id}>
                        <div className="flex items-center space-x-2">
                          <Smartphone className="w-4 h-4" />
                          <span>{getInstanceDisplayName(instance)}</span>
                          {instance.phone_number && (
                            <span className="text-xs text-gray-500">({instance.phone_number})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Configuração</label>
              <Select value={selectedQueue} onValueChange={setSelectedQueue}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma opção..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="human">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>Interação Humana (Sem IA)</span>
                    </div>
                  </SelectItem>
                  {queues.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhuma fila disponível
                    </SelectItem>
                  ) : (
                    queues.map((queue) => (
                      <SelectItem key={queue.id} value={queue.id}>
                        <div className="flex items-center space-x-2">
                          <Bot className="w-4 h-4" />
                          <span>{queue.name}</span>
                          {queue.assistants && (
                            <span className="text-xs text-gray-500">({queue.assistants.name})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleConnect}
                disabled={loading || !selectedInstance || !selectedQueue}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 mr-2" />
                    Aplicar Configuração
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Connections */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações Atuais</CardTitle>
          <CardDescription>
            Status das conexões entre instâncias WhatsApp e filas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {instances.map((instance) => {
              const connectedQueues = getInstanceConnections(instance);
              return (
                <div key={instance.instance_id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      instance.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <Smartphone className="w-5 h-5 text-blue-500" />
                    <div>
                      <h4 className="font-medium">
                        {getInstanceDisplayName(instance)}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {instance.phone_number || 'Não conectado'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {connectedQueues.length > 0 ? (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <div className="text-sm">
                          <div className="font-medium flex items-center space-x-1">
                            <Bot className="w-3 h-3" />
                            <span>{connectedQueues.map(q => q.name).join(', ')}</span>
                          </div>
                          {connectedQueues[0]?.assistants && (
                            <div className="text-xs text-muted-foreground">
                              IA: {connectedQueues[0].assistants.name}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => connectedQueues.forEach(q => 
                            handleDisconnect(instance.instance_id, q.id)
                          )}
                          disabled={loading}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Desconectar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-gray-500" />
                        <Badge variant="outline">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Interação Humana
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {instances.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                <p>Nenhuma instância WhatsApp conectada</p>
                <p className="text-sm">Conecte uma instância WhatsApp primeiro</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Queue Overview */}
      {queues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filas Disponíveis</CardTitle>
            <CardDescription>
              Status de cada fila e suas conexões ativas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {queues.map((queue) => {
                const connections = getQueueConnections(queue.id);
                const hasAssistant = !!queue.assistants;
                return (
                  <div key={queue.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                    <div className="flex items-center space-x-3">
                      <Bot className="w-5 h-5 text-purple-500" />
                      <div>
                        <h4 className="font-medium flex items-center space-x-2">
                          <span>{queue.name}</span>
                          {hasAssistant && (
                            <Badge variant="secondary" className="text-xs">
                              <Bot className="w-3 h-3 mr-1" />
                              IA Ativa
                            </Badge>
                          )}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {queue.assistants ? `Assistente: ${queue.assistants.name}` : 'Sem assistente configurado'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge variant={connections.length > 0 ? "default" : "secondary"}>
                        {connections.length} instância(s)
                      </Badge>
                      {connections.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {connections.map(c => {
                            const instance = instances.find(i => i.id === c.instance_id);
                            return getInstanceDisplayName(instance!);
                          }).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QueueConnectionManagerFixed;
