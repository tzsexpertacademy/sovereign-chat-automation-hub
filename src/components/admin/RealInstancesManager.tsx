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
  Link
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import whatsappService, { WhatsAppClient } from "@/services/whatsappMultiClient";
import WhatsAppSystemStatus from "./WhatsAppSystemStatus";
import ConnectionTest from "./ConnectionTest";
import SystemHealthMonitor from "./SystemHealthMonitor";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService } from "@/services/whatsappInstancesService";

const RealInstancesManager = () => {
  const [clients, setClients] = useState<WhatsAppClient[]>([]);
  const [availableClients, setAvailableClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedClientForInstance, setSelectedClientForInstance] = useState("");
  const [selectedClient, setSelectedClient] = useState<WhatsAppClient | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadAvailableClients();
    initializeService();
    loadClients();

    return () => {
      whatsappService.disconnectSocket();
    };
  }, []);

  const loadAvailableClients = async () => {
    try {
      const clientsData = await clientsService.getAllClients();
      setAvailableClients(clientsData);
      console.log('Clientes carregados do Supabase:', clientsData);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const updateClientInstance = async (clientId: string, instanceId: string, status: string) => {
    try {
      await clientsService.updateClientInstance(clientId, instanceId, status);
      
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

    // Check if client already has an instance
    if (clientData.instance_id) {
      toast({
        title: "Erro",
        description: "Este cliente já possui uma instância",
        variant: "destructive",
      });
      return;
    }

    // Use client ID as instance ID
    const instanceId = clientData.id;

    try {
      setLoading(true);
      console.log(`🚀 Criando instância para cliente: ${clientData.name} (${instanceId})`);
      
      // Primeiro verificar se já existe uma instância com esse ID no Supabase
      const existingInstance = await whatsappInstancesService.getInstanceByInstanceId(instanceId);
      
      if (existingInstance) {
        console.log('⚠️ Instância já existe no Supabase, atualizando status...');
        
        // Se já existe, apenas atualizar o status
        await whatsappInstancesService.updateInstanceById(existingInstance.id, {
          status: 'connecting',
          updated_at: new Date().toISOString()
        });
        
        // Update client with instance info
        await updateClientInstance(clientData.id, instanceId, 'connecting');
        
        toast({
          title: "Instância Reativada",
          description: `Instância existente para ${clientData.name} foi reativada!`,
        });
      } else {
        // Se não existe, criar nova instância no Supabase
        const newInstance = await whatsappInstancesService.createInstance({
          client_id: clientData.id,
          instance_id: instanceId,
          status: 'connecting'
        });
        
        console.log('✅ Nova instância criada no Supabase:', newInstance);
        
        // Update client with instance info
        await updateClientInstance(clientData.id, instanceId, 'connecting');
        
        toast({
          title: "Sucesso",
          description: `Nova instância criada para ${clientData.name}!`,
        });
      }
      
      // Agora tentar conectar no servidor WhatsApp
      try {
        const result = await whatsappService.connectClient(instanceId);
        console.log("✅ Resultado da conexão WhatsApp:", result);
      } catch (whatsappError) {
        console.warn("⚠️ Erro ao conectar no WhatsApp (mas instância foi criada):", whatsappError);
        // Não falhar completamente, apenas avisar
        toast({
          title: "Instância criada",
          description: "Instância criada no banco, mas houve problema na conexão WhatsApp. Tente reconectar.",
          variant: "default",
        });
      }
      
      // Ouvir status deste cliente específico
      whatsappService.joinClientRoom(instanceId);
      whatsappService.onClientStatus(instanceId, async (clientStatus) => {
        console.log(`📱 Status atualizado para ${instanceId}:`, clientStatus);
        
        // Update clients list
        setClients(prev => {
          const index = prev.findIndex(c => c.clientId === clientStatus.clientId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = clientStatus;
            return updated;
          } else {
            return [...prev, clientStatus];
          }
        });
        
        // Update client status in Supabase
        const linkedClient = getClientByInstanceId(clientStatus.clientId);
        if (linkedClient) {
          await updateClientInstance(linkedClient.id, clientStatus.clientId, clientStatus.status);
        }

        // Update instance in Supabase using the existing instance
        try {
          const instance = await whatsappInstancesService.getInstanceByInstanceId(instanceId);
          if (instance) {
            await whatsappInstancesService.updateInstanceById(instance.id, {
              status: clientStatus.status,
              phone_number: clientStatus.phoneNumber,
              has_qr_code: clientStatus.hasQrCode
            });
          }
        } catch (error) {
          console.error('Erro ao atualizar instância no Supabase:', error);
        }
      });

      setSelectedClientForInstance("");

      // Recarregar a lista de clientes após 2 segundos
      setTimeout(() => {
        loadClients();
        loadAvailableClients();
      }, 2000);

    } catch (error: any) {
      console.error("❌ Erro ao criar instância:", error);
      
      // Mensagem de erro mais específica
      let errorMessage = "Falha ao criar instância. Verifique se o servidor está rodando.";
      
      if (error.code === '23505') {
        errorMessage = "Instância já existe. Tente recarregar a página e verificar se ela já está listada.";
      } else if (error.message?.includes('duplicate key')) {
        errorMessage = "Instância duplicada detectada. Recarregando dados...";
        // Tentar recarregar os dados
        setTimeout(() => {
          loadClients();
          loadAvailableClients();
        }, 1000);
      }
      
      toast({
        title: "Erro ao Criar Instância",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectClient = async (clientId: string) => {
    try {
      setLoading(true);
      
      // Primeiro desconectar do servidor WhatsApp
      await whatsappService.disconnectClient(clientId);
      
      // Encontrar a instância no Supabase pelo instance_id
      const instance = await whatsappInstancesService.getInstanceByInstanceId(clientId);
      
      if (instance) {
        // Atualizar status da instância no Supabase
        await whatsappInstancesService.updateInstanceById(instance.id, {
          status: 'disconnected'
        });
      }
      
      // Update client status
      const linkedClient = getClientByInstanceId(clientId);
      if (linkedClient) {
        await updateClientInstance(linkedClient.id, "", 'disconnected');
      }
      
      toast({
        title: "Sucesso",
        description: `Instância ${clientId} desconectada`,
      });
      
      await loadClients();
      await loadAvailableClients();
    } catch (error: any) {
      console.error("❌ Erro ao desconectar:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar instância",
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

  // Get clients without instances
  const clientsWithoutInstances = availableClients.filter(client => !client.instance_id);

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
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Multi-Cliente</h1>
          <p className="text-gray-600">Sistema robusto com fallback inteligente e monitoramento em tempo real</p>
        </div>
        <Button onClick={loadClients} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* System Health Monitor - NEW */}
      <SystemHealthMonitor />

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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Instâncias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-gray-500">Instâncias ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {clients.filter(c => c.status === 'connected').length}
            </div>
            <p className="text-xs text-green-600">Online</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Aguardando QR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {clients.filter(c => c.status === 'qr_ready').length}
            </div>
            <p className="text-xs text-blue-600">Pronto para conectar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Desconectadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {clients.filter(c => ['disconnected', 'error', 'auth_failed'].includes(c.status)).length}
            </div>
            <p className="text-xs text-red-600">Requerem atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Add New Instance for Client */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Criar Instância WhatsApp para Cliente</CardTitle>
          <CardDescription>
            Selecione um cliente cadastrado para criar uma nova instância WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Select value={selectedClientForInstance} onValueChange={setSelectedClientForInstance}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clientsWithoutInstances.length === 0 ? (
                  <SelectItem value="no-clients-available" disabled>
                    Todos os clientes já possuem instâncias
                  </SelectItem>
                ) : (
                  clientsWithoutInstances.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>{client.name} ({client.email})</span>
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
          {clientsWithoutInstances.length === 0 && availableClients.length > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              💡 Todos os clientes já possuem instâncias. Crie novos clientes na seção "Clientes"
            </p>
          )}
          {availableClients.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              💡 Nenhum cliente cadastrado. Vá para a seção "Clientes" para criar o primeiro cliente
            </p>
          )}
        </CardContent>
      </Card>

      {/* Clients Grid */}
      {clients.length > 0 ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {clients.map((client) => {
            const linkedClient = getClientByInstanceId(client.clientId);
            return (
              <Card key={client.clientId} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <span>{client.clientId}</span>
                        {linkedClient && <Link className="w-4 h-4 text-green-500" />}
                      </CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Smartphone className="w-4 h-4 mr-1" />
                        {client.phoneNumber || 'Não conectado'}
                      </CardDescription>
                      {linkedClient && (
                        <CardDescription className="flex items-center mt-1 text-green-600">
                          <User className="w-4 h-4 mr-1" />
                          Cliente: {linkedClient.name}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(client.status)}`} />
                      <Badge variant={client.status === 'connected' ? 'default' : 'secondary'}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(client.status)}
                          <span>{getStatusText(client.status)}</span>
                        </div>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Status Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Status</p>
                      <p className="font-medium">{getStatusText(client.status)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">QR Code</p>
                      <p className="font-medium">{client.hasQrCode ? 'Disponível' : 'N/A'}</p>
                    </div>
                  </div>

                  {/* QR Code Display */}
                  {client.status === 'qr_ready' && client.hasQrCode && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800 mb-2">
                        📱 QR Code pronto! Escaneie com seu WhatsApp
                      </p>
                      <Button 
                        onClick={() => handleViewQrCode(client.clientId)}
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
                  {client.status === 'connected' && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        ✅ WhatsApp conectado e funcionando
                      </p>
                    </div>
                  )}

                  {/* Error Info */}
                  {['error', 'auth_failed'].includes(client.status) && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-800">
                        ❌ Erro na conexão. Tente reiniciar a instância.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-2">
                    {client.status === 'connected' ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDisconnectClient(client.clientId)}
                          disabled={loading}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pausar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenChat(client.clientId)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => whatsappService.connectClient(client.clientId)}
                        disabled={loading || client.status === 'connecting'}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {client.status === 'connecting' ? 'Conectando...' : 'Conectar'}
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRestartClient(client.clientId)}
                      disabled={loading}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Reiniciar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDisconnectClient(client.clientId)}
                      disabled={loading}
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
      ) : !connectionError ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Smartphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma instância criada</h3>
              <p className="text-gray-600 mb-4">
                Selecione um cliente cadastrado e crie sua primeira instância WhatsApp
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* QR Code Modal */}
      {showQrModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">
                QR Code - {selectedClient.clientId}
              </h3>
              
              {selectedClient.qrCode ? (
                <div className="space-y-4">
                  <img 
                    src={selectedClient.qrCode} 
                    alt="QR Code WhatsApp"
                    className="mx-auto border rounded"
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

export default RealInstancesManager;
