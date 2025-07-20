
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { whatsappInstancesService, WhatsAppInstanceData } from "@/services/whatsappInstancesService";
import { clientsService, ClientData } from "@/services/clientsService";
import InstancesListClean from "./InstancesListClean";

const InstancesMonitorClean = () => {
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [serverOnline, setServerOnline] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://yumer.yumerflow.app:8083/', { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setServerOnline(response.ok);
    } catch (error) {
      setServerOnline(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [clientsData, instancesData] = await Promise.all([
        clientsService.getAllClients(),
        loadAllInstances()
      ]);

      setClients(clientsData);
      setInstances(instancesData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do sistema",
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
          console.warn(`Erro ao carregar instâncias do cliente ${client.id}:`, error);
        }
      }
      
      return allInstances;
    } catch (error) {
      console.error('Erro ao carregar todas as instâncias:', error);
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
      
      const { instancesUnifiedService } = await import('@/services/instancesUnifiedService');
      
      const result = await instancesUnifiedService.createInstanceForClient(
        selectedClientId, 
        newInstanceName
      );

      toast({
        title: "Instância Criada",
        description: "Nova instância WhatsApp criada com sucesso",
      });

      setNewInstanceName("");
      setSelectedClientId("");
      await loadData();
      
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar nova instância",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const getServerStatusColor = () => {
    return serverOnline ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instâncias WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie as instâncias do sistema
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Server className="w-4 h-4" />
          <span className={`text-sm ${getServerStatusColor()}`}>
            {serverOnline ? 'Servidor Online' : 'Servidor Offline'}
          </span>
        </div>
      </div>

      {/* Criar Nova Instância */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Nova Instância</span>
          </CardTitle>
          <CardDescription>
            Adicione uma nova instância WhatsApp para um cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              <select
                id="client"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
                disabled={creating || !serverOnline}
              >
                <option value="">Selecionar Cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
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
                disabled={creating || !serverOnline}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={createNewInstance}
                disabled={creating || !selectedClientId || !newInstanceName.trim() || !serverOnline}
                className="w-full"
              >
                {creating ? "Criando..." : "Criar Instância"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Instâncias */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Carregando instâncias...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <InstancesListClean
          instances={instances}
          clients={clients}
          onInstanceUpdated={loadData}
          serverOnline={serverOnline}
        />
      )}
    </div>
  );
};

export default InstancesMonitorClean;
