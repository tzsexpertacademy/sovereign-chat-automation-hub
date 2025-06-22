
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Play, 
  Pause, 
  RotateCcw, 
  Trash2, 
  QrCode, 
  Smartphone, 
  Wifi,
  WifiOff,
  RefreshCw,
  Eye,
  MessageSquare,
  AlertCircle,
  User,
  Link,
  Filter,
  Database
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import whatsappService, { WhatsAppClient } from "@/services/whatsappMultiClient";
import WhatsAppSystemStatus from "./WhatsAppSystemStatus";
import ConnectionTest from "./ConnectionTest";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";

const RealInstancesManager = () => {
  const [clients, setClients] = useState<WhatsAppClient[]>([]);
  const [availableClients, setAvailableClients] = useState<ClientData[]>([]);
  const [databaseInstances, setDatabaseInstances] = useState<WhatsAppInstanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedClientForInstance, setSelectedClientForInstance] = useState("");
  const [selectedClient, setSelectedClient] = useState<WhatsAppClient | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [filterByClient, setFilterByClient] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadAvailableClients();
    initializeService();
    loadClients();
    loadDatabaseInstances();

    // Check if there's a clientId in URL params
    const clientIdFromUrl = searchParams.get('clientId');
    if (clientIdFromUrl) {
      setFilterByClient(clientIdFromUrl);
    }

    return () => {
      whatsappService.disconnectSocket();
    };
  }, [searchParams]);

  const loadAvailableClients = async () => {
    try {
      const clientsData = await clientsService.getAllClients();
      setAvailableClients(clientsData);
      console.log('Clientes carregados do Supabase:', clientsData);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadDatabaseInstances = async () => {
    try {
      if (filterByClient && filterByClient !== "all-clients") {
        const instances = await whatsappInstancesService.getInstancesByClientId(filterByClient);
        setDatabaseInstances(instances);
        console.log('Instâncias do banco carregadas:', instances);
      } else {
        setDatabaseInstances([]);
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias do banco:', error);
    }
  };

  useEffect(() => {
    loadDatabaseInstances();
  }, [filterByClient]);

  const syncClientInstanceCount = async (clientId: string) => {
    try {
      // Get actual instances from Supabase
      const instances = await whatsappInstancesService.getInstancesByClientId(clientId);
      const actualCount = instances.length;
      
      // Update client current_instances count
      await clientsService.updateClient(clientId, {
        current_instances: actualCount
      });
      
      console.log(`🔄 Sincronizada contagem de instâncias para cliente ${clientId}: ${actualCount}`);
      
      // Update local state
      setAvailableClients(prev => 
        prev.map(client => 
          client.id === clientId 
            ? { ...client, current_instances: actualCount }
            : client
        )
      );

      // Reload database instances
      await loadDatabaseInstances();
    } catch (error) {
      console.error('Erro ao sincronizar contagem de instâncias:', error);
    }
  };

  const updateClientInstance = async (clientId: string, instanceId: string, status: string) => {
    try {
      await clientsService.updateClientInstance(clientId, instanceId, status);
      
      // Sync instance count after update
      await syncClientInstanceCount(clientId);
      
      // Update local state
      setAvailableClients(prev => 
        prev.map(client => 
          client.id === clientId 
            ? { ...client, instance_id: instanceId, instance_status: status, last_activity: new Date().toISOString() }
            : client
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
    }
  };

  const getClientByInstanceId = (instanceId: string) => {
    return availableClients.find(client => client.instance_id === instanceId);
  };

  const initializeService = () => {
    try {
      // Conectar ao WebSocket
      whatsappService.connectSocket();

      // Ouvir atualizações de todos os clientes
      whatsappService.onClientsUpdate((updatedClients) => {
        console.log("📥 Recebidos clientes atualizados:", updatedClients);
        setClients(updatedClients);
        
        // Update client statuses in Supabase
        updatedClients.forEach(client => {
          const linkedClient = getClientByInstanceId(client.clientId);
          if (linkedClient) {
            updateClientInstance(linkedClient.id, client.clientId, client.status);
          }
        });
        
        setConnectionError(null);
      });

      setConnectionError(null);
    } catch (error) {
      console.error("❌ Erro ao inicializar serviço:", error);
      setConnectionError("Erro ao conectar ao servidor WebSocket");
    }
  };

  const loadClients = async () => {
    try {
      setLoading(true);
      setConnectionError(null);
      
      // Primeiro teste a conexão
      const isConnected = await whatsappService.testConnection();
      if (!isConnected) {
        throw new Error("Servidor não está respondendo");
      }

      const clientsData = await whatsappService.getAllClients();
      console.log("✅ Clientes carregados:", clientsData);
      setClients(clientsData);
      setConnectionError(null);
    } catch (error: any) {
      console.error("❌ Erro ao carregar clientes:", error);
      setConnectionError(error.message || "Erro ao conectar com o servidor");
      setClients([]); // Limpar lista em caso de erro
      
      toast({
        title: "Problema de Conexão",
        description: "Verificando conexão com o servidor...",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handleCreateClient = async () => {
    if (!selectedClientForInstance) {
      toast({
        title: "Erro",
        description: "Selecione um cliente para criar a instância",
        variant: "destructive",
      });
      return;
    }

    const clientData = availableClients.find(c => c.id === selectedClientForInstance);
    if (!clientData) {
      toast({
        title: "Erro",
        description: "Cliente não encontrado",
        variant: "destructive",
      });
      return;
    }

    // Check current instance count vs limit
    if ((clientData.current_instances || 0) >= clientData.max_instances) {
      toast({
        title: "Limite Atingido",
        description: `Limite de ${clientData.max_instances} instâncias atingido para o plano ${clientData.plan}`,
        variant: "destructive",
      });
      return;
    }

    // Generate unique instance ID
    const instanceId = `${clientData.id}_instance_${Date.now()}`;

    // Verificar se já existe uma instância com esse ID no servidor
    const existingClient = clients.find(c => c.clientId === instanceId);
    if (existingClient) {
      toast({
        title: "Erro",
        description: `Instância ${instanceId} já existe no servidor`,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      console.log(`🚀 Criando instância para cliente: ${clientData.name} (${instanceId})`);
      
      const result = await whatsappService.connectClient(instanceId);
      console.log("✅ Resultado da criação:", result);
      
      // Create instance in Supabase
      await whatsappInstancesService.createInstance({
        client_id: clientData.id,
        instance_id: instanceId,
        status: 'connecting'
      });
      
      // Update client with instance info and sync count
      await updateClientInstance(clientData.id, instanceId, 'connecting');
      
      // Ouvir status deste cliente específico
      whatsappService.joinClientRoom(instanceId);
      whatsappService.onClientStatus(instanceId, async (clientData) => {
        console.log(`📱 Status atualizado para ${instanceId}:`, clientData);
        setClients(prev => {
          const index = prev.findIndex(c => c.clientId === clientData.clientId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = clientData;
            return updated;
          } else {
            return [...prev, clientData];
          }
        });
        
        // Update client status in Supabase
        const linkedClient = getClientByInstanceId(clientData.clientId);
        if (linkedClient) {
          await updateClientInstance(linkedClient.id, clientData.clientId, clientData.status);
        }

        // Update instance in Supabase
        try {
          await whatsappInstancesService.updateInstance(clientData.clientId, {
            status: clientData.status,
            phone_number: clientData.phoneNumber,
            has_qr_code: clientData.hasQrCode
          });
        } catch (error) {
          console.error('Erro ao atualizar instância no Supabase:', error);
        }
      });

      setSelectedClientForInstance("");
      toast({
        title: "Sucesso",
        description: `Instância criada para ${clientData.name}! Aguarde o QR Code aparecer...`,
      });

      // Recarregar a lista de clientes após 2 segundos
      setTimeout(() => {
        loadClients();
        loadAvailableClients();
        loadDatabaseInstances();
      }, 2000);

    } catch (error: any) {
      console.error("❌ Erro ao criar instância:", error);
      toast({
        title: "Erro ao Criar Instância",
        description: error.message || "Falha ao criar instância. Verifique se o servidor está rodando.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    try {
      setLoading(true);
      await whatsappService.connectClient(instanceId);
      
      toast({
        title: "Sucesso",
        description: `Conectando instância ${instanceId}...`,
      });
      
      await loadClients();
      await loadDatabaseInstances();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectClient = async (clientId: string) => {
    try {
      setLoading(true);
      await whatsappService.disconnectClient(clientId);
      
      // Update client status
      const linkedClient = getClientByInstanceId(clientId);
      if (linkedClient) {
        await updateClientInstance(linkedClient.id, clientId, 'disconnected');
      }

      // Update instance in Supabase
      try {
        await whatsappInstancesService.updateInstance(clientId, {
          status: 'disconnected'
        });
      } catch (error) {
        console.error('Erro ao atualizar instância no Supabase:', error);
      }
      
      toast({
        title: "Sucesso",
        description: `Instância ${clientId} desconectada`,
      });
      
      await loadClients();
      await loadDatabaseInstances();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      setLoading(true);
      
      // First try to disconnect from server
      try {
        await whatsappService.disconnectClient(instanceId);
      } catch (error) {
        console.log('Instância não estava conectada no servidor');
      }
      
      // Delete from database
      await whatsappInstancesService.deleteInstance(instanceId);
      
      // Update client instance count
      const dbInstance = databaseInstances.find(i => i.instance_id === instanceId);
      if (dbInstance) {
        await syncClientInstanceCount(dbInstance.client_id);
      }
      
      toast({
        title: "Sucesso",
        description: `Instância ${instanceId} removida`,
      });
      
      await loadClients();
      await loadDatabaseInstances();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = (clientId: string) => {
    const linkedClient = getClientByInstanceId(clientId);
    if (linkedClient) {
      navigate(`/client/${linkedClient.id}/chat`);
    } else {
      toast({
        title: "Cliente não encontrado",
        description: "Esta instância não está associada a nenhum cliente",
        variant: "destructive",
      });
    }
  };

  const handleViewQrCode = async (clientId: string) => {
    try {
      const clientStatus = await whatsappService.getClientStatus(clientId);
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

  const handleRestartClient = async (clientId: string) => {
    try {
      setLoading(true);
      await whatsappService.disconnectClient(clientId);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2s
      await whatsappService.connectClient(clientId);
      
      toast({
        title: "Sucesso",
        description: `Instância ${clientId} reiniciada`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao reiniciar instância",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'qr_ready': return <QrCode className="w-4 h-4" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'authenticated': return <Smartphone className="w-4 h-4" />;
      case 'disconnected': return <WifiOff className="w-4 h-4" />;
      case 'error': case 'auth_failed': return <WifiOff className="w-4 h-4" />;
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  // Get clients without instances - check against actual database instances, not just client fields
  const clientsWithoutInstances = availableClients.filter(client => {
    const currentCount = client.current_instances || 0;
    const maxCount = client.max_instances || 1;
    return currentCount < maxCount;
  });

  // Filter clients by selected client
  const filteredClients = filterByClient 
    ? clients.filter(client => {
        const linkedClient = getClientByInstanceId(client.clientId);
        return linkedClient?.id === filterByClient;
      })
    : clients;

  // Filter database instances by selected client
  const filteredDatabaseInstances = filterByClient && filterByClient !== "all-clients"
    ? databaseInstances
    : [];

  // Get selected client info for display
  const selectedClientInfo = filterByClient 
    ? availableClients.find(c => c.id === filterByClient)
    : null;

  // Combine server instances and database-only instances
  const allInstances = [
    ...filteredClients.map(client => ({ ...client, source: 'server' })),
    ...filteredDatabaseInstances
      .filter(dbInstance => !filteredClients.find(serverClient => serverClient.clientId === dbInstance.instance_id))
      .map(dbInstance => ({
        clientId: dbInstance.instance_id,
        status: dbInstance.status || 'disconnected',
        phoneNumber: dbInstance.phone_number,
        hasQrCode: dbInstance.has_qr_code || false,
        source: 'database',
        dbInstance
      }))
  ];

  // Loading inicial
  if (initialLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600">Carregando sistema WhatsApp...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Multi-Cliente Real</h1>
          <p className="text-gray-600">Gerencie conexões WhatsApp reais para múltiplos clientes</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadClients} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {selectedClientInfo && (
            <Button 
              onClick={() => syncClientInstanceCount(selectedClientInfo.id)} 
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar Dados
            </Button>
          )}
        </div>
      </div>

      {/* Connection Test */}
      <ConnectionTest />

      {/* System Status */}
      <WhatsAppSystemStatus />

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
                  onClick={loadClients}
                  className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                >
                  Tentar Reconectar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filtrar por Cliente</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 items-center">
            <Select value={filterByClient} onValueChange={setFilterByClient}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-clients">Todos os clientes</SelectItem>
                {availableClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} ({client.email}) - {client.current_instances || 0}/{client.max_instances} instâncias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClientInfo && (
              <Badge variant="outline" className="bg-blue-50">
                {selectedClientInfo.name} - {selectedClientInfo.current_instances || 0}/{selectedClientInfo.max_instances} instâncias
              </Badge>
            )}
            {filterByClient && filterByClient !== "all-clients" && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setFilterByClient("")}
              >
                Limpar Filtro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Instâncias no Servidor {selectedClientInfo ? `(${selectedClientInfo.name})` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredClients.length}</div>
            <p className="text-xs text-gray-500">Conectadas ao servidor WhatsApp</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Instâncias no BD {selectedClientInfo ? `(${selectedClientInfo.name})` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {selectedClientInfo ? (selectedClientInfo.current_instances || 0) : 
               availableClients.reduce((sum, c) => sum + (c.current_instances || 0), 0)}
            </div>
            <p className="text-xs text-blue-600">Registradas no banco</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {allInstances.filter(i => i.status === 'connected').length}
            </div>
            <p className="text-xs text-green-600">Online</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Desconectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {allInstances.filter(i => ['disconnected', 'error', 'auth_failed'].includes(i.status)).length}
            </div>
            <p className="text-xs text-red-600">Requerem atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Add New Instance for Client */}
      {(!filterByClient || filterByClient === "all-clients" || (selectedClientInfo && (selectedClientInfo.current_instances || 0) < selectedClientInfo.max_instances)) && (
        <Card>
          <CardHeader>
            <CardTitle>🚀 Criar Instância WhatsApp para Cliente</CardTitle>
            <CardDescription>
              Selecione um cliente cadastrado para criar uma nova instância WhatsApp.
              {selectedClientInfo && (
                <div className="mt-2 text-sm">
                  <Badge variant="outline">
                    {selectedClientInfo.name}: {selectedClientInfo.current_instances || 0}/{selectedClientInfo.max_instances} instâncias
                  </Badge>
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <Select 
                value={selectedClientForInstance} 
                onValueChange={setSelectedClientForInstance}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientsWithoutInstances.length === 0 ? (
                    <SelectItem value="no-clients-available" disabled>
                      Todos os clientes atingiram o limite de instâncias
                    </SelectItem>
                  ) : (
                    clientsWithoutInstances
                      .filter(client => !filterByClient || filterByClient === "all-clients" || client.id === filterByClient)
                      .map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4" />
                            <span>{client.name} ({client.current_instances || 0}/{client.max_instances})</span>
                          </div>
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleCreateClient}
                disabled={loading || !selectedClientForInstance || selectedClientForInstance === "no-clients-available" || !!connectionError}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Instância
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instances Grid */}
      {allInstances.length > 0 ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {allInstances.map((instance) => {
            const linkedClient = getClientByInstanceId(instance.clientId);
            const isFromDatabase = instance.source === 'database';
            
            return (
              <Card key={instance.clientId} className={`hover:shadow-lg transition-shadow ${isFromDatabase ? 'border-blue-200 bg-blue-50' : ''}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <span>{instance.clientId}</span>
                        {linkedClient && <Link className="w-4 h-4 text-green-500" />}
                        {isFromDatabase && <Database className="w-4 h-4 text-blue-500" />}
                      </CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Smartphone className="w-4 h-4 mr-1" />
                        {instance.phoneNumber || 'Não conectado'}
                      </CardDescription>
                      {linkedClient && (
                        <CardDescription className="flex items-center mt-1 text-green-600">
                          <User className="w-4 h-4 mr-1" />
                          Cliente: {linkedClient.name}
                        </CardDescription>
                      )}
                      {isFromDatabase && (
                        <CardDescription className="flex items-center mt-1 text-blue-600">
                          <Database className="w-4 h-4 mr-1" />
                          Apenas no banco de dados
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={instance.status === 'connected' ? 'default' : 'secondary'}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(instance.status)}
                          <span>{getStatusText(instance.status)}</span>
                        </div>
                      </Badge>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Info */}
                  <div className="text-sm text-gray-600">
                    <p><strong>Status:</strong> {getStatusText(instance.status)}</p>
                    {instance.phoneNumber && <p><strong>Telefone:</strong> {instance.phoneNumber}</p>}
                    {instance.hasQrCode && <p className="text-blue-600"><strong>QR Code disponível</strong></p>}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {isFromDatabase && instance.status === 'disconnected' && (
                      <Button
                        size="sm"
                        onClick={() => handleConnectInstance(instance.clientId)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Conectar
                      </Button>
                    )}
                    
                    {instance.status === 'qr_ready' && !isFromDatabase && (
                      <Button
                        size="sm"
                        onClick={() => handleViewQrCode(instance.clientId)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        Ver QR Code
                      </Button>
                    )}
                    
                    {instance.status === 'connected' && linkedClient && !isFromDatabase && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenChat(instance.clientId)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Abrir Chat
                      </Button>
                    )}
                    
                    {!isFromDatabase && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestartClient(instance.clientId)}
                        disabled={loading}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reiniciar
                      </Button>
                    )}
                    
                    {!isFromDatabase && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDisconnectClient(instance.clientId)}
                        disabled={loading}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Desconectar
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteInstance(instance.clientId)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {selectedClientInfo 
                  ? `Nenhuma instância WhatsApp ativa para ${selectedClientInfo.name}`
                  : "Nenhuma instância WhatsApp ativa no servidor"
                }
              </h3>
              <p className="text-gray-600 mb-4">
                {selectedClientInfo 
                  ? `Banco de dados mostra ${selectedClientInfo.current_instances || 0} instância(s), mas nenhuma conectada ao servidor WhatsApp`
                  : "Crie uma instância para começar a usar o WhatsApp"
                }
              </p>
              {selectedClientInfo && (
                <Button 
                  onClick={() => syncClientInstanceCount(selectedClientInfo.id)} 
                  variant="outline"
                  className="mr-2"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sincronizar Dados
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RealInstancesManager;
