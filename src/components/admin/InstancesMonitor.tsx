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
import whatsappService from "@/services/whatsappMultiClient";
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

  useEffect(() => {
    loadData();
    checkSystemHealth();
    
    // Verificar saúde do sistema a cada 30 segundos
    const healthInterval = setInterval(checkSystemHealth, 30000);
    
    return () => clearInterval(healthInterval);
  }, []);

  const checkSystemHealth = async () => {
    try {
      console.log('🔍 [MONITOR] Verificando saúde do sistema HTTPS...');
      const health = await whatsappService.checkServerHealth();
      setSystemHealth({
        serverOnline: true,
        lastCheck: new Date(),
        serverInfo: health
      });
      console.log('✅ [MONITOR] Sistema HTTPS saudável:', health);
    } catch (error) {
      console.error('❌ [MONITOR] Sistema HTTPS indisponível:', error);
      setSystemHealth({
        serverOnline: false,
        lastCheck: new Date(),
        serverInfo: null
      });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📊 [MONITOR] Carregando dados HTTPS...');
      
      const [clientsData, instancesData] = await Promise.all([
        clientsService.getAllClients(),
        loadAllInstances()
      ]);

      setClients(clientsData);
      setInstances(instancesData);
      
      console.log(`📊 [MONITOR] Carregadas ${instancesData.length} instâncias HTTPS no total`);
    } catch (error) {
      console.error('❌ [MONITOR] Erro ao carregar dados HTTPS:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do sistema HTTPS",
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
      console.log(`🚀 [MONITOR] Criando nova instância HTTPS: ${newInstanceName}`);

      const instanceId = `${selectedClientId}_${Date.now()}`;
      
      await whatsappInstancesService.createInstance({
        client_id: selectedClientId,
        instance_id: instanceId,
        status: 'disconnected',
        custom_name: newInstanceName
      });

      toast({
        title: "Instância Criada HTTPS",
        description: "Nova instância WhatsApp criada com sucesso via HTTPS",
      });

      setNewInstanceName("");
      setSelectedClientId("");
      await loadData();
      
    } catch (error) {
      console.error('❌ [MONITOR] Erro ao criar instância HTTPS:', error);
      toast({
        title: "Erro HTTPS",
        description: "Falha ao criar nova instância via HTTPS",
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
    
    return systemHealth.serverOnline ? "Online HTTPS" : "Offline";
  };

  return (
    <InstanceManagerProvider>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitor de Instâncias HTTPS</h1>
            <p className="text-muted-foreground">
              Gerencie todas as instâncias WhatsApp via HTTPS do sistema
            </p>
          </div>
        </div>

        {/* Status do Sistema HTTPS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="w-5 h-5" />
              <span>Status do Sistema HTTPS</span>
            </CardTitle>
            <CardDescription>
              Monitoramento em tempo real do servidor WhatsApp HTTPS
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
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {systemHealth.serverInfo.activeClients} clientes ativos HTTPS
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Uptime: {Math.floor(systemHealth.serverInfo.uptime / 60)} min
                  </p>
                </div>
              )}
              <Button size="sm" onClick={checkSystemHealth}>
                Verificar Status HTTPS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Criar Nova Instância HTTPS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Criar Nova Instância HTTPS</span>
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
                  {creating ? "Criando..." : "Criar Instância HTTPS"}
                </Button>
              </div>
            </div>
            
            {!systemHealth.serverOnline && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  ⚠️ Servidor HTTPS offline. Não é possível criar novas instâncias.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Instâncias HTTPS */}
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando instâncias HTTPS...</p>
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
