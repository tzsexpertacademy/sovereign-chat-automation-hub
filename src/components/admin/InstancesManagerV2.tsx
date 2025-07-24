import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  AlertCircle,
  MoreVertical,
  Edit,
  Power,
  RotateCw,
  LogOut,
  Search,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { clientsService, ClientData } from "@/services/clientsService";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
// Removido businessSyncService - usando sistema 1:1 simplificado
import unifiedYumerService from "@/services/unifiedYumerService";
import { yumerJwtService } from "@/services/yumerJwtService";
import { InstancesCleanupManager } from "./InstancesCleanupManager";
import { InstanceConnectionMonitor } from "./InstanceConnectionMonitor";

interface InstanceState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'timeout' | 'connecting' | 'deleting' | 'editing' | 'disconnecting' | 'restarting';
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

interface EditModalData {
  isOpen: boolean;
  instanceId: string;
  currentName: string;
}

const InstancesManagerV2 = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [qrModal, setQrModal] = useState<QRModalData>({ show: false });
  const [editModal, setEditModal] = useState<EditModalData>({
    isOpen: false,
    instanceId: '',
    currentName: ''
  });
  const [instanceStates, setInstanceStates] = useState<InstanceStates>({});
  const [pollingActive, setPollingActive] = useState(false);
  // Removido businesses state - usando business_id do cliente diretamente
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Timeouts do diagnóstico
  const OPERATION_TIMEOUT = 10000;
  const CONNECTION_TIMEOUT = 30000;

  // Cache para clientes
  const [clientsCache, setClientsCache] = useState<{ data: ClientData[], timestamp: number }>({ data: [], timestamp: 0 });
  const CLIENT_CACHE_DURATION = 10000; // 10 segundos

  const location = useLocation();

  // Carregamento inicial quando o componente monta
  useEffect(() => {
    console.log('🔄 [INITIAL-LOAD] Componente montado, carregando dados iniciais...');
    loadInitialData();
  }, []); // Array vazio = executa apenas na montagem

  // Auto-refresh quando acessar a página (rota específica)
  useEffect(() => {
    if (location.pathname === '/admin/instances') {
      console.log('🔄 [AUTO-REFRESH] Página de instâncias acessada, recarregando dados...');
      loadInitialData();
    }
  }, [location.pathname]);

  useEffect(() => {
    // Polling inteligente para detectar conexões
    let pollingTimeouts = new Map<string, NodeJS.Timeout>();
    
    const startPollingForInstance = (instance: any) => {
      if (instance.status !== 'qr_ready') return;
      
      const instanceId = instance.instance_id;
      const startTime = Date.now();
      const MAX_POLLING_TIME = 10 * 60 * 1000; // 10 minutos max
      
    const pollInstance = async () => {
        try {
          console.log(`🔍 [POLLING] Verificando status da instância: ${instanceId}`);
          
          // Usar getInstance() para instâncias qr_ready - ele verifica se tem dados do WhatsApp
          const instanceResult = await unifiedYumerService.getInstance(instanceId);
          
          if (instanceResult.success && instanceResult.data) {
            const instanceData = instanceResult.data;
            console.log(`📊 [POLLING] Dados da instância:`, instanceData);
            
            // Verificar se tem dados do WhatsApp (significa que conectou)
            if (instanceData.WhatsApp && instanceData.WhatsApp.remoteJid) {
              console.log(`✅ [POLLING] Instância ${instanceId} conectou! remoteJid: ${instanceData.WhatsApp.remoteJid}`);
              
              // Conectou! Atualizar no banco
              const { supabase } = await import('@/integrations/supabase/client');
              await supabase
                .from('whatsapp_instances')
                .update({
                  status: 'connected',
                  connection_state: 'open',
                  phone_number: instanceData.WhatsApp.remoteJid,
                  has_qr_code: false,
                  qr_code: null,
                  qr_expires_at: null,
                  updated_at: new Date().toISOString()
                })
                .eq('instance_id', instanceId);
              
              // Parar polling
              const timeout = pollingTimeouts.get(instanceId);
              if (timeout) clearTimeout(timeout);
              pollingTimeouts.delete(instanceId);
              
              toast({
                title: "Instância Conectada!",
                description: `${instance.custom_name || instanceId} conectou ao WhatsApp`,
              });
              
              // Recarregar lista
              await loadInstances();
              return;
            } else {
              console.log(`⏳ [POLLING] Instância ${instanceId} ainda aguardando conexão...`);
            }
          }
          
          // Continuar polling se não passou do tempo limite
          if (Date.now() - startTime < MAX_POLLING_TIME) {
            const timeout = setTimeout(pollInstance, 6000); // 6 segundos - reduzido a frequência
            pollingTimeouts.set(instanceId, timeout);
          } else {
            console.log(`⏰ [POLLING] Timeout para instância: ${instanceId}`);
            pollingTimeouts.delete(instanceId);
          }
        } catch (error) {
          console.log(`⚠️ [POLLING] Erro na instância ${instanceId}:`, error);
          // Continuar tentando em caso de erro, mas com intervalo maior
          if (Date.now() - startTime < MAX_POLLING_TIME) {
            const timeout = setTimeout(pollInstance, 8000); // 8 segundos em caso de erro
            pollingTimeouts.set(instanceId, timeout);
          }
        }
      };
      
      // Iniciar polling imediatamente
      pollInstance();
    };
    
    // Iniciar polling para todas as instâncias qr_ready
    instances.filter(instance => instance.status === 'qr_ready').forEach(startPollingForInstance);
    
    return () => {
      // Limpar todos os timeouts ao desmontar
      pollingTimeouts.forEach(timeout => clearTimeout(timeout));
      pollingTimeouts.clear();
    };
  }, [instances.filter(instance => instance.status === 'qr_ready').length]); // Só recriar quando número de instâncias qr_ready mudar

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
      // Executar sequencialmente para garantir que clientes sejam carregados antes das instâncias
      await checkServerHealth();
      const loadedClients = await loadClients();
      
      // Só carregar instâncias se há clientes
      if (loadedClients && loadedClients.length > 0) {
        await loadInstances();
      } else {
        console.log('🔍 Nenhum cliente disponível, pulando carregamento de instâncias');
        setInstances([]);
      }
      
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
      
      // Retornar os dados carregados para uso na sequência
      return clientsData;
    } catch (error) {
      console.error('❌ [CLIENTS] Erro ao carregar clientes:', error);
      
      // Fallback para cache se houver erro
      if (clientsCache.data.length > 0) {
        console.log('🔄 [CLIENTS] Usando cache como fallback');
        setClients(clientsCache.data);
        return clientsCache.data;
      }
      return [];
    }
  };

  const loadInstances = async () => {
    try {
      // Usar state atualizado de clientes ao invés de verificar o array diretamente
      const currentClients = clients.length > 0 ? clients : clientsCache.data;
      
      if (currentClients.length === 0) {
        console.log('🔍 Nenhum cliente disponível para buscar instâncias');
        setInstances([]);
        return;
      }
      
      console.log('🔍 Buscando instâncias para clientes:', currentClients.map(c => c.id));
      const allInstances: WhatsAppInstanceData[] = [];
      
      // Usar Promise.all para otimizar
      const instancePromises = currentClients.map(async (client) => {
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

  // Função de refresh manual (simplificada)
  const refreshInstancesStatus = async () => {
    console.log('🔄 [MANUAL-REFRESH] Recarregando dados das instâncias...');
    await loadInitialData();
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
        status: 'loading',
        progress: 90,
        message: 'Gerando e salvando JWT...'
      });

      // 5. Gerar e salvar JWT após instância estar no banco
      try {
        await yumerJwtService.saveInstanceJWT(createResult.instanceId!, client.business_id);
        console.log('✅ JWT salvo para instância:', createResult.instanceId);
      } catch (jwtError) {
        console.warn('⚠️ Erro ao salvar JWT (não bloqueia):', jwtError);
      }

      updateInstanceState(tempInstanceId, {
        status: 'success',
        progress: 100,
        message: 'Instância criada com sucesso!'
      });

      toast({ title: "Sucesso", description: "Instância criada e configurada!" });
      
      setSelectedClient("");
      
      // Recarregar dados automaticamente para mostrar nova instância
      console.log('🔄 [AUTO-REFRESH] Atualizando lista após criação...');
      await loadInitialData();
      
      // Aguardar um pouco e recarregar novamente para garantir sincronização
      setTimeout(async () => {
        console.log('🔄 [AUTO-REFRESH] Segunda atualização...');
        await loadInitialData();
      }, 2000);
      
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
    
    const maxRetries = 3;
    const maxPollingTime = 60000; // 60 segundos
    const pollingInterval = 3000; // 3 segundos
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        updateInstanceState(instanceId, {
          status: 'loading',
          progress: 10,
          message: `Verificando status da instância... (${attempt}/${maxRetries})`
        });

        // Fase 1: Verificar se instância está ativa
        const instanceStatus = await unifiedYumerService.getInstance(instanceId);
        
        if (!instanceStatus.success) {
          if (attempt < maxRetries) {
            updateInstanceState(instanceId, {
              status: 'loading',
              progress: 20,
              message: `Instância não encontrada, aguardando... (${attempt}/${maxRetries})`
            });
            await new Promise(resolve => setTimeout(resolve, 5000)); // Aguarda 5s
            continue;
          }
          throw new Error('Instância não encontrada após tentativas');
        }

        updateInstanceState(instanceId, {
          status: 'loading',
          progress: 30,
          message: 'Instância ativa, iniciando conexão...'
        });

        // Fase 2: Tentar conectar com polling
        const connectResult = await unifiedYumerService.connectInstance(instanceId);
        
        if (connectResult.success && connectResult.data?.base64) {
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
              qr_code: connectResult.data.base64,
              has_qr_code: true,
              qr_expires_at: new Date(Date.now() + 60000).toISOString(), // 1 minuto
              status: 'qr_ready'
            })
            .eq('instance_id', instanceId);

          updateInstanceState(instanceId, {
            status: 'success',
            progress: 100,
            message: 'QR Code disponível!',
            data: { qrCode: connectResult.data.base64 }
          });
          
          toast({ 
            title: "QR Code Disponível", 
            description: "QR Code obtido com sucesso!" 
          });
          
          await loadInstances();
          return; // Sucesso, sair do loop
          
        } else if (connectResult.success) {
          // Conexão realizada mas sem QR (já conectado)
          updateInstanceState(instanceId, {
            status: 'success',
            progress: 100,
            message: 'Instância já conectada!'
          });
          
          toast({ 
            title: "Conectado", 
            description: "Instância já está conectada!" 
          });
          
          await loadInstances();
          return; // Sucesso, sair do loop
          
        } else if (connectResult.error?.includes('404') || connectResult.error?.includes('not found')) {
          // Erro 404: instância não está pronta ainda
          if (attempt < maxRetries) {
            updateInstanceState(instanceId, {
              status: 'loading',
              progress: 40,
              message: `Instância não está pronta, aguardando... (${attempt}/${maxRetries})`
            });
            await new Promise(resolve => setTimeout(resolve, 10000)); // Aguarda 10s
            continue;
          }
          throw new Error('Instância não ficou pronta após tentativas');
        } else {
          throw new Error(connectResult.error || 'Falha na conexão');
        }
        
      } catch (error: any) {
        console.error(`Erro na tentativa ${attempt}:`, error);
        
        if (error.message?.includes('aborted') && attempt < maxRetries) {
          updateInstanceState(instanceId, {
            status: 'loading',
            progress: 25,
            message: `Timeout na conexão, tentando novamente... (${attempt}/${maxRetries})`
          });
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        if (attempt === maxRetries) {
          updateInstanceState(instanceId, {
            status: 'error',
            progress: 0,
            message: error.message || 'Erro na conexão após todas as tentativas'
          });
          
          toast({ 
            title: "Erro", 
            description: `Falha ao conectar instância após ${maxRetries} tentativas: ${error.message}`, 
            variant: "destructive" 
          });
        }
      }
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

  const handleEditInstance = async (instanceId: string, newName: string) => {
    try {
      updateInstanceState(instanceId, { status: 'editing', message: 'Atualizando nome...', progress: 50 });
      
      await whatsappInstancesService.updateCustomName(instanceId, newName);
      
      toast({
        title: "Nome atualizado",
        description: "Nome da instância atualizado com sucesso",
      });
      
      setEditModal({ isOpen: false, instanceId: '', currentName: '' });
      await loadInstances();
    } catch (error) {
      console.error('Erro ao editar instância:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar nome da instância",
        variant: "destructive",
      });
    } finally {
      setInstanceStates(prev => {
        const newStates = { ...prev };
        delete newStates[instanceId];
        return newStates;
      });
    }
  };

  const handleLogoutInstance = async (instanceId: string) => {
    try {
      updateInstanceState(instanceId, { status: 'disconnecting', message: 'Desconectando...', progress: 50 });
      
      const result = await unifiedYumerService.logoutInstance(instanceId);
      
      if (result.success) {
        await whatsappInstancesService.updateInstanceByInstanceId(instanceId, {
          status: 'disconnected',
          connection_state: 'close',
          phone_number: null,
          has_qr_code: false,
          qr_code: null,
          qr_expires_at: null
        });
        
        toast({
          title: "Instância desconectada",
          description: "Instância desconectada com sucesso",
        });
        
        await loadInstances();
      } else {
        throw new Error(result.error || 'Erro ao desconectar');
      }
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
      toast({
        title: "Erro",
        description: "Erro ao desconectar instância",
        variant: "destructive",
      });
    } finally {
      setInstanceStates(prev => {
        const newStates = { ...prev };
        delete newStates[instanceId];
        return newStates;
      });
    }
  };

  const handleRestartInstance = async (instanceId: string) => {
    try {
      updateInstanceState(instanceId, { status: 'restarting', message: 'Reiniciando...', progress: 50 });
      
      const result = await unifiedYumerService.restartInstance(instanceId);
      
      if (result.success) {
        toast({
          title: "Instância reiniciada",
          description: "Instância reiniciada com sucesso",
        });
        
        await loadInstances();
      } else {
        throw new Error(result.error || 'Erro ao reiniciar');
      }
    } catch (error) {
      console.error('Erro ao reiniciar instância:', error);
      toast({
        title: "Erro",
        description: "Erro ao reiniciar instância",
        variant: "destructive",
      });
    } finally {
      setInstanceStates(prev => {
        const newStates = { ...prev };
        delete newStates[instanceId];
        return newStates;
      });
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
      {/* Header Profissional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-background to-muted/50 rounded-xl border">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Gerenciador de Instâncias
          </h1>
          <p className="text-sm text-muted-foreground">
            Sistema unificado de gestão de instâncias WhatsApp
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-full text-xs font-medium">
            <Wifi className="w-3 h-3" />
            API Online
          </div>
          <Button 
            onClick={loadInitialData} 
            disabled={globalLoading}
            size="sm"
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${globalLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
            <span className="sm:hidden">Atualizar Dados</span>
          </Button>
        </div>
      </div>

      {/* Métricas do Sistema */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Instâncias</p>
                <p className="text-2xl font-bold text-primary">{instances.length}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conectadas</p>
                <p className="text-2xl font-bold text-success">
                  {instances.filter(i => i.status === 'connected').length}
                </p>
              </div>
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">QR Prontos</p>
                <p className="text-2xl font-bold text-warning">
                  {instances.filter(i => i.status === 'qr_ready').length}
                </p>
              </div>
              <div className="p-2 bg-warning/10 rounded-lg">
                <QrCode className="w-5 h-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold text-info">
                  {clients.filter(c => c.business_id).length}
                </p>
              </div>
              <div className="p-2 bg-info/10 rounded-lg">
                <User className="w-5 h-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Criar Nova Instância */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Nova Instância</CardTitle>
                <CardDescription className="text-sm">
                  Fluxo validado: Business → Instance → Connect → QR
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
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
                        <Badge variant="outline" className="text-xs">{client.plan}</Badge>
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
              className="w-full sm:w-auto px-6"
            >
              {globalLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Carregando...</span>
                  <span className="sm:hidden">Carregando</span>
                </>
              ) : clients.length === 0 ? (
                <>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <span>Sem Clientes</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Criar Instância</span>
                  <span className="sm:hidden">Criar</span>
                </>
              )}
            </Button>
          </div>
          
          {/* Progresso de criação */}
          {Object.entries(instanceStates).filter(([id]) => id.startsWith('temp_')).map(([id, state]) => (
            <div key={id} className="p-4 bg-muted/50 rounded-lg border-l-4 border-l-primary">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Criando instância...</span>
                <Badge variant={state.status === 'error' ? 'destructive' : 'default'}>
                  {state.status}
                </Badge>
              </div>
              <Progress value={state.progress} className="mb-2 h-2" />
              <p className="text-xs text-muted-foreground">{state.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      
      {/* Limpeza de Instâncias */}
      <InstancesCleanupManager 
        onInstancesUpdated={loadInitialData}
      />

      {/* Lista de Instâncias */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Instâncias Ativas</h2>
          <Badge variant="secondary" className="text-xs">
            {instances.length} {instances.length === 1 ? 'instância' : 'instâncias'}
          </Badge>
        </div>

        <div className="grid gap-4">
          {instances.map(instance => {
            const client = clients.find(c => c.id === instance.client_id);
            const state = instanceStates[instance.instance_id] || { status: 'idle', progress: 0, message: '' };
            
            return (
              <Card key={instance.id} className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Header da Instância */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full shadow-sm ${getStatusColor(instance.status)}`} />
                          <h3 className="font-semibold text-lg truncate">
                            {instance.custom_name || instance.instance_id}
                          </h3>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {client && (
                            <Badge variant="outline" className="text-xs">
                              <User className="w-3 h-3 mr-1" />
                              {client.name}
                            </Badge>
                          )}
                          <Badge 
                            variant="secondary" 
                            className={`flex items-center gap-1 text-xs ${
                              instance.status === 'connected' ? 'bg-success/10 text-success border-success/20' :
                              instance.status === 'qr_ready' ? 'bg-primary/10 text-primary border-primary/20' :
                              'bg-muted'
                            }`}
                          >
                            {getStatusIcon(instance.status)}
                            <span>{getStatusText(instance.status)}</span>
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Informações */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          ID: {instance.instance_id.split('_').pop()}
                        </span>
                        {instance.status === 'connected' && (
                          <div className="flex items-center gap-1 text-success">
                            <Phone className="w-3 h-3" />
                            <span className="text-xs">Conectado</span>
                          </div>
                        )}
                        {instance.has_qr_code && (
                          <div className="flex items-center gap-1 text-primary">
                            <QrCode className="w-3 h-3" />
                            <span className="text-xs">QR Disponível</span>
                          </div>
                        )}
                      </div>

                      {/* Estado da Operação */}
                      {state.status !== 'idle' && (
                        <div className="p-3 bg-muted/50 rounded-lg border-l-4 border-l-primary">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Operação em andamento</span>
                            <Badge variant={state.status === 'error' ? 'destructive' : 'default'}>
                              {state.status}
                            </Badge>
                          </div>
                          {state.status === 'loading' && (
                            <Progress value={state.progress} className="mb-2 h-2" />
                          )}
                          <p className="text-xs text-muted-foreground">{state.message}</p>
                        </div>
                      )}

                      {/* Alerts de Status */}
                      {instance.status === 'qr_ready' && instance.has_qr_code && (
                        <Alert className="border-primary/20 bg-primary/5">
                          <QrCode className="h-4 w-4 text-primary" />
                          <AlertDescription className="text-primary">
                            <strong>QR Code pronto!</strong> Clique em "Ver QR" para escanear.
                          </AlertDescription>
                        </Alert>
                      )}

                      {instance.status === 'connected' && (
                        <Alert className="border-success/20 bg-success/5">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <AlertDescription className="text-success">
                            <strong>WhatsApp conectado!</strong> Instância funcionando.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 min-w-fit">
                      {/* Botões principais */}
                      <div className="flex flex-wrap gap-2">
                        {instance.status === 'qr_ready' && instance.has_qr_code && (
                          <Button 
                            size="sm" 
                            onClick={() => showQRCode(instance.instance_id)}
                            className="flex-1 sm:flex-none"
                          >
                            <QrCode className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Ver QR</span>
                            <span className="sm:hidden">QR</span>
                          </Button>
                        )}
                        
                        {/* Abrir Chat se conectado */}
                        {(instance.status === 'connected' || instance.connection_state === 'open') && (
                          <Button 
                            size="sm" 
                            onClick={() => openChat(instance.instance_id)}
                            className="bg-success hover:bg-success/90 text-success-foreground flex-1 sm:flex-none"
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Abrir Chat</span>
                            <span className="sm:hidden">Chat</span>
                          </Button>
                        )}
                        
                        {/* Conectar se não conectado */}
                        {instance.status !== 'connected' && instance.connection_state !== 'open' && (
                          <Button 
                            size="sm"
                            onClick={() => connectInstance(instance.instance_id)}
                            disabled={state.status === 'loading'}
                            className="flex-1 sm:flex-none"
                          >
                            {state.status === 'loading' ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                <span className="hidden sm:inline">Conectando...</span>
                                <span className="sm:hidden">...</span>
                              </>
                            ) : (
                              <>
                                <Wifi className="w-4 h-4 mr-1" />
                                <span className="hidden sm:inline">Conectar</span>
                                <span className="sm:hidden">Conectar</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {/* Menu de ações */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="px-3">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => setEditModal({
                              isOpen: true,
                              instanceId: instance.instance_id,
                              currentName: instance.custom_name || instance.instance_id
                            })}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar Nome
                          </DropdownMenuItem>
                          
                          {(instance.status === 'connected' || instance.connection_state === 'open') && (
                            <>
                              <DropdownMenuItem
                                onClick={() => openChat(instance.instance_id)}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Abrir Chat
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem
                                onClick={() => handleLogoutInstance(instance.instance_id)}
                                disabled={state.status === 'disconnecting'}
                              >
                                <LogOut className="w-4 h-4 mr-2" />
                                {state.status === 'disconnecting' ? 'Desconectando...' : 'Desconectar'}
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem
                                onClick={() => handleRestartInstance(instance.instance_id)}
                                disabled={state.status === 'restarting'}
                              >
                                <RotateCw className="w-4 h-4 mr-2" />
                                {state.status === 'restarting' ? 'Reiniciando...' : 'Reiniciar'}
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remover
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja remover a instância "{instance.custom_name || instance.instance_id}"? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteInstance(instance.instance_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {instances.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-full w-fit mx-auto">
                <MessageSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Nenhuma instância encontrada</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Crie sua primeira instância WhatsApp para começar a gerenciar suas conversas
                </p>
              </div>
              <Button 
                onClick={() => setSelectedClient("")}
                variant="outline"
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Instância
              </Button>
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

      {/* Modal de Edição */}
      <Dialog open={editModal.isOpen} onOpenChange={(open) => setEditModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Nome da Instância</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="instanceName">Nome da Instância</Label>
              <Input
                id="instanceName"
                value={editModal.currentName}
                onChange={(e) => setEditModal(prev => ({ ...prev, currentName: e.target.value }))}
                placeholder="Digite o nome da instância"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setEditModal({ isOpen: false, instanceId: '', currentName: '' })}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => handleEditInstance(editModal.instanceId, editModal.currentName)}
                disabled={!editModal.currentName.trim()}
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstancesManagerV2;