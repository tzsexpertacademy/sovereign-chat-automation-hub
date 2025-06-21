
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  MessageSquare, 
  Settings, 
  Smartphone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queuesService, QueueWithAssistant } from "@/services/queuesService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";

interface QueueConnectionManagerProps {
  clientId: string;
  onConnectionChange?: () => void;
}

const QueueConnectionManager = ({ clientId, onConnectionChange }: QueueConnectionManagerProps) => {
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [selectedQueue, setSelectedQueue] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando dados de conexão...');
      
      const [queuesData, instancesData] = await Promise.all([
        queuesService.getClientQueues(clientId),
        whatsappInstancesService.getInstancesByClientId(clientId)
      ]);
      
      console.log('📊 Dados carregados:', { queues: queuesData.length, instances: instancesData.length });
      
      setQueues(queuesData);
      setInstances(instancesData.filter(i => i.status === 'connected'));
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados de filas e instâncias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
      console.log('🚀 Aplicando configuração:', { selectedInstance, selectedQueue });
      
      await queuesService.connectInstanceToQueue(selectedInstance, selectedQueue);
      
      const isHuman = selectedQueue === "human";
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
      console.error('❌ Erro ao aplicar configuração:', error);
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
      await queuesService.disconnectInstanceFromQueue(instanceId, queueId);
      
      toast({
        title: "Sucesso",
        description: "Instância desconectada da fila",
      });

      await loadData();
      onConnectionChange?.();
      
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar da fila",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInstanceConnections = (instanceId: string) => {
    return queues.filter(queue => 
      queue.instance_queue_connections?.some(conn => 
        conn.whatsapp_instances?.instance_id === instanceId && conn.is_active
      )
    );
  };

  const getQueueConnections = (queueId: string) => {
    const queue = queues.find(q => q.id === queueId);
    return queue?.instance_queue_connections?.filter(conn => conn.is_active).map(conn => 
      conn.whatsapp_instances?.instance_id
    ).filter(Boolean) || [];
  };

  if (loading && queues.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Configurar Conexão de Fila</span>
          </CardTitle>
          <CardDescription>
            Configure qual fila cada instância WhatsApp deve usar. 
            Instâncias sem fila ficam disponíveis para interação humana.
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
                  {instances.map((instance) => (
                    <SelectItem key={instance.instance_id} value={instance.instance_id}>
                      <div className="flex items-center space-x-2">
                        <Smartphone className="w-4 h-4" />
                        <span>Instância {instance.instance_id.split('_').pop()}</span>
                        {instance.phone_number && (
                          <span className="text-xs text-gray-500">({instance.phone_number})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
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
                      <span>Interação Humana (Sem Fila)</span>
                    </div>
                  </SelectItem>
                  {queues.map((queue) => (
                    <SelectItem key={queue.id} value={queue.id}>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4" />
                        <span>{queue.name}</span>
                        {queue.assistants && (
                          <span className="text-xs text-gray-500">({queue.assistants.name})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
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
            Visualize como suas instâncias WhatsApp estão configuradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {instances.map((instance) => {
              const connectedQueues = getInstanceConnections(instance.instance_id);
              return (
                <div key={instance.instance_id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="w-5 h-5 text-blue-500" />
                    <div>
                      <h4 className="font-medium">
                        Instância {instance.instance_id.split('_').pop()}
                      </h4>
                      <p className="text-sm text-gray-600">{instance.phone_number || 'Não conectado'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {connectedQueues.length > 0 ? (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <div className="text-sm">
                          <div className="font-medium">
                            {connectedQueues.map(q => q.name).join(', ')}
                          </div>
                          {connectedQueues[0]?.assistants && (
                            <div className="text-xs text-gray-500">
                              Assistente: {connectedQueues[0].assistants.name}
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
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Nenhuma instância conectada disponível</p>
                <p className="text-sm">Conecte pelo menos uma instância WhatsApp primeiro</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Queue Overview */}
      {queues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Visão Geral das Filas</CardTitle>
            <CardDescription>
              Status de cada fila e suas conexões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {queues.map((queue) => {
                const connections = getQueueConnections(queue.id);
                return (
                  <div key={queue.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-purple-500" />
                      <div>
                        <h4 className="font-medium">{queue.name}</h4>
                        <p className="text-sm text-gray-600">
                          {queue.assistants ? `Assistente: ${queue.assistants.name}` : 'Sem assistente'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge variant={connections.length > 0 ? "default" : "secondary"}>
                        {connections.length} instância(s) conectada(s)
                      </Badge>
                      {connections.length > 0 && (
                        <div className="text-xs text-gray-500">
                          {connections.map(c => c?.split('_').pop()).join(', ')}
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

export default QueueConnectionManager;
