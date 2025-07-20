
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  WifiOff,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";
import { useInstanceCleanup } from "@/hooks/useInstanceCleanup";

const CleanInstancesManager = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrModal, setQrModal] = useState<{ show: boolean; instanceId?: string }>({ show: false });
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Hook unificado
  const { 
    connectInstance, 
    disconnectInstance,
    getInstanceStatus,
    isLoading: isInstanceLoading,
    serverOnline
  } = useUnifiedInstanceManager();
  
  // Limpeza automática
  useInstanceCleanup();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    await Promise.all([
      loadClients(),
      loadInstances()
    ]);
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
      
      for (const client of clients) {
        const clientInstances = await whatsappInstancesService.getInstancesByClientId(client.id);
        allInstances.push(...clientInstances);
      }
      
      setInstances(allInstances);
      console.log(`📊 [ADMIN] Carregadas ${allInstances.length} instâncias no total`);
      
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
      setTimeout(() => loadInstances(), 2000);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-4 h-4 text-blue-500" />;
      case 'connecting': return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <XCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const availableClients = clients.filter(client => 
    instances.filter(instance => instance.client_id === client.id).length < client.max_instances ||
    client.email === 'thalisportal@gmail.com'
  );

  const connectedInstances = instances.filter(i => getInstanceStatus(i.instance_id).status === 'connected').length;
  const totalInstances = instances.length;

  return (
    <div className="space-y-6">
      {/* Header com Status Simples */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Instâncias</h1>
          <p className="text-muted-foreground">Painel administrativo de instâncias WhatsApp</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {serverOnline ? (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600">Sistema Online</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm text-red-600">Sistema Offline</span>
              </div>
            )}
          </div>
          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-800">{connectedInstances}</div>
                <p className="text-sm text-green-600">Instâncias Conectadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-800">{totalInstances}</div>
                <p className="text-sm text-blue-600">Total de Instâncias</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-800">{clients.length}</div>
                <p className="text-sm text-purple-600">Clientes Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Criar Nova Instância */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-green-600" />
            <span>Nova Instância WhatsApp</span>
          </CardTitle>
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
                  Criar Instância
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
              <Card key={instance.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(instanceStatus.status)}`} />
                        {getStatusIcon(instanceStatus.status)}
                        <h3 className="font-semibold text-lg">{instance.custom_name || instance.instance_id}</h3>
                        {client && (
                          <Badge variant="outline" className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{client.name}</span>
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          {getStatusText(instanceStatus.status)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>ID: {instance.instance_id.split('_').pop()}</span>
                        {instanceStatus.phoneNumber && <span>📱 {instanceStatus.phoneNumber}</span>}
                        {instanceStatus.hasQrCode && <span>📱 QR Disponível</span>}
                      </div>

                      {instanceStatus.status === 'qr_ready' && instanceStatus.hasQrCode && (
                        <Alert className="mt-3 bg-blue-50 border-blue-200">
                          <QrCode className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-800">
                            📱 QR Code pronto! Clique em "Ver QR" para visualizar e escanear.
                          </AlertDescription>
                        </Alert>
                      )}

                      {instanceStatus.status === 'connected' && (
                        <Alert className="mt-3 bg-green-50 border-green-200">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            ✅ WhatsApp conectado e funcionando!
                          </AlertDescription>
                        </Alert>
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
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
            <div className="text-center py-12">
              <QrCode className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma instância criada</h3>
              <p className="text-muted-foreground mb-6">
                Selecione um cliente e crie a primeira instância WhatsApp
              </p>
              <Button onClick={() => document.querySelector('select')?.focus()}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Instância
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Modal */}
      {qrModal.show && qrModal.instanceId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 border">
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
                  <p className="text-sm text-muted-foreground">
                    Escaneie este QR Code com seu WhatsApp para conectar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <QrCode className="w-16 h-16 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">QR Code não disponível</p>
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

export default CleanInstancesManager;
