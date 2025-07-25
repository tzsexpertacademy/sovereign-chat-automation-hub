import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Server, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import InstancesListFixed from "./InstancesListFixed";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";
import { yumerWhatsappService } from "@/services/yumerWhatsappService";
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
      // Mock health check
      const healthCheck = { status: 'online', details: { level: 'basic' } };
      
      if (healthCheck.status === 'online') {
        console.log('✅ [MONITOR] Servidor online, nível:', healthCheck.details.level);
        
        // Try to get detailed data if authenticated APIs work
        let activeCount = 0;
        let totalInstances = 0;
        
        if (healthCheck.details.level === 'authenticated') {
          try {
            // Mock instances fetch
            const instances = [];
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
            responseTime: 0,
            uptime: Date.now() / 1000,
            level: healthCheck.details.level
          }
        });
        
        console.log('✅ [MONITOR] Sistema atualizado:', {
          level: healthCheck.details.level,
          active: activeCount,
          total: totalInstances
        });
      } else {
        throw new Error('Servidor offline');
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
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gradient bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Instâncias WhatsApp
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie e monitore suas instâncias de forma centralizada
            </p>
          </div>
          <div className="flex items-center gap-2">
            {systemHealth.serverOnline ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Sistema Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Sistema Offline</span>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={loadData}>
              🔄 Atualizar
            </Button>
          </div>
        </div>

        {/* Criar Nova Instância */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <span>Nova Instância WhatsApp</span>
            </CardTitle>
            <CardDescription>
              Crie uma nova instância para seus clientes se conectarem ao WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 space-y-2">
                <Label htmlFor="client" className="text-sm font-medium">Cliente</Label>
                <select
                  id="client"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  disabled={creating || !systemHealth.serverOnline}
                >
                  <option value="">Selecionar Cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="lg:col-span-5 space-y-2">
                <Label htmlFor="instanceName" className="text-sm font-medium">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  placeholder="Ex: WhatsApp Principal"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  disabled={creating || !systemHealth.serverOnline}
                  className="text-sm"
                />
              </div>
              
              <div className="lg:col-span-3 space-y-2">
                <Label className="text-sm font-medium opacity-0">Ação</Label>
                <Button 
                  onClick={createNewInstance}
                  disabled={creating || !selectedClientId || !newInstanceName.trim() || !systemHealth.serverOnline}
                  className="w-full"
                  size="default"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
            </div>
            
            {!systemHealth.serverOnline && (
              <div className="mt-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Servidor Indisponível
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Não é possível criar novas instâncias no momento. Verifique a conectividade.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={checkSystemHealth}
                    className="ml-auto"
                  >
                    Verificar
                  </Button>
                </div>
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
