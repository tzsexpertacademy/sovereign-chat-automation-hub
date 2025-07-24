import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plus, 
  QrCode, 
  Trash2, 
  RefreshCw,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Wifi,
  Clock,
  Phone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import unifiedYumerService from "@/services/unifiedYumerService";

interface InstanceState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'timeout';
  progress: number;
  message: string;
  data?: any;
}

interface InstanceStates {
  [instanceId: string]: InstanceState;
}

interface QRModalData {
  show: boolean;
  instanceId?: string;
  qrCode?: string;
}

const SimpleInstancesManager = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [qrModal, setQrModal] = useState<QRModalData>({ show: false });
  const [instanceStates, setInstanceStates] = useState<InstanceStates>({});
  
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(refreshInstancesStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateInstanceState = (instanceId: string, updates: Partial<InstanceState>) => {
    setInstanceStates(prev => ({
      ...prev,
      [instanceId]: {
        ...prev[instanceId],
        ...updates
      }
    }));
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Verificar saúde do servidor
      const health = await unifiedYumerService.checkServerHealth();
      setServerOnline(health.success);
      
      if (!health.success) {
        toast({
          title: "Servidor Offline",
          description: "API Yumer não está respondendo",
          variant: "destructive",
        });
        return;
      }

      // 2. Carregar clientes
      const clientsData = await clientsService.getAllClients();
      setClients(clientsData);

      // 3. Carregar instâncias
      const allInstances: WhatsAppInstanceData[] = [];
      for (const client of clientsData) {
        const clientInstances = await whatsappInstancesService.getInstancesByClientId(client.id);
        allInstances.push(...clientInstances);
      }
      setInstances(allInstances);

      console.log('✅ Dados carregados:', { clients: clientsData.length, instances: allInstances.length });
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshInstancesStatus = async () => {
    for (const instance of instances) {
      if (!instance.business_business_id) continue;

      try {
        const result = await unifiedYumerService.getConnectionState(instance.instance_id);
        if (!result.success) continue;
        
        const statusMapping = { 'open': 'connected', 'close': 'disconnected', 'connecting': 'connecting' };
        const mappedStatus = statusMapping[result.data.state] || 'disconnected';
        
        if (mappedStatus !== instance.status) {
          await whatsappInstancesService.updateInstanceStatus(instance.instance_id, mappedStatus);
        }
      } catch (error) {
        console.log(`Erro ao atualizar instância ${instance.instance_id}:`, error);
      }
    }
  };

  const createInstance = async () => {
    if (!selectedClient) {
      toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
      return;
    }

    const client = clients.find(c => c.id === selectedClient);
    if (!client) return;

    if (!client.business_id) {
      toast({ 
        title: "Erro", 
        description: "Cliente não possui business. Exclua e recrie o cliente.", 
        variant: "destructive" 
      });
      return;
    }

    const tempId = `temp_${Date.now()}`;
    
    try {
      // 1. Verificar limites
      updateInstanceState(tempId, { status: 'loading', progress: 20, message: 'Verificando limites...' });
      
      const canCreate = await clientsService.canCreateInstance(client.id);
      if (!canCreate && client.email !== 'thalisportal@gmail.com') {
        throw new Error(`Limite de ${client.max_instances} instâncias atingido`);
      }

      // 2. Criar instância na API
      updateInstanceState(tempId, { status: 'loading', progress: 50, message: 'Criando instância...' });
      
      const instanceName = `${client.name.replace(/\s+/g, '_')}_${Date.now()}`;
      const createResult = await unifiedYumerService.createBusinessInstance(client.business_id, {
        instanceName
      });
      
      if (!createResult.success) {
        throw new Error(createResult.error || 'Falha ao criar instância');
      }

      // 3. Salvar no banco
      updateInstanceState(tempId, { status: 'loading', progress: 80, message: 'Salvando no banco...' });
      
      await whatsappInstancesService.createInstance({
        client_id: client.id,
        instance_id: String(createResult.data.id) || instanceName,
        status: 'disconnected',
        custom_name: instanceName,
        business_business_id: client.business_id
      });

      updateInstanceState(tempId, { status: 'success', progress: 100, message: 'Instância criada!' });
      
      toast({ title: "Sucesso", description: "Instância criada com sucesso!" });
      setSelectedClient("");
      await loadInitialData();
      
      // Limpar estado temporário
      setTimeout(() => {
        setInstanceStates(prev => {
          const newState = { ...prev };
          delete newState[tempId];
          return newState;
        });
      }, 3000);
      
    } catch (error: any) {
      updateInstanceState(tempId, { status: 'error', progress: 0, message: error.message });
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const connectInstance = async (instanceId: string) => {
    const instance = instances.find(i => i.instance_id === instanceId);
    if (!instance?.business_business_id) return;

    try {
      updateInstanceState(instanceId, { status: 'loading', progress: 20, message: 'Conectando...' });

      // 1. Conectar
      const connectResult = await unifiedYumerService.connectInstance(instanceId);
      if (!connectResult.success) {
        throw new Error(connectResult.error || 'Falha ao conectar');
      }

      updateInstanceState(instanceId, { status: 'loading', progress: 50, message: 'Aguardando QR...' });

      // 2. Buscar QR Code com retry
      let qrCode = null;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const qrResult = await unifiedYumerService.getQRCode(instanceId);
        if (qrResult.success && qrResult.data?.qrcode?.code) {
          qrCode = qrResult.data.qrcode.code;
          break;
        }
        
        updateInstanceState(instanceId, { 
          status: 'loading', 
          progress: 50 + (i * 5), 
          message: `Aguardando QR... (${i + 1}/10)` 
        });
      }

      if (qrCode) {
        await whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready');
        updateInstanceState(instanceId, { 
          status: 'success', 
          progress: 100, 
          message: 'QR Code disponível!',
          data: { qrCode }
        });
        await loadInitialData();
      } else {
        throw new Error('QR Code não foi gerado');
      }

    } catch (error: any) {
      updateInstanceState(instanceId, { status: 'error', progress: 0, message: error.message });
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const showQRCode = async (instanceId: string) => {
    const instance = instances.find(i => i.instance_id === instanceId);
    if (!instance) return;

    try {
      let qrCode = instance.qr_code;
      
      if (!qrCode) {
        const qrResult = await unifiedYumerService.getQRCode(instanceId);
        qrCode = qrResult.success ? qrResult.data?.qrcode?.code : null;
      }

      if (qrCode) {
        setQrModal({ show: true, instanceId, qrCode });
      } else {
        toast({ title: "QR Indisponível", description: "Tente conectar novamente", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao obter QR Code", variant: "destructive" });
    }
  };

  const deleteInstance = async (instanceId: string) => {
    if (!confirm('Tem certeza que deseja remover esta instância?')) return;
    
    try {
      updateInstanceState(instanceId, { status: 'loading', progress: 50, message: 'Removendo...' });
      
      // Tentar remover da API (pode falhar se não existir)
      try {
        await unifiedYumerService.deleteInstance(instanceId);
      } catch (error) {
        console.log('Instância não existe na API');
      }

      // Remover do banco
      await whatsappInstancesService.deleteInstance(instanceId);
      
      toast({ title: "Sucesso", description: "Instância removida" });
      await loadInitialData();
      
    } catch (error: any) {
      toast({ title: "Erro", description: "Falha ao remover instância", variant: "destructive" });
    }
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
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      default: return 'Desconectado';
    }
  };

  const availableClients = clients.filter(client => {
    const clientInstances = instances.filter(i => i.client_id === client.id).length;
    return clientInstances < client.max_instances || client.email === 'thalisportal@gmail.com';
  });

  if (!serverOnline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-red-600">
            <XCircle className="w-5 h-5" />
            <span>Servidor Offline</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              A API Yumer não está respondendo. Verifique a conectividade.
              <Button className="mt-2" onClick={loadInitialData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Instâncias WhatsApp</h1>
          <p className="text-muted-foreground">Sistema simplificado baseado no diagnóstico</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-green-600">
            <Wifi className="w-4 h-4" />
            <span className="text-sm">API Online</span>
          </div>
          <Button onClick={loadInitialData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{instances.length}</div>
            <div className="text-sm text-muted-foreground">Total Instâncias</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {instances.filter(i => i.status === 'connected').length}
            </div>
            <div className="text-sm text-muted-foreground">Conectadas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{clients.filter(c => c.business_id).length}</div>
            <div className="text-sm text-muted-foreground">Businesses</div>
          </CardContent>
        </Card>
      </div>

      {/* Criar Nova Instância */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Nova Instância</span>
          </CardTitle>
          <CardDescription>
            Fluxo simplificado: Cliente → Business → Instância → QR
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {availableClients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>{client.name}</span>
                      <Badge variant="outline">{client.plan}</Badge>
                      <span className="text-xs">
                        ({instances.filter(i => i.client_id === client.id).length}/{client.max_instances})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={createInstance} disabled={!selectedClient || loading}>
              <Plus className="w-4 h-4 mr-2" />
              Criar
            </Button>
          </div>
          
          {/* Progresso de criação */}
          {Object.entries(instanceStates)
            .filter(([id]) => id.startsWith('temp_'))
            .map(([id, state]) => (
              <div key={id} className="mt-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Criando instância...</span>
                  <Badge variant={state.status === 'error' ? 'destructive' : 'default'}>
                    {state.status}
                  </Badge>
                </div>
                <Progress value={state.progress} className="mb-2" />
                <p className="text-xs text-muted-foreground">{state.message}</p>
              </div>
          ))}
        </CardContent>
      </Card>

      {/* Lista de Instâncias */}
      <div className="grid gap-4">
        {instances.map(instance => {
          const client = clients.find(c => c.id === instance.client_id);
          const state = instanceStates[instance.instance_id] || { status: 'idle', progress: 0, message: '' };
          
          return (
            <Card key={instance.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                      <h3 className="font-semibold">{instance.custom_name || instance.instance_id}</h3>
                      {client && (
                        <Badge variant="outline">
                          <User className="w-3 h-3 mr-1" />
                          {client.name}
                        </Badge>
                      )}
                      <Badge variant="secondary">{getStatusText(instance.status)}</Badge>
                    </div>
                    
                    {/* Info */}
                    <div className="text-sm text-muted-foreground">
                      ID: {instance.instance_id}
                    </div>

                    {/* Estado da operação */}
                    {state.status !== 'idle' && (
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm">Operação: {state.status}</span>
                        </div>
                        {state.status === 'loading' && (
                          <Progress value={state.progress} className="mb-2" />
                        )}
                        <p className="text-xs">{state.message}</p>
                      </div>
                    )}

                    {/* Alerts */}
                    {instance.status === 'qr_ready' && (
                      <Alert>
                        <QrCode className="h-4 w-4" />
                        <AlertDescription>
                          QR Code pronto! Clique em "Ver QR" para escanear.
                        </AlertDescription>
                      </Alert>
                    )}

                    {instance.status === 'connected' && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          WhatsApp conectado! Instância funcionando.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex space-x-2">
                    {instance.status === 'qr_ready' && (
                      <Button size="sm" onClick={() => showQRCode(instance.instance_id)}>
                        <QrCode className="w-4 h-4 mr-1" />
                        Ver QR
                      </Button>
                    )}
                    
                    {instance.status === 'connected' ? (
                      <Button size="sm" onClick={() => openChat(instance.instance_id)}>
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Chat
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => connectInstance(instance.instance_id)}
                        disabled={state.status === 'loading'}
                      >
                        {state.status === 'loading' ? (
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
                    
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => deleteInstance(instance.instance_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {instances.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Nenhuma instância encontrada</h3>
            <p className="text-sm text-muted-foreground">Crie a primeira instância para começar</p>
          </CardContent>
        </Card>
      )}

      {/* Modal QR Code */}
      <Dialog open={qrModal.show} onOpenChange={(open) => setQrModal({ ...qrModal, show: open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <QrCode className="w-5 h-5" />
              <span>QR Code WhatsApp</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {qrModal.qrCode && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img 
                  src={qrModal.qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
            )}
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Instruções:</strong>
                <ol className="mt-2 text-sm space-y-1">
                  <li>1. Abra o WhatsApp no seu celular</li>
                  <li>2. Toque em "Mais opções" → "Aparelhos conectados"</li>
                  <li>3. Toque em "Conectar um aparelho"</li>
                  <li>4. Escaneie este QR Code</li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SimpleInstancesManager;