import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Server, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import InstancesListFixed from "./InstancesListFixed";
import JwtStatusIndicator from "./JwtStatusIndicator";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";
import { yumerWhatsAppService } from "@/services/yumerWhatsappService";
import { useUnifiedInstanceManager } from "@/hooks/useUnifiedInstanceManager";
import { InstanceManagerProvider } from "@/contexts/InstanceManagerContext";

const InstancesMonitor = () => {
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [systemHealth, setSystemHealth] = useState({
    serverOnline: false,
    lastCheck: null as Date | null,
    serverInfo: null as any
  });
  const { toast } = useToast();
  
  // Hook para status REST
  const { restMode } = useUnifiedInstanceManager();

  useEffect(() => {
    loadData();
    checkSystemHealth();
    
    // Verificar saúde do sistema a cada 30 segundos
    const healthInterval = setInterval(checkSystemHealth, 30000);
    
    return () => clearInterval(healthInterval);
  }, []);

  const checkSystemHealth = async () => {
    try {
      console.log('🔍 [MONITOR] Verificando saúde do sistema YUMER (rotas públicas)...');
      
      // Use the hierarchical health check
      const healthCheck = await yumerWhatsAppService.checkServerHealth();
      
      if (healthCheck.status === 'online') {
        console.log('✅ [MONITOR] Servidor online, nível:', healthCheck.details.level);
        
        // Try to get detailed data if authenticated APIs work
        let activeCount = 0;
        let totalInstances = 0;
        
        if (healthCheck.details.level === 'authenticated') {
          try {
            const instances = await yumerWhatsAppService.fetchAllInstances();
            totalInstances = instances.length;
            activeCount = instances.filter(i => 
              i.status === 'connected' || 
              i.status === 'ready' || 
              i.status === 'qr_ready'
            ).length;
          } catch (error) {
            console.warn('⚠️ [MONITOR] Não foi possível carregar instâncias:', error);
          }
        }
        
        setSystemHealth({
          serverOnline: true,
          lastCheck: new Date(),
          serverInfo: {
            activeClients: activeCount,
            totalInstances: totalInstances,
            responseTime: healthCheck.details.responseTime || 0,
            uptime: new Date(healthCheck.details.timestamp).getTime() / 1000,
            level: healthCheck.details.level
          }
        });
        
        console.log('✅ [MONITOR] Sistema atualizado:', {
          level: healthCheck.details.level,
          active: activeCount,
          total: totalInstances
        });
      } else {
        throw new Error(healthCheck.details.error || 'Servidor offline');
      }
    } catch (error: any) {
      console.error('❌ [MONITOR] Sistema YUMER indisponível:', error);
      setSystemHealth({
        serverOnline: false,
        lastCheck: new Date(),
        serverInfo: null
      });
      
      // Show toast only on first failure or after being online
      if (systemHealth.serverOnline !== false) {
        toast({
          title: "Servidor YUMER Offline",
          description: error.message || "Não foi possível conectar ao servidor",
          variant: "destructive",
        });
      }
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📊 [MONITOR] Carregando dados YUMER...');
      
      const [clientsData, instancesData] = await Promise.all([
        clientsService.getAllClients(),
        loadAllInstances()
      ]);

      setClients(clientsData);
      setInstances(instancesData);
      
      console.log(`📊 [MONITOR] Carregadas ${instancesData.length} instâncias YUMER no total`);
    } catch (error) {
      console.error('❌ [MONITOR] Erro ao carregar dados HTTPS:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do sistema YUMER",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllInstances = async (): Promise<WhatsAppInstanceData[]> => {
    try {
      const clients = await clientsService.getAllClients();
      const allInstances: WhatsAppInstanceData[] = [];
      
      for (const client of clients) {
        try {
          const clientInstances = await whatsappInstancesService.getInstancesByClientId(client.id);
          allInstances.push(...clientInstances);
        } catch (error) {
          console.warn(`⚠️ [MONITOR] Erro ao carregar instâncias do cliente ${client.id}:`, error);
        }
      }
      
      return allInstances;
    } catch (error) {
      console.error('❌ [MONITOR] Erro ao carregar todas as instâncias:', error);
      return [];
    }
  };

  const createNewInstance = async () => {
    if (!selectedClientId || !newInstanceName.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um cliente e forneça um nome para a instância",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      console.log(`🚀 [MONITOR] Criando nova instância via fluxo correto: ${newInstanceName}`);

      // Importar e usar instancesUnifiedService para fluxo correto
      const { instancesUnifiedService } = await import('@/services/instancesUnifiedService');
      
      const result = await instancesUnifiedService.createInstanceForClient(
        selectedClientId, 
        newInstanceName
      );

      console.log('✅ [MONITOR] Instância criada com sucesso:', result);

      toast({
        title: "Instância Criada",
        description: "Nova instância WhatsApp criada com sucesso no YUMER",
      });

      setNewInstanceName("");
      setSelectedClientId("");
      await loadData();
      
    } catch (error: any) {
      console.error('❌ [MONITOR] Erro ao criar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar nova instância",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const getHealthStatusIcon = () => {
    if (!systemHealth.lastCheck) {
      return <Clock className="w-5 h-5 text-gray-500" />;
    }
    
    return systemHealth.serverOnline ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <AlertCircle className="w-5 h-5 text-red-500" />
    );
  };

  const getHealthStatusText = () => {
    if (!systemHealth.lastCheck) {
      return "Verificando...";
    }
    
    return systemHealth.serverOnline ? "Online" : "Offline";
  };

  return (
    <InstanceManagerProvider>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitor de Instâncias</h1>
            <p className="text-muted-foreground">
              Gerencie todas as instâncias WhatsApp do sistema
            </p>
          </div>
        </div>

        {/* REST Status Indicator */}
        <JwtStatusIndicator 
          jwtConfigured={restMode}
          websocketConnected={restMode}
        />

        {/* Status do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="w-5 h-5" />
              <span>Status do Sistema</span>
            </CardTitle>
            <CardDescription>
              Monitoramento em tempo real do servidor WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getHealthStatusIcon()}
                <div>
                  <p className="font-medium">{getHealthStatusText()}</p>
                  <p className="text-sm text-muted-foreground">
                    {systemHealth.lastCheck && `Última verificação: ${systemHealth.lastCheck.toLocaleTimeString()}`}
                  </p>
                </div>
              </div>
              {systemHealth.serverInfo && (
                <div className="text-right space-y-1">
                  <p className="text-sm font-medium">
                    {systemHealth.serverInfo.activeClients}/{systemHealth.serverInfo.totalInstances} instâncias ativas
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Resposta: {systemHealth.serverInfo.responseTime}ms
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Uptime: {Math.floor((Date.now() - systemHealth.serverInfo.uptime * 1000) / 60000)} min
                  </p>
                </div>
              )}
              <Button size="sm" onClick={checkSystemHealth}>
                Verificar Status
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Criar Nova Instância */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Criar Nova Instância</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Cliente</Label>
                <select
                  id="client"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  disabled={creating || !systemHealth.serverOnline}
                >
                  <option value="">Selecionar Cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="instanceName">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  placeholder="Ex: WhatsApp Principal"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  disabled={creating || !systemHealth.serverOnline}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={createNewInstance}
                  disabled={creating || !selectedClientId || !newInstanceName.trim() || !systemHealth.serverOnline}
                  className="w-full"
                >
                  {creating ? "Criando..." : "Criar Instância"}
                </Button>
              </div>
            </div>
            
            {!systemHealth.serverOnline && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Servidor YUMER Offline
                  </p>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Não é possível criar novas instâncias. Verifique a conectividade e tente novamente.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkSystemHealth}
                  className="mt-2"
                >
                  🔄 Tentar Reconectar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Instâncias */}
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando instâncias...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <InstancesListFixed
            instances={instances}
            clients={clients}
            onInstanceUpdated={loadData}
            systemHealth={systemHealth}
          />
        )}
      </div>
    </InstanceManagerProvider>
  );
};

export default InstancesMonitor;
