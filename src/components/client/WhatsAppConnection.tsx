import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QrCode, Smartphone, CheckCircle, AlertCircle, RefreshCw, Eye, WifiOff, Wifi, Plus, Settings, Users, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import whatsappService, { WhatsAppClient } from "@/services/whatsappMultiClient";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { queuesService, QueueWithAssistant } from "@/services/queuesService";

// Função para obter o limite máximo de instâncias por plano
const getMaxInstancesForPlan = (plan: string): number => {
  switch (plan) {
    case 'basic': return 1;
    case 'standard': return 3;
    case 'premium': return 10;
    case 'enterprise': return 50;
    default: return 1;
  }
};

const WhatsAppConnection = () => {
  const { clientId } = useParams();
  const [client, setClient] = useState<ClientData | null>(null);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [activeClients, setActiveClients] = useState<WhatsAppClient[]>([]);
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<WhatsAppClient | null>(null);
  const [selectedInstanceForQueue, setSelectedInstanceForQueue] = useState<string>("");
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (clientId) {
      initializeConnection();
      setupSocketListeners();
      loadClientData();
      loadQueues();
    }

    return () => {
      whatsappService.disconnectSocket();
    };
  }, [clientId]);

  const loadClientData = async () => {
    if (!clientId) return;
    
    try {
      const clients = await clientsService.getAllClients();
      const clientData = clients.find(c => c.id === clientId);
      setClient(clientData || null);

      const instancesData = await whatsappInstancesService.getInstancesByClientId(clientId);
      setInstances(instancesData);
    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
    }
  };

  const loadQueues = async () => {
    if (!clientId) return;
    
    try {
      const queuesData = await queuesService.getClientQueues(clientId);
      setQueues(queuesData);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
    }
  };

  const initializeConnection = async () => {
    if (!clientId) return;
    
    try {
      setLoading(true);
      setConnectionError(null);

      whatsappService.connectSocket();
      
      const clientsData = await whatsappService.getAllClients();
      const clientInstances = clientsData.filter(c => c.clientId.startsWith(clientId));
      setActiveClients(clientInstances);
      
      clientInstances.forEach(instance => {
        whatsappService.joinClientRoom(instance.clientId);
      });
      
    } catch (error: any) {
      console.error('Erro ao inicializar conexão:', error);
      setConnectionError(error.message || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    if (!clientId) return;

    whatsappService.onClientsUpdate((clients) => {
      const clientInstances = clients.filter(c => c.clientId.startsWith(clientId));
      setActiveClients(clientInstances);
      setConnectionError(null);
    });
  };

  const handleCreateNewInstance = async () => {
    if (!clientId || !client) return;

    const maxInstances = getMaxInstancesForPlan(client.plan);
    const currentInstanceCount = instances.length;

    console.log(`🔍 Verificando limites: Plano ${client.plan} - Atual: ${currentInstanceCount}/${maxInstances}`);

    if (currentInstanceCount >= maxInstances) {
      toast({
        title: "Limite Atingido",
        description: `Limite de ${maxInstances} instâncias atingido para o plano ${client.plan.toUpperCase()}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const instanceId = `${clientId}_${Date.now()}`;
      
      console.log(`🚀 Criando nova instância: ${instanceId}`);
      
      await whatsappInstancesService.createInstance({
        client_id: clientId,
        instance_id: instanceId,
        status: 'connecting'
      });

      await whatsappService.connectClient(instanceId);
      
      toast({
        title: "Nova Instância Criada",
        description: `Nova conexão WhatsApp criada (${currentInstanceCount + 1}/${maxInstances}). Aguarde o QR Code aparecer...`,
      });

      await loadClientData();
      await initializeConnection();

    } catch (error: any) {
      console.error('Erro ao criar nova instância:', error);
      setConnectionError(error.message || 'Erro ao criar nova instância');
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar nova instância WhatsApp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (instanceId: string) => {
    try {
      setLoading(true);
      setConnectionError(null);
      
      await whatsappService.connectClient(instanceId);
      
      toast({
        title: "Conexão Iniciada",
        description: "Aguarde o QR Code aparecer...",
      });

    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      setConnectionError(error.message || 'Erro ao conectar');
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar WhatsApp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (instanceId: string) => {
    try {
      setLoading(true);
      await whatsappService.disconnectClient(instanceId);
      
      toast({
        title: "Desconectado",
        description: "WhatsApp desconectado com sucesso",
      });
      
      await initializeConnection();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewQrCode = async (instanceId: string) => {
    try {
      const clientStatus = await whatsappService.getClientStatus(instanceId);
      setSelectedClient(clientStatus);
      setShowQrModal(true);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao buscar QR Code",
        variant: "destructive",
      });
    }
  };

  const handleConnectToQueue = async () => {
    if (!selectedInstanceForQueue || !selectedQueue) {
      toast({
        title: "Erro",
        description: "Selecione uma instância e uma fila",
        variant: "destructive",
      });
      return;
    }

    try {
      await queuesService.connectInstanceToQueue(selectedInstanceForQueue, selectedQueue);
      
      toast({
        title: "Sucesso",
        description: "Instância conectada à fila com sucesso",
      });

      setSelectedInstanceForQueue("");
      setSelectedQueue("");
      await loadQueues();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar à fila",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectFromQueue = async (instanceId: string, queueId: string) => {
    try {
      await queuesService.disconnectInstanceFromQueue(instanceId, queueId);
      
      toast({
        title: "Sucesso",
        description: "Instância desconectada da fila",
      });

      await loadQueues();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar da fila",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      case 'disconnected': return 'bg-gray-500';
      case 'error': case 'auth_failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'authenticated': return 'Autenticado';
      case 'disconnected': return 'Desconectado';
      case 'error': return 'Erro';
      case 'auth_failed': return 'Falha na Auth';
      default: return 'Desconhecido';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <Wifi className="w-6 h-6 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-6 h-6 text-blue-500" />;
      case 'connecting': return <RefreshCw className="w-6 h-6 text-yellow-500 animate-spin" />;
      case 'authenticated': return <Smartphone className="w-6 h-6 text-cyan-500" />;
      case 'disconnected': return <WifiOff className="w-6 h-6 text-gray-400" />;
      case 'error': case 'auth_failed': return <AlertCircle className="w-6 h-6 text-red-500" />;
      default: return <WifiOff className="w-6 h-6 text-gray-400" />;
    }
  };

  const getProgressValue = (status: string) => {
    switch (status) {
      case 'connecting': return 20;
      case 'qr_ready': return 50;
      case 'authenticated': return 80;
      case 'connected': return 100;
      default: return 0;
    }
  };

  const getConnectedQueues = (instanceId: string) => {
    return queues.filter(queue => 
      queue.instance_queue_connections?.some(conn => 
        conn.instance_id === instanceId && conn.is_active
      )
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Conexões WhatsApp</h1>
        <p className="text-gray-600">Gerencie suas conexões WhatsApp e configure as filas de atendimento</p>
      </div>

      {/* Plan Info & Stats */}
      {client && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium">Plano: {client.plan.toUpperCase()}</h3>
                <p className="text-sm text-gray-600">
                  {instances.length} / {getMaxInstancesForPlan(client.plan)} instâncias utilizadas
                </p>
                <div className="mt-2">
                  <Progress 
                    value={(instances.length / getMaxInstancesForPlan(client.plan)) * 100} 
                    className="w-64" 
                  />
                </div>
              </div>
              <div className="flex space-x-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {activeClients.filter(c => c.status === 'connected').length}
                  </div>
                  <p className="text-xs text-gray-600">Conectadas</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {activeClients.filter(c => c.status === 'qr_ready').length}
                  </div>
                  <p className="text-xs text-gray-600">Aguardando QR</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {activeClients.filter(c => c.status === 'connecting').length}
                  </div>
                  <p className="text-xs text-gray-600">Conectando</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Error Alert */}
      {connectionError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Problema de Conexão</p>
                <p className="text-sm text-red-700">{connectionError}</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={initializeConnection}
                  className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                >
                  Tentar Reconectar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="connections" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connections">Conexões WhatsApp</TabsTrigger>
          <TabsTrigger value="queues">Configuração de Filas</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-6">
          {/* Add New Instance */}
          {client && instances.length < getMaxInstancesForPlan(client.plan) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="w-5 h-5" />
                  <span>Adicionar Nova Conexão</span>
                </CardTitle>
                <CardDescription>
                  Você pode criar até {getMaxInstancesForPlan(client.plan)} conexões WhatsApp com seu plano {client.plan.toUpperCase()}
                  <br />
                  <span className="text-sm text-green-600">
                    Disponível: {getMaxInstancesForPlan(client.plan) - instances.length} de {getMaxInstancesForPlan(client.plan)} conexões
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleCreateNewInstance} disabled={loading}>
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Nova Conexão ({instances.length + 1}/{getMaxInstancesForPlan(client.plan)})
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Instance Limit Reached */}
          {client && instances.length >= getMaxInstancesForPlan(client.plan) && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="font-medium text-yellow-900">Limite de Instâncias Atingido</p>
                    <p className="text-sm text-yellow-700">
                      Você está utilizando todas as {getMaxInstancesForPlan(client.plan)} conexões disponíveis no plano {client.plan.toUpperCase()}.
                      {client.plan !== 'enterprise' && ' Entre em contato para fazer upgrade do seu plano.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* WhatsApp Instances */}
          <div className="grid lg:grid-cols-2 gap-6">
            {activeClients.length > 0 ? activeClients.map((clientInstance) => (
              <Card key={clientInstance.clientId} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <span>Instância {clientInstance.clientId.split('_').pop()}</span>
                      </CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Smartphone className="w-4 h-4 mr-1" />
                        {clientInstance.phoneNumber || 'Não conectado'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(clientInstance.status)}`} />
                      <Badge variant={clientInstance.status === 'connected' ? 'default' : 'secondary'}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(clientInstance.status)}
                          <span>{getStatusText(clientInstance.status)}</span>
                        </div>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progresso da Conexão</span>
                      <span>{getProgressValue(clientInstance.status)}%</span>
                    </div>
                    <Progress value={getProgressValue(clientInstance.status)} className="w-full" />
                  </div>

                  {/* Queue Status */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Filas Conectadas:</span>
                    </div>
                    {getConnectedQueues(clientInstance.clientId).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {getConnectedQueues(clientInstance.clientId).map((queue) => (
                          <Badge key={queue.id} variant="outline" className="text-xs">
                            {queue.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Interação Humana
                        </Badge>
                        <span className="text-xs text-gray-500">Sem fila configurada</span>
                      </div>
                    )}
                  </div>

                  {/* QR Code Display */}
                  {clientInstance.status === 'qr_ready' && clientInstance.hasQrCode && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800 mb-2">
                        📱 QR Code pronto! Escaneie com seu WhatsApp
                      </p>
                      <Button 
                        onClick={() => handleViewQrCode(clientInstance.clientId)}
                        size="sm"
                        variant="outline"
                        className="border-blue-300"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver QR Code
                      </Button>
                    </div>
                  )}

                  {/* Connected Info */}
                  {clientInstance.status === 'connected' && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        ✅ WhatsApp conectado e funcionando
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-2">
                    {clientInstance.status === 'connected' ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDisconnect(clientInstance.clientId)}
                        disabled={loading}
                      >
                        <WifiOff className="w-4 h-4 mr-1" />
                        Desconectar
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => handleConnect(clientInstance.clientId)}
                        disabled={loading || clientInstance.status === 'connecting'}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {clientInstance.status === 'connecting' ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                            Conectando...
                          </>
                        ) : (
                          <>
                            <Wifi className="w-4 h-4 mr-1" />
                            Conectar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className="lg:col-span-2">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma conexão criada</h3>
                    <p className="text-gray-600 mb-4">
                      Crie sua primeira conexão WhatsApp para começar
                    </p>
                    {client && (
                      <Button onClick={handleCreateNewInstance} disabled={loading}>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Primeira Conexão
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="queues" className="space-y-6">
          {/* Connect Instance to Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Conectar Instância à Fila</span>
              </CardTitle>
              <CardDescription>
                Configure qual fila de atendimento cada instância WhatsApp deve usar. 
                Instâncias sem fila ficam disponíveis para interação humana.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Instância WhatsApp</label>
                  <Select value={selectedInstanceForQueue} onValueChange={setSelectedInstanceForQueue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma instância..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeClients.filter(c => c.status === 'connected').map((instance) => (
                        <SelectItem key={instance.clientId} value={instance.clientId}>
                          <div className="flex items-center space-x-2">
                            <Smartphone className="w-4 h-4" />
                            <span>Instância {instance.clientId.split('_').pop()}</span>
                            {instance.phoneNumber && (
                              <span className="text-xs text-gray-500">({instance.phoneNumber})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Fila de Atendimento</label>
                  <Select value={selectedQueue} onValueChange={setSelectedQueue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma fila..." />
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
                    onClick={handleConnectToQueue}
                    disabled={!selectedInstanceForQueue || !selectedQueue}
                    className="w-full"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Conectar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Queue Connections Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações Atuais</CardTitle>
              <CardDescription>
                Visualize como suas instâncias WhatsApp estão configuradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeClients.filter(c => c.status === 'connected').map((instance) => {
                  const connectedQueues = getConnectedQueues(instance.clientId);
                  return (
                    <div key={instance.clientId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Smartphone className="w-5 h-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium">
                            Instância {instance.clientId.split('_').pop()}
                          </h4>
                          <p className="text-sm text-gray-600">{instance.phoneNumber}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        {connectedQueues.length > 0 ? (
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-green-500" />
                            <span className="text-sm">
                              {connectedQueues.map(q => q.name).join(', ')}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => connectedQueues.forEach(q => 
                                handleDisconnectFromQueue(instance.clientId, q.id)
                              )}
                            >
                              Desconectar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4 text-gray-500" />
                            <Badge variant="outline">Interação Humana</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {activeClients.filter(c => c.status === 'connected').length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Nenhuma instância conectada disponível</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR Code Modal */}
      {showQrModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">
                QR Code - Instância {selectedClient.clientId.split('_').pop()}
              </h3>
              
              {selectedClient.qrCode ? (
                <div className="space-y-4">
                  <img 
                    src={selectedClient.qrCode} 
                    alt="QR Code WhatsApp"
                    className="mx-auto border rounded max-w-full h-auto"
                  />
                  <p className="text-sm text-gray-600">
                    Escaneie este QR Code com seu WhatsApp para conectar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">
                    QR Code não disponível
                  </p>
                </div>
              )}
              
              <Button 
                onClick={() => setShowQrModal(false)}
                className="mt-4"
                variant="outline"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConnection;
