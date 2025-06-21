
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Bot, 
  Users, 
  MessageSquare,
  Settings,
  Workflow,
  CheckCircle
} from "lucide-react";
import { queuesService, QueueWithAssistant } from "@/services/queuesService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";

interface QueueFlowManagerProps {
  clientId: string;
}

const QueueFlowManager = ({ clientId }: QueueFlowManagerProps) => {
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [queuesData, instancesData] = await Promise.all([
        queuesService.getClientQueues(clientId),
        whatsappInstancesService.getInstancesByClientId(clientId)
      ]);
      
      setQueues(queuesData);
      setInstances(instancesData.filter(i => i.status === 'connected'));
    } catch (error) {
      console.error('Erro ao carregar dados do fluxo:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInstanceDisplayName = (instance: WhatsAppInstanceData) => {
    return instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`;
  };

  const getFlowDescription = () => {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Como funciona o fluxo:</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>1. Mensagem chega na <strong>Instância WhatsApp</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              <span>2. É direcionada para a <strong>Fila</strong> configurada</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              <span>3. O <strong>Assistente</strong> da fila processa a mensagem</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              <span>4. Com base nos <strong>gatilhos</strong>, pode transferir para outra fila</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getConnectionStatus = () => {
    const connectedInstances = instances.length;
    const activeQueues = queues.filter(q => q.is_active).length;
    const queuesWithAssistants = queues.filter(q => q.assistant_id).length;
    const totalConnections = queues.reduce((total, queue) => 
      total + (queue.instance_queue_connections?.length || 0), 0
    );

    return {
      connectedInstances,
      activeQueues,
      queuesWithAssistants,
      totalConnections,
      isSystemReady: connectedInstances > 0 && activeQueues > 0 && totalConnections > 0
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Carregando fluxo do sistema...</p>
        </div>
      </div>
    );
  }

  const status = getConnectionStatus();

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Status do Sistema
          </CardTitle>
          <CardDescription>
            Verificação geral do funcionamento do sistema de filas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{status.connectedInstances}</div>
              <div className="text-sm text-gray-600">Instâncias Conectadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{status.activeQueues}</div>
              <div className="text-sm text-gray-600">Filas Ativas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{status.queuesWithAssistants}</div>
              <div className="text-sm text-gray-600">Assistentes Configurados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{status.totalConnections}</div>
              <div className="text-sm text-gray-600">Conexões Ativas</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {status.isSystemReady ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <Badge variant="default" className="bg-green-500">
                  Sistema Operacional
                </Badge>
                <span className="text-sm text-gray-600">
                  Todas as conexões estão funcionando
                </span>
              </>
            ) : (
              <>
                <Settings className="h-5 w-5 text-orange-500" />
                <Badge variant="secondary">
                  Configuração Necessária
                </Badge>
                <span className="text-sm text-gray-600">
                  Complete a configuração para ativar o sistema
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Flow Description */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Funcionamento</CardTitle>
          <CardDescription>
            Entenda como as mensagens fluem pelo sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {getFlowDescription()}
        </CardContent>
      </Card>

      {/* Current Connections Flow */}
      <Card>
        <CardHeader>
          <CardTitle>Mapeamento Atual das Conexões</CardTitle>
          <CardDescription>
            Visualização detalhada de como está configurado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {instances.map((instance) => {
              const connectedQueues = queues.filter(queue => 
                queue.instance_queue_connections?.some(conn => 
                  conn.instance_id === instance.id && conn.is_active
                )
              );

              return (
                <div key={instance.instance_id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-blue-500" />
                      <h4 className="font-medium">
                        {getInstanceDisplayName(instance)}
                      </h4>
                      <Badge variant="outline">{instance.phone_number}</Badge>
                    </div>
                  </div>

                  {connectedQueues.length > 0 ? (
                    <div className="space-y-2">
                      {connectedQueues.map((queue) => (
                        <div key={queue.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <Users className="h-4 w-4 text-purple-500" />
                          <span className="font-medium">{queue.name}</span>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          {queue.assistants ? (
                            <div className="flex items-center gap-1">
                              <Bot className="h-4 w-4 text-green-500" />
                              <span className="text-sm">{queue.assistants.name}</span>
                              <Badge variant="default" className="bg-green-500 text-xs">
                                Automatizado
                              </Badge>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-orange-500" />
                              <span className="text-sm">Atendimento Manual</span>
                              <Badge variant="secondary" className="text-xs">
                                Manual
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Configurado para interação humana direta</p>
                      <p className="text-xs">Sem processamento automatizado</p>
                    </div>
                  )}
                </div>
              );
            })}

            {instances.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Settings className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Nenhuma instância WhatsApp conectada</p>
                <p className="text-sm">Configure pelo menos uma instância para começar</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QueueFlowManager;
