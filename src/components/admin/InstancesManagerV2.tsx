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
  WifiOff,
  Clock,
  Zap,
  Phone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { businessSyncService } from "@/services/businessSyncService";
import unifiedYumerService from "@/services/unifiedYumerService";

interface InstanceState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'timeout';
  progress: number;
  message: string;
  data?: any;
  timestamp?: number;
}

interface InstanceStates {
  [instanceId: string]: InstanceState;
}

interface QRModalData {
  show: boolean;
  instanceId?: string;
  qrCode?: string;
  businessId?: string;
}

const InstancesManagerV2 = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [qrModal, setQrModal] = useState<QRModalData>({ show: false });
  const [instanceStates, setInstanceStates] = useState<InstanceStates>({});
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [syncingBusinesses, setSyncingBusinesses] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Timeouts do diagnóstico
  const OPERATION_TIMEOUT = 10000;
  const CONNECTION_TIMEOUT = 30000;

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
        ...updates,
        timestamp: Date.now()
      }
    }));
  };

  const loadInitialData = async () => {
    setGlobalLoading(true);
    try {
      await Promise.all([
        checkServerHealth(),
        loadClients(),
        loadInstances(),
        loadBusinesses()
      ]);
    } finally {
      setGlobalLoading(false);
    }
  };

  const checkServerHealth = async () => {
    try {
      const health = await unifiedYumerService.checkServerHealth();
      setServerOnline(true);
      console.log('✅ Servidor online:', health.version);
    } catch (error) {
      setServerOnline(false);
      toast({
        title: "Servidor Offline",
        description: "API Yumer não está respondendo",
        variant: "destructive",
      });
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
      
      for (const client of clients) {
        const clientInstances = await whatsappInstancesService.getInstancesByClientId(client.id);
        allInstances.push(...clientInstances);
      }
      
      setInstances(allInstances);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const loadBusinesses = async () => {
    try {
      setSyncingBusinesses(true);
      
      // 1. Sincronizar businesses da API para o banco local
      await businessSyncService.syncBusinessesToLocal();
      
      // 2. Auto-vincular businesses órfãos
      await businessSyncService.autoLinkOrphanBusinesses();
      
      // 3. Buscar businesses locais (já vinculados aos clientes)
      const localBusinesses = await businessSyncService.getLocalBusinesses();
      setBusinesses(localBusinesses);
      
      console.log('✅ Businesses sincronizados e carregados:', localBusinesses.length);
    } catch (error) {
      console.error('❌ Erro ao carregar e sincronizar businesses:', error);
      setBusinesses([]);
    } finally {
      setSyncingBusinesses(false);
    }
  };

  const refreshInstancesStatus = async () => {
    console.log('🔄 Atualizando status das instâncias...');
    
    for (const instance of instances) {
      try {
        // Buscar business para esta instância usando business_business_id (agora do banco local)
        const business = businesses.find(b => b.business_id === instance.business_business_id);
        if (!business) {
          console.log(`⚠️ Business local não encontrado para instância ${instance.instance_id} (business_id: ${instance.business_business_id})`);
          continue;
        }

        // Verificar status atual
        const result = await unifiedYumerService.getConnectionState(instance.instance_id);
        if (!result.success) continue;
        const connectionState = result.data;
        
        // Atualizar no banco se mudou
        const statusMapping = { 'open': 'connected', 'close': 'disconnected', 'connecting': 'connecting' };
        const mappedStatus = statusMapping[connectionState.state] || 'disconnected';
        
        if (mappedStatus !== instance.status) {
          await whatsappInstancesService.updateInstanceStatus(
            instance.instance_id, 
            mappedStatus
          );
          
          updateInstanceState(instance.instance_id, {
            status: 'success',
            message: `Status: ${mappedStatus}`,
            data: connectionState,
            progress: 100
          });
        }
      } catch (error) {
        console.log(`Erro ao atualizar instância ${instance.instance_id}:`, error);
      }
    }
    
    await loadInstances();
  };

  const createInstanceForClient = async () => {
    if (!selectedClient) {
      toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
      return;
    }

    const client = clients.find(c => c.id === selectedClient);
    if (!client) return;

    const tempInstanceId = `temp_${Date.now()}`;
    
    try {
      updateInstanceState(tempInstanceId, {
        status: 'loading',
        progress: 10,
        message: 'Verificando limites do cliente...'
      });

      // 1. Verificar limites (com auto-upgrade para thalisportal@gmail.com)
      const canCreate = await clientsService.canCreateInstance(client.id);
      if (!canCreate) {
        if (client.email === 'thalisportal@gmail.com') {
          updateInstanceState(tempInstanceId, {
            status: 'loading',
            progress: 20,
            message: 'Fazendo upgrade automático do plano...'
          });

          const newPlan = client.plan === 'basic' ? 'standard' : 
                         client.plan === 'standard' ? 'premium' : 'enterprise';
          
          await clientsService.updateClient(client.id, { plan: newPlan });
          
          toast({
            title: "Plano Atualizado",
            description: `Plano atualizado para ${newPlan.toUpperCase()}`,
          });
          
          await loadClients();
        } else {
          updateInstanceState(tempInstanceId, {
            status: 'error',
            progress: 0,
            message: `Limite de ${client.max_instances} instâncias atingido`
          });
          return;
        }
      }

      // 2. Verificar se cliente tem business_id (sistema 1:1)
      if (!client.business_id) {
        updateInstanceState(tempInstanceId, {
          status: 'error',
          progress: 0,
          message: 'Cliente não possui business associado. Exclua e recrie o cliente.'
        });
        return;
      }

      updateInstanceState(tempInstanceId, {
        status: 'loading',
        progress: 40,
        message: 'Usando business do cliente...'
      });

      updateInstanceState(tempInstanceId, {
        status: 'loading',
        progress: 50,
        message: 'Criando instância na API...'
      });

      // 3. Criar instância na API primeiro
      const instanceId = `${client.id}_${Date.now()}`;
      const customName = `${client.name}_${Date.now()}`;
      
      const createResult = await unifiedYumerService.createBusinessInstance(client.business_id, {
        instanceName: instanceId,
        qrcode: true
      });
      
      if (!createResult.success) {
        throw new Error(createResult.error || 'Falha ao criar instância');
      }

      updateInstanceState(tempInstanceId, {
        status: 'loading',
        progress: 70,
        message: 'Salvando instância no banco...'
      });

      // 4. Salvar no banco
      await whatsappInstancesService.createInstance({
        client_id: client.id,
        instance_id: instanceId,
        status: 'disconnected',
        custom_name: customName,
        business_business_id: client.business_id
      });

      updateInstanceState(tempInstanceId, {
        status: 'success',
        progress: 100,
        message: 'Instância criada com sucesso!'
      });

      toast({ title: "Sucesso", description: "Instância criada e configurada!" });
      
      setSelectedClient("");
      await loadInitialData();
      
      // Limpar estado temporário
      setTimeout(() => {
        setInstanceStates(prev => {
          const newState = { ...prev };
          delete newState[tempInstanceId];
          return newState;
        });
      }, 3000);
      
    } catch (error: any) {
      updateInstanceState(tempInstanceId, {
        status: 'error',
        progress: 0,
        message: error.message || "Falha ao criar instância"
      });
      
      toast({ 
        title: "Erro", 
        description: error.message || "Falha ao criar instância", 
        variant: "destructive" 
      });
    }
  };

  const connectInstance = async (instanceId: string) => {
    const instance = instances.find(i => i.instance_id === instanceId);
    if (!instance) return;

    const business = businesses.find(b => b.business_id === instance.business_business_id);
    if (!business) {
      toast({ title: "Erro", description: "Business local não encontrado para esta instância", variant: "destructive" });
      return;
    }

    try {
      updateInstanceState(instanceId, {
        status: 'loading',
        progress: 10,
        message: 'Verificando status atual...'
      });

      // 1. Verificar status atual
      const stateResult = await unifiedYumerService.getConnectionState(instanceId);
      if (!stateResult.success) {
        throw new Error(stateResult.error || 'Falha ao obter status');
      }
      const connectionState = stateResult.data;
      
      if (connectionState.state === 'open') {
        updateInstanceState(instanceId, {
          status: 'success',
          progress: 100,
          message: 'Já conectado!',
          data: connectionState
        });
        return;
      }

      updateInstanceState(instanceId, {
        status: 'loading',
        progress: 30,
        message: 'Iniciando conexão...'
      });

      // 2. Conectar instância
      const connectResult = await unifiedYumerService.connectInstance(instanceId);
      if (!connectResult.success) {
        throw new Error(connectResult.error || 'Falha ao conectar');
      }

      updateInstanceState(instanceId, {
        status: 'loading',
        progress: 50,
        message: 'Aguardando QR Code...'
      });

      // 3. Aguardar QR Code com timeout
      let qrCode = null;
      let attempts = 0;
      const maxAttempts = 15; // 15 segundos

      while (!qrCode && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const qrResult = await unifiedYumerService.getQRCode(instanceId);
          if (!qrResult.success) continue;
          if (qrResult.data?.qrcode?.code) {
            qrCode = qrResult.data.qrcode.code;
            break;
          }
        } catch (error) {
          console.log(`Tentativa ${attempts + 1}: QR ainda não disponível`);
        }
        
        attempts++;
        updateInstanceState(instanceId, {
          status: 'loading',
          progress: 50 + (attempts * 3),
          message: `Aguardando QR Code... (${attempts}/${maxAttempts})`
        });
      }

      if (qrCode) {
        // Atualizar status no banco
        await whatsappInstancesService.updateInstanceStatus(instanceId, 'qr_ready');

        updateInstanceState(instanceId, {
          status: 'success',
          progress: 100,
          message: 'QR Code disponível! Clique para visualizar.',
          data: { qrCode, businessId: business.business_id }
        });

        await loadInstances();
      } else {
        updateInstanceState(instanceId, {
          status: 'timeout',
          progress: 0,
          message: 'Timeout: QR Code não gerado'
        });
      }

    } catch (error: any) {
      updateInstanceState(instanceId, {
        status: 'error',
        progress: 0,
        message: error.message || "Erro ao conectar"
      });
    }
  };

  const showQRCode = async (instanceId: string) => {
    const instance = instances.find(i => i.instance_id === instanceId);
    if (!instance) return;

    const business = businesses.find(b => b.business_id === instance.business_business_id);
    if (!business) return;

    try {
      let qrCode = instance.qr_code;
      
      // Se não tem QR no banco, buscar da API
      if (!qrCode) {
        const qrResult = await unifiedYumerService.getQRCode(instanceId);
        qrCode = qrResult.success ? qrResult.data?.qrcode?.code : null;
      }

      if (qrCode) {
        setQrModal({
          show: true,
          instanceId,
          qrCode,
          businessId: business.business_id
        });
      } else {
        toast({
          title: "QR Code Indisponível",
          description: "Tente conectar a instância novamente",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao obter QR Code",
        variant: "destructive"
      });
    }
  };

  const deleteInstance = async (instanceId: string) => {
    if (!confirm('Tem certeza que deseja remover esta instância?')) return;
    
    const instance = instances.find(i => i.instance_id === instanceId);
    if (!instance) return;

    const business = businesses.find(b => b.business_id === instance.business_business_id);
    
    try {
      updateInstanceState(instanceId, {
        status: 'loading',
        progress: 50,
        message: 'Removendo instância...'
      });

      // Tentar remover da API (se business existe)
      if (business) {
        try {
          await unifiedYumerService.deleteInstance(instanceId);
        } catch (error) {
          console.log('Instância não existe na API, apenas no banco');
        }
      }

      // Remover do banco
      await whatsappInstancesService.deleteInstance(instanceId);
      
      updateInstanceState(instanceId, {
        status: 'success',
        progress: 100,
        message: 'Instância removida!'
      });

      toast({ title: "Sucesso", description: "Instância removida com sucesso" });
      await loadInitialData();
      
    } catch (error: any) {
      updateInstanceState(instanceId, {
        status: 'error',
        progress: 0,
        message: "Falha ao remover"
      });
      
      toast({ 
        title: "Erro", 
        description: "Falha ao remover instância", 
        variant: "destructive" 
      });
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
      case 'connected': return 'bg-success';
      case 'qr_ready': return 'bg-primary';
      case 'connecting': return 'bg-warning';
      case 'authenticated': return 'bg-info';
      default: return 'bg-muted';
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
      case 'connected': return <CheckCircle className="w-4 h-4" />;
      case 'qr_ready': return <QrCode className="w-4 h-4" />;
      case 'connecting': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'authenticated': return <Zap className="w-4 h-4" />;
      default: return <XCircle className="w-4 h-4" />;
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
              <XCircle className="w-5 h-5 text-destructive" />
              <span>Servidor Offline</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p>A API Yumer não está respondendo.</p>
                  <Button onClick={checkServerHealth}>
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Instâncias WhatsApp v2.2.1</h1>
          <p className="text-muted-foreground">Gerenciamento baseado no diagnóstico validado</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <Wifi className="w-4 h-4 text-success" />
            <span className="text-xs text-success">API Online</span>
          </div>
          <Button onClick={loadInitialData} disabled={globalLoading || syncingBusinesses}>
            <RefreshCw className={`w-4 h-4 mr-2 ${(globalLoading || syncingBusinesses) ? 'animate-spin' : ''}`} />
            {syncingBusinesses ? 'Sincronizando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Status Geral */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="font-medium">Sistema Operacional</span>
              </div>
              <Badge variant="outline">
                {instances.length} Instâncias
              </Badge>
              <Badge variant="outline">
                {instances.filter(i => i.status === 'connected').length} Conectadas
              </Badge>
              <Badge variant="outline">
                {businesses.length} Businesses
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Criar Nova Instância */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Nova Instância</span>
          </CardTitle>
          <CardDescription>
            Criar instância seguindo fluxo validado: Business → Instance → Connect → QR
          </CardDescription>
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
                        <span className="text-xs text-muted-foreground">
                          ({instances.filter(i => i.client_id === client.id).length}/{client.max_instances})
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={createInstanceForClient} 
              disabled={globalLoading || !selectedClient || selectedClient === "none"}
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Instância
            </Button>
          </div>
          
          {/* Mostrar progresso de criação */}
          {Object.entries(instanceStates).filter(([id]) => id.startsWith('temp_')).map(([id, state]) => (
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
                    {/* Header da Instância */}
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                      <h3 className="font-semibold">{instance.custom_name || instance.instance_id}</h3>
                      {client && (
                        <Badge variant="outline">
                          <User className="w-3 h-3 mr-1" />
                          {client.name}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        {getStatusIcon(instance.status)}
                        <span>{getStatusText(instance.status)}</span>
                      </Badge>
                    </div>
                    
                    {/* Informações */}
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>ID: {instance.instance_id.split('_').pop()}</span>
                      {instance.status === 'connected' && (
                        <span className="flex items-center space-x-1 text-success">
                          <Phone className="w-3 h-3" />
                          <span>Conectado</span>
                        </span>
                      )}
                      {instance.has_qr_code && (
                        <span className="flex items-center space-x-1 text-primary">
                          <QrCode className="w-3 h-3" />
                          <span>QR Disponível</span>
                        </span>
                      )}
                    </div>

                    {/* Estado da Operação */}
                    {state.status !== 'idle' && (
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Operação em andamento</span>
                          <Badge variant={state.status === 'error' ? 'destructive' : 'default'}>
                            {state.status}
                          </Badge>
                        </div>
                        {state.status === 'loading' && (
                          <Progress value={state.progress} className="mb-2" />
                        )}
                        <p className="text-xs text-muted-foreground">{state.message}</p>
                      </div>
                    )}

                    {/* Alerts de Status */}
                    {instance.status === 'qr_ready' && instance.has_qr_code && (
                      <Alert>
                        <QrCode className="h-4 w-4" />
                        <AlertDescription>
                          <strong>QR Code pronto!</strong> Clique em "Ver QR" para escanear com WhatsApp.
                        </AlertDescription>
                      </Alert>
                    )}

                    {instance.status === 'connected' && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>WhatsApp conectado!</strong> Instância funcionando normalmente.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex space-x-2">
                    {instance.status === 'qr_ready' && instance.has_qr_code && (
                      <Button size="sm" onClick={() => showQRCode(instance.instance_id)}>
                        <QrCode className="w-4 h-4 mr-1" />
                        Ver QR
                      </Button>
                    )}
                    
                    {instance.status === 'connected' ? (
                      <Button 
                        size="sm" 
                        onClick={() => openChat(instance.instance_id)}
                        className="bg-success hover:bg-success/90"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Abrir Chat
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
                      disabled={state.status === 'loading'}
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

      {instances.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="space-y-2">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground" />
              <h3 className="font-medium">Nenhuma instância encontrada</h3>
              <p className="text-sm text-muted-foreground">Crie a primeira instância para começar</p>
            </div>
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
                  src={`data:image/png;base64,${qrModal.qrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
            )}
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Instruções:</strong>
                <ol className="mt-2 text-xs space-y-1">
                  <li>1. Abra o WhatsApp no seu celular</li>
                  <li>2. Toque em "Mais opções" (⋮) → "Aparelhos conectados"</li>
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

export default InstancesManagerV2;