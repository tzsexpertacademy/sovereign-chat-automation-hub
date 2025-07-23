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
  Phone,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
// Removido businessSyncService - usando sistema 1:1 simplificado
import unifiedYumerService from "@/services/unifiedYumerService";
import { InstancesCleanupManager } from "./InstancesCleanupManager";
import { InstanceConnectionMonitor } from "./InstanceConnectionMonitor";

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
  // Removido businesses state - usando business_id do cliente diretamente
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Timeouts do diagnóstico
  const OPERATION_TIMEOUT = 10000;
  const CONNECTION_TIMEOUT = 30000;

  // Cache para clientes
  const [clientsCache, setClientsCache] = useState<{ data: ClientData[], timestamp: number }>({ data: [], timestamp: 0 });
  const CLIENT_CACHE_DURATION = 10000; // 10 segundos

  useEffect(() => {
    loadInitialData();
    
    // Auto-refresh otimizado - DESABILITADO temporariamente para corrigir loop
    // const interval = setInterval(() => {
    //   if (!globalLoading) {
    //     refreshInstancesStatus();
    //   }
    // }, 30000); // Aumentado para 30 segundos
    // return () => clearInterval(interval);
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
        loadInstances()
      ]);
      
      // Auto-selecionar primeiro cliente se não há nenhum selecionado
      if (!selectedClient || selectedClient === "none") {
        const firstClient = clients[0];
        if (firstClient) {
          setSelectedClient(firstClient.id);
          console.log('🔄 Auto-selecionando primeiro cliente:', firstClient.name);
        }
      }
    } catch (error) {
      console.error('❌ Erro no carregamento inicial:', error);
      toast({
        title: "Erro no Carregamento",
        description: "Falha ao carregar dados iniciais",
        variant: "destructive",
      });
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
      const now = Date.now();
      
      // Usar cache se ainda válido
      if (clientsCache.data.length > 0 && now - clientsCache.timestamp < CLIENT_CACHE_DURATION) {
        console.log('📋 [CLIENTS] Usando cache...');
        setClients(clientsCache.data);
        return;
      }

      console.log('📋 [CLIENTS] Carregando clientes...');
      const clientsData = await clientsService.getAllClients();
      
      setClients(clientsData);
      setClientsCache({ data: clientsData, timestamp: now });
      
      // Auto-selecionar primeiro cliente se necessário
      if (clientsData.length > 0 && (!selectedClient || selectedClient === "none")) {
        setSelectedClient(clientsData[0].id);
        console.log('🔄 Auto-selecionando cliente:', clientsData[0].name);
      }
      
      console.log(`✅ [CLIENTS] ${clientsData.length} clientes carregados`);
    } catch (error) {
      console.error('❌ [CLIENTS] Erro ao carregar clientes:', error);
      
      // Fallback para cache se houver erro
      if (clientsCache.data.length > 0) {
        console.log('🔄 [CLIENTS] Usando cache como fallback');
        setClients(clientsCache.data);
      }
    }
  };

  const loadInstances = async () => {
    try {
      // Não executar se não há clientes
      if (clients.length === 0) {
        console.log('🔍 Nenhum cliente carregado para buscar instâncias');
        setInstances([]);
        return;
      }
      
      console.log('🔍 Buscando instâncias para cliente:', clients.map(c => c.id));
      const allInstances: WhatsAppInstanceData[] = [];
      
      // Usar Promise.all para otimizar
      const instancePromises = clients.map(async (client) => {
        console.log(`🔍 Buscando instâncias para cliente: ${client.id}`);
        const clientInstances = await whatsappInstancesService.getInstancesByClientId(client.id);
        console.log(`✅ Instâncias encontradas: ${clientInstances.length}`);
        return clientInstances;
      });
      
      const results = await Promise.all(instancePromises);
      results.forEach(instances => allInstances.push(...instances));
      
      console.log(`📊 Total de instâncias carregadas: ${allInstances.length}`);
      setInstances(allInstances);
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias:', error);
    }
  };

  // Removido loadBusinesses - usando business_id diretamente do cliente

  const refreshInstancesStatus = async () => {
    console.log('🔄 [MANUAL] Atualizando status das instâncias...');
    
    if (instances.length === 0) {
      console.log('⚠️ Nenhuma instância para atualizar');
      return;
    }

    // Simples recarregamento via webhook/database
    await loadInstances();
    
    toast({ 
      title: "Status Atualizado", 
      description: "Status das instâncias atualizado via database" 
    });
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

      // 3. Usar fluxo completo corrigido
      const instanceName = `${client.name.replace(/\s+/g, '_')}_${Date.now()}`;
      
      updateInstanceState(tempInstanceId, {
        status: 'loading',
        progress: 60,
        message: 'Executando fluxo completo de criação...'
      });
      
      const createResult = await unifiedYumerService.createInstanceCompleteFlow(
        client.business_id,
        client.id,
        instanceName
      );
      
      if (!createResult.success) {
        throw new Error(createResult.error || 'Falha no fluxo de criação');
      }

      updateInstanceState(tempInstanceId, {
        status: 'loading',
        progress: 80,
        message: 'Salvando instância no banco...'
      });

      // 4. Salvar no banco com dados corrigidos
      const newInstance = await whatsappInstancesService.createInstance({
        client_id: client.id,
        instance_id: createResult.instanceId!,
        status: 'disconnected',
        custom_name: instanceName,
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
    if (!instanceId) return;
    
    try {
      updateInstanceState(instanceId, {
        status: 'loading',
        progress: 30,
        message: 'Conectando instância...'
      });

      // Conectar e capturar QR Code diretamente
      const connectResult = await unifiedYumerService.connectInstance(instanceId);
      
      if (connectResult.success && connectResult.qrCode) {
        // QR Code recebido imediatamente!
        updateInstanceState(instanceId, {
          status: 'loading',
          progress: 80,
          message: 'Salvando QR Code...'
        });
        
        // Salvar QR Code no banco
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase
          .from('whatsapp_instances')
          .update({
            qr_code: connectResult.qrCode,
            has_qr_code: true,
            qr_expires_at: new Date(Date.now() + 60000).toISOString(), // 1 minuto
            status: 'qr_ready'
          })
          .eq('instance_id', instanceId);

        updateInstanceState(instanceId, {
          status: 'success',
          progress: 100,
          message: 'QR Code disponível!',
          data: { qrCode: connectResult.qrCode }
        });
        
        toast({ 
          title: "QR Code Disponível", 
          description: "QR Code obtido instantaneamente!" 
        });
        
        await loadInstances();
        
      } else if (connectResult.success) {
        // Conexão realizada mas sem QR (talvez já conectado)
        updateInstanceState(instanceId, {
          status: 'success',
          progress: 100,
          message: 'Instância conectada!'
        });
        
        toast({ 
          title: "Conectado", 
          description: "Instância já está conectada!" 
        });
        
        await loadInstances();
        
      } else {
        throw new Error(connectResult.error || 'Falha na conexão');
      }
      
    } catch (error: any) {
      console.error('Erro ao conectar instância:', error);
      
      updateInstanceState(instanceId, {
        status: 'error',
        progress: 0,
        message: error.message || 'Erro na conexão'
      });
      
      toast({ 
        title: "Erro", 
        description: error.message || "Falha ao conectar instância", 
        variant: "destructive" 
      });
    }
  };

  const showQRCode = async (instanceId: string) => {
    const instance = instances.find(i => i.instance_id === instanceId);
    if (!instance || !instance.business_business_id) return;

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
          businessId: instance.business_business_id
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
    
    try {
      updateInstanceState(instanceId, {
        status: 'loading',
        progress: 50,
        message: 'Removendo instância...'
      });

      // Tentar remover da API (sempre tentar)
      try {
        await unifiedYumerService.deleteInstance(instanceId);
      } catch (error) {
        console.log('Instância não existe na API, apenas no banco');
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
          <Button onClick={loadInitialData} disabled={globalLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${globalLoading ? 'animate-spin' : ''}`} />
            Atualizar
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
                {clients.filter(c => c.business_id).length} Businesses
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
              disabled={globalLoading || !selectedClient || selectedClient === "none" || clients.length === 0}
            >
              {globalLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Carregando...
                </>
              ) : clients.length === 0 ? (
                <>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Sem Clientes
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Instância
                </>
              )}
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

      {/* Manual Refresh Button */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Status das Instâncias</h3>
              <p className="text-sm text-muted-foreground">
                Atualização manual via database (sem polling)
              </p>
            </div>
            <Button 
              onClick={refreshInstancesStatus}
              disabled={globalLoading}
              variant="outline"
              size="sm"
            >
              {globalLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar Status
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Limpeza de Instâncias */}
      <InstancesCleanupManager 
        onInstancesUpdated={loadInitialData}
      />

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