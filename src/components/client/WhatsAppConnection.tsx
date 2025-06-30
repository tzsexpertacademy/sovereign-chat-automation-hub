
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plus, 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Settings,
  Edit,
  Users,
  MessageSquare,
  Trash2,
  Clock
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import whatsappService, { WhatsAppClient } from "@/services/whatsappMultiClient";
import { clientsService, ClientData } from "@/services/clientsService";
import { queuesService, QueueWithAssistant } from "@/services/queuesService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";

const WhatsAppConnection = () => {
  const { clientId } = useParams();
  const { toast } = useToast();
  
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [editingInstance, setEditingInstance] = useState<WhatsAppInstanceData | null>(null);
  const [editName, setEditName] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [statusCheckError, setStatusCheckError] = useState<string>("");

  useEffect(() => {
    if (clientId) {
      loadData();
      setupRealtimeUpdates();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setStatusCheckError("");
      console.log('🔄 Carregando dados da conexão WhatsApp...');
      
      // Carregar dados do cliente
      const clientsData = await clientsService.getAllClients();
      const clientInfo = clientsData.find(c => c.id === clientId);
      setClientData(clientInfo || null);

      // Carregar instâncias do banco de dados
      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId!);
      console.log('📱 Instâncias do banco:', instancesData);

      // Para cada instância, verificar status real no servidor WhatsApp com timeout melhorado
      const instancesWithRealStatus = await Promise.allSettled(
        instancesData.map(async (instance) => {
          try {
            console.log(`📱 Verificando status para ${instance.instance_id}...`);
            const serverStatus = await whatsappService.getClientStatus(instance.instance_id);
            console.log(`📱 Status do servidor para ${instance.instance_id}:`, serverStatus);
            
            // Atualizar no banco se status for diferente
            if (serverStatus && serverStatus.status !== instance.status) {
              console.log(`📱 Atualizando status de ${instance.status} para ${serverStatus.status}`);
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
          } catch (error: any) {
            console.log(`❌ Erro ao verificar status para ${instance.instance_id}:`, error.message);
            
            // Se for timeout, manter status atual mas mostrar warning
            if (error.message === 'TIMEOUT_ERROR') {
              setStatusCheckError(`Timeout ao verificar status da instância ${instance.instance_id}. O servidor pode estar sobrecarregado.`);
            }
            
            return instance;
          }
        })
      );

      // Processar resultados do Promise.allSettled
      const finalInstances = instancesWithRealStatus.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Erro ao processar instância ${index}:`, result.reason);
          return instancesData[index]; // Retorna dados originais em caso de erro
        }
      });

      setInstances(finalInstances);

      // Carregar filas
      const queuesData = await queuesService.getClientQueues(clientId!);
      console.log('📋 Filas carregadas:', queuesData);
      setQueues(queuesData);

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados da conexão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeUpdates = () => {
    if (!clientId) return;

    // Configurar listener para atualizações de status via WebSocket
    const socket = whatsappService.connectSocket();
    
    socket.on('connect', () => {
      console.log('✅ WebSocket conectado para updates');
      whatsappService.joinClientRoom(clientId);
    });

    socket.on(`status_${clientId}`, (statusUpdate: any) => {
      console.log('📱 Status update recebido:', statusUpdate);
      
      setInstances(prev => prev.map(instance => {
        if (instance.instance_id === statusUpdate.instanceId) {
          return {
            ...instance,
            status: statusUpdate.status,
            phone_number: statusUpdate.phoneNumber || instance.phone_number
          };
        }
        return instance;
      }));
    });

    return () => {
      socket.disconnect();
    };
  };

  const canCreateNewInstance = () => {
    if (!clientData) return false;
    return instances.length < clientData.max_instances;
  };

  const handleCreateInstance = async () => {
    if (!clientId || !clientData) return;

    // Verificar limite de instâncias
    if (!canCreateNewInstance()) {
      toast({
        title: "Limite Atingido",
        description: `Seu plano ${clientData.plan.toUpperCase()} permite apenas ${clientData.max_instances} instância(s). Atualize seu plano para criar mais conexões.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setConnecting(true);
      console.log('🚀 Criando nova instância com timeout estendido...');
      
      // Gerar um instanceId único
      const newInstanceId = `${clientId}_${Date.now()}`;
      
      // Mostrar aviso sobre o tempo de conexão
      toast({
        title: "Conectando...",
        description: "Criando instância WhatsApp. Isso pode levar até 60 segundos...",
      });
      
      const result = await whatsappService.connectClient(newInstanceId);
      console.log('✅ Instância criada:', result);
      
      // Criar instância no Supabase
      await whatsappInstancesService.createInstance({
        client_id: clientId,
        instance_id: newInstanceId,
        status: 'connecting',
        custom_name: `Instância ${clientData.name || 'WhatsApp'}`
      });

      // Atualizar cliente se for a primeira instância
      if (instances.length === 0) {
        await clientsService.updateClientInstance(clientId, newInstanceId, 'connecting');
      }
      
      toast({
        title: "Sucesso",
        description: "Nova instância WhatsApp criada! Aguarde o QR Code aparecer...",
      });

      // Recarregar dados após um delay
      setTimeout(() => {
        loadData();
      }, 3000);

    } catch (error: any) {
      console.error('❌ Erro ao criar instância:', error);
      
      let errorMessage = "Falha ao criar instância WhatsApp";
      
      if (error.message === 'TIMEOUT_ERROR') {
        errorMessage = "Timeout: O servidor demorou mais de 60 segundos para responder. Tente novamente.";
      } else if (error.message.includes('CERTIFICADO_SSL')) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectToQueue = async (instanceId: string) => {
    if (!selectedQueueId) {
      toast({
        title: "Erro",
        description: "Selecione uma fila para conectar",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      console.log('🔗 Conectando instância à fila:', { instanceId, queueId: selectedQueueId });
      
      await queuesService.connectInstanceToQueue(instanceId, selectedQueueId);
      
      const isHuman = selectedQueueId === "human";
      const queueName = isHuman ? "Interação Humana" : queues.find(q => q.id === selectedQueueId)?.name;
      
      toast({
        title: "Sucesso",
        description: `Instância conectada à ${queueName}`,
      });

      setSelectedQueueId("");
      await loadData();
      
    } catch (error: any) {
      console.error('❌ Erro ao conectar à fila:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar à fila",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectFromQueue = async (instanceId: string, queueId: string) => {
    try {
      setLoading(true);
      
      await queuesService.disconnectInstanceFromQueue(instanceId, queueId);
      
      toast({
        title: "Sucesso",
        description: "Instância desconectada da fila",
      });

      await loadData();
      
    } catch (error: any) {
      console.error('❌ Erro ao desconectar:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar da fila",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditInstance = (instance: WhatsAppInstanceData) => {
    setEditingInstance(instance);
    setEditName(instance.custom_name || `Conexão ${instance.instance_id.split('_').pop()}`);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingInstance || !editName.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      console.log('💾 Salvando nome da instância:', { instanceId: editingInstance.instance_id, newName: editName.trim() });
      
      // Usar o ID da instância (UUID) para atualizar
      await whatsappInstancesService.updateInstanceById(editingInstance.id, {
        custom_name: editName.trim()
      });

      toast({
        title: "Sucesso",
        description: "Conexão atualizada com sucesso",
      });

      setShowEditDialog(false);
      setEditingInstance(null);
      await loadData();
      
    } catch (error: any) {
      console.error('❌ Erro ao editar:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar conexão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      setLoading(true);
      
      // Desconectar do WhatsApp
      await whatsappService.disconnectClient(instanceId);
      
      // Remover do Supabase
      await whatsappInstancesService.deleteInstance(instanceId);
      
      // Se era a instância principal do cliente, limpar
      if (clientData?.instance_id === instanceId) {
        await clientsService.updateClientInstance(clientId!, "", "disconnected");
      }
      
      toast({
        title: "Sucesso",
        description: "Instância removida com sucesso",
      });

      await loadData();
      
    } catch (error: any) {
      console.error('❌ Erro ao remover:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover instância",
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

  const getInstanceDisplayName = (instance: WhatsAppInstanceData) => {
    return instance.custom_name || `Instância ${instance.instance_id.split('_').pop()}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-5 h-5 text-blue-500" />;
      case 'connecting': return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'Aguardando QR';
      case 'connecting': return 'Conectando';
      case 'error': return 'Erro';
      case 'disconnected': return 'Desconectado';
      default: return status;
    }
  };

  if (loading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Carregando conexões...</p>
          <p className="text-sm text-gray-500 mt-1">Verificando status do servidor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Conexões WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões WhatsApp e configure as filas de atendimento
          </p>
          {clientData && (
            <p className="text-sm text-gray-500 mt-1">
              Plano {clientData.plan.toUpperCase()}: {instances.length} / {clientData.max_instances} conexões
            </p>
          )}
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            onClick={handleCreateInstance}
            disabled={connecting || !canCreateNewInstance()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {connecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Criando... (até 60s)
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conexão
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status Check Error Warning */}
      {statusCheckError && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-900">Aviso de Timeout</p>
                <p className="text-sm text-yellow-700">{statusCheckError}</p>
                <p className="text-xs text-yellow-600 mt-1">
                  Os dados podem estar desatualizados. Tente atualizar novamente em alguns segundos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Limit Warning */}
      {!canCreateNewInstance() && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="font-medium text-orange-900">Limite de Conexões Atingido</p>
                <p className="text-sm text-orange-700">
                  Seu plano {clientData?.plan.toUpperCase()} permite apenas {clientData?.max_instances} conexão(ões). 
                  Entre em contato para atualizar seu plano.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {instances.filter(i => i.status === 'connected').length}
                </div>
                <p className="text-sm text-gray-600">Conectadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <QrCode className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {instances.filter(i => i.status === 'qr_ready').length}
                </div>
                <p className="text-sm text-gray-600">Aguardando QR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {instances.filter(i => ['error', 'disconnected'].includes(i.status)).length}
                </div>
                <p className="text-sm text-gray-600">Com Problemas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Instance Info Card */}
      {instances.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Primeira Conexão WhatsApp</CardTitle>
            <CardDescription>
              Crie sua primeira conexão WhatsApp para começar a usar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Após criar a conexão, você poderá escanear o QR Code para conectar seu WhatsApp.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Instances List */}
      {instances.map((instance) => {
        const connections = getInstanceConnections(instance);
        const displayName = getInstanceDisplayName(instance);
        
        return (
          <Card key={instance.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                  <div>
                    <CardTitle className="text-lg">
                      {displayName}
                    </CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <Smartphone className="w-4 h-4 mr-1" />
                      {instance.phone_number || 'Não conectado'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={instance.status === 'connected' ? 'default' : 'secondary'}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(instance.status)}
                      <span className="capitalize">{getStatusLabel(instance.status)}</span>
                    </div>
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditInstance(instance)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso da Conexão</span>
                  <span>100%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full w-full"></div>
                </div>
              </div>

              {/* Queue Configuration */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  Filas Conectadas:
                </h4>
                
                {connections.length > 0 ? (
                  <div className="space-y-2">
                    {connections.map(connection => (
                      <div key={connection.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-green-600" />
                          <div>
                            <div className="font-medium text-green-800">{connection.name}</div>
                            {connection.assistants && (
                              <div className="text-xs text-green-600">
                                Assistente: {connection.assistants.name}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDisconnectFromQueue(instance.instance_id, connection.id)}
                          disabled={loading}
                        >
                          Desconectar
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Interação Humana - Sem fila configurada</span>
                    </div>
                  </div>
                )}

                {/* Connect to Queue */}
                <div className="flex space-x-2">
                  <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar fila..." />
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
                  <Button 
                    onClick={() => handleConnectToQueue(instance.instance_id)}
                    disabled={loading || !selectedQueueId}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Conectar
                  </Button>
                </div>
              </div>

              {/* WhatsApp Status */}
              {instance.status === 'connected' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-green-800">
                      ✅ WhatsApp conectado e funcionando
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteInstance(instance.instance_id)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Desconectar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Conexão</DialogTitle>
            <DialogDescription>
              Personalize as configurações da sua conexão WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome da Conexão</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Digite um nome para identificar esta conexão"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppConnection;
