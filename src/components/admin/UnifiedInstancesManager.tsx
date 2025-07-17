import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Pause, 
  Play, 
  QrCode, 
  Trash2, 
  RefreshCw,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Wifi,
  WifiOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";
import { useInstanceCleanup } from "@/hooks/useInstanceCleanup";

const UnifiedInstancesManager = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [qrModal, setQrModal] = useState<{ show: boolean; instanceId?: string }>({ show: false });
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Hook unificado
  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading: isInstanceLoading,
    restMode,
    refreshStatus
  } = useUnifiedInstanceManager();
  
  // Limpeza automática
  useInstanceCleanup();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh menos frequente
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    await Promise.all([
      checkServer(),
      loadClients(),
      loadInstances()
    ]);
  };

  const checkServer = async () => {
    try {
      const result = await fetch('https://yumer.yumerflow.app:8083/health');
      const isOnline = result.ok;
      setServerOnline(isOnline);
      
      if (!isOnline) {
        toast({
          title: "Servidor Offline",
          description: "O servidor WhatsApp não está respondendo",
          variant: "destructive",
        });
      }
    } catch (error) {
      setServerOnline(false);
      console.error('Erro ao verificar servidor:', error);
    }
  };

  const loadClients = async () => {
    try {
      const clientsData = await clientsService.getAllClients();
      setClients(clientsData);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadInstances = async () => {
    try {
      const allInstances: WhatsAppInstanceData[] = [];
      
      // ============ VERIFICAR SE EXISTE ALGUMA INSTÂNCIA NO BANCO ============
      // Carregar instâncias de todos os clientes
      for (const client of clients) {
        const clientInstances = await whatsappInstancesService.getInstancesByClientId(client.id);
        allInstances.push(...clientInstances);
      }
      
      setInstances(allInstances);
      console.log(`📊 [ADMIN] Carregadas ${allInstances.length} instâncias no total`);
      
      // ============ NOTIFICAR SE NÃO HOUVER INSTÂNCIAS ============
      if (allInstances.length === 0) {
        console.log(`ℹ️ [ADMIN] Nenhuma instância encontrada no banco - banco limpo`);
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const createInstance = async () => {
    if (!selectedClient) {
      toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
      return;
    }

    const client = clients.find(c => c.id === selectedClient);
    if (!client) return;

    try {
      setLoading(true);
      
      // Verificar limite
      const canCreate = await clientsService.canCreateInstance(client.id);
      if (!canCreate) {
        // Auto-upgrade para cliente especial
        if (client.email === 'thalisportal@gmail.com') {
          const newPlan = client.plan === 'basic' ? 'standard' : 
                         client.plan === 'standard' ? 'premium' : 'enterprise';
          
          await clientsService.updateClient(client.id, { plan: newPlan });
          
          toast({
            title: "Plano Atualizado",
            description: `Plano atualizado para ${newPlan.toUpperCase()} automaticamente`,
          });
          
          await loadClients();
          // Tentar criar novamente
          setTimeout(() => createInstance(), 1000);
          return;
        }
        
        toast({
          title: "Limite Atingido",
          description: `Limite de ${client.max_instances} instâncias atingido`,
          variant: "destructive",
        });
        return;
      }

      // Criar instância
      const instanceId = `${client.id}_${Date.now()}`;
      const customName = `Instância Admin ${Date.now()}`;
      
      await whatsappInstancesService.createInstance({
        client_id: client.id,
        instance_id: instanceId,
        status: 'disconnected',
        custom_name: customName
      });

      toast({ title: "Sucesso", description: "Instância criada com sucesso!" });
      
      setSelectedClient("");
      await loadData();
      
    } catch (error: any) {
      toast({ 
        title: "Erro", 
        description: error.message || "Falha ao criar instância", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstance = async (instanceId: string) => {
    try {
      await connectInstance(instanceId);
      // Aguardar um pouco e então verificar status
      setTimeout(() => refreshStatus(instanceId), 2000);
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
    }
  };

  const handleDisconnectInstance = async (instanceId: string) => {
    try {
      await disconnectInstance(instanceId);
      await loadInstances();
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
    }
  };

  const deleteInstance = async (instanceId: string) => {
    if (!confirm('Tem certeza que deseja remover esta instância?')) return;
    
    try {
      await whatsappInstancesService.deleteInstance(instanceId);
      toast({ title: "Sucesso", description: "Instância removida com sucesso" });
      await loadData();
    } catch (error: any) {
      toast({ 
        title: "Erro", 
        description: "Falha ao remover instância", 
        variant: "destructive" 
      });
    }
  };

  const showQrCode = (instanceId: string) => {
    setQrModal({ show: true, instanceId });
  };

  const openChat = (instanceId: string) => {
    const instance = instances.find(i => i.instance_id === instanceId);
    if (instance) {
      navigate(`/client/${instance.client_id}/chat`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'authenticated': return 'Autenticado';
      default: return 'Desconectado';
    }
  };

  const availableClients = clients.filter(client => 
    instances.filter(instance => instance.client_id === client.id).length < client.max_instances ||
    client.email === 'thalisportal@gmail.com'
  );

  if (!serverOnline) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span>Servidor Offline</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p>O servidor WhatsApp não está respondendo.</p>
                  <Button onClick={checkServer}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Testar Novamente
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Instâncias WhatsApp</h1>
          <p className="text-gray-600">Painel administrativo unificado</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {restMode ? (
              <RefreshCw className="w-4 h-4 text-blue-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs">
              {restMode ? 'REST Mode' : 'Offline'}
            </span>
          </div>
          <Button onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Status do Servidor */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="font-medium text-green-800">Servidor Online</span>
              <Badge className="bg-green-500">
                {instances.length} Instâncias
              </Badge>
            </div>
            <div className="text-sm text-gray-600">
              {instances.filter(i => getInstanceStatus(i.instance_id).status === 'connected').length} Conectadas
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Criar Nova Instância */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Nova Instância</CardTitle>
          <CardDescription>Selecione um cliente para criar uma nova instância WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {availableClients.length === 0 ? (
                  <SelectItem value="none" disabled>Todos os clientes no limite</SelectItem>
                ) : (
                  availableClients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>{client.name}</span>
                        <Badge variant="outline">{client.plan}</Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={createInstance} 
              disabled={loading || !selectedClient || selectedClient === "none"}
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
                  Criar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Instâncias */}
      {instances.length > 0 ? (
        <div className="grid gap-4">
          {instances.map(instance => {
            const client = clients.find(c => c.id === instance.client_id);
            const instanceStatus = getInstanceStatus(instance.instance_id);
            const loading = isInstanceLoading(instance.instance_id);
            
            return (
              <Card key={instance.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(instanceStatus.status)}`} />
                        <h3 className="font-semibold">{instance.custom_name || instance.instance_id}</h3>
                        {client && (
                          <Badge variant="outline">
                            <User className="w-3 h-3 mr-1" />
                            {client.name}
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          {getStatusText(instanceStatus.status)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>ID: {instance.instance_id.split('_').pop()}</span>
                        {instanceStatus.phoneNumber && <span>📱 {instanceStatus.phoneNumber}</span>}
                        {instanceStatus.hasQrCode && <span>📱 QR Disponível</span>}
                      </div>

                      {instanceStatus.status === 'qr_ready' && instanceStatus.hasQrCode && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-blue-800 text-sm font-medium">
                            📱 QR Code pronto! Clique para visualizar e escanear.
                          </p>
                        </div>
                      )}

                      {instanceStatus.status === 'connected' && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                          <p className="text-green-800 text-sm font-medium">
                            ✅ WhatsApp conectado e funcionando!
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      {instanceStatus.status === 'qr_ready' && instanceStatus.hasQrCode && (
                        <Button size="sm" onClick={() => showQrCode(instance.instance_id)}>
                          <QrCode className="w-4 h-4 mr-1" />
                          Ver QR
                        </Button>
                      )}
                      
                      {instanceStatus.status === 'connected' ? (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => openChat(instance.instance_id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Chat
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDisconnectInstance(instance.instance_id)}
                            disabled={loading}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Pausar
                          </Button>
                        </>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => handleConnectInstance(instance.instance_id)}
                          disabled={loading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {loading ? (
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
                        onClick={() => deleteInstance(instance.instance_id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remover
                      </Button>
                    </div>
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
              <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma instância criada</h3>
              <p className="text-gray-600">Selecione um cliente e crie a primeira instância WhatsApp</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Modal */}
      {qrModal.show && qrModal.instanceId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">
                QR Code - {qrModal.instanceId}
              </h3>
              
              {getInstanceStatus(qrModal.instanceId).qrCode ? (
                <div className="space-y-4">
                  <img 
                    src={getInstanceStatus(qrModal.instanceId).qrCode} 
                    alt="QR Code WhatsApp"
                    className="mx-auto border rounded max-w-[250px]"
                  />
                  <p className="text-sm text-gray-600">
                    Escaneie este QR Code com seu WhatsApp para conectar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">QR Code não disponível</p>
                </div>
              )}
              
              <Button 
                onClick={() => setQrModal({ show: false })}
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

export default UnifiedInstancesManager;